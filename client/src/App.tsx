import { useState, useCallback, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useRemoteParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { ConnectionState, ParticipantEvent, RoomEvent, Track } from 'livekit-client';
import { fetchConnectionDetails } from './lib/connection';
import './App.css';

const HUEBASE = 265;
const BANDS = 96;
const LAYERS = [
  { rOffset: 0,   amp: 20, w: 2.4, a: 0.9,  speed:  0.0022 },
  { rOffset: 22,  amp: 10, w: 1.5, a: 0.5,  speed: -0.0014 },
  { rOffset: -14, amp: 28, w: 1.2, a: 0.38, speed:  0.003  },
] as const;

const BAR_COUNT = 36;

function AssistantUI({
  connectAgent,
  onDisconnect,
  isFetching,
  error,
}: {
  connectAgent: () => void;
  onDisconnect: () => void;
  isFetching: boolean;
  error: string | null;
}) {
  const connectionState = useConnectionState();
  const room = useRoomContext();
  const isConnected = connectionState === ConnectionState.Connected;
  const isConnecting = connectionState === ConnectionState.Connecting || isFetching;

  const remoteParticipants = useRemoteParticipants();
  const assistantParticipant = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([]);
  const [mode, setMode] = useState<'idle' | 'recording' | 'processing' | 'speaking'>('idle');
  const [sessionId, setSessionId] = useState('');
  const [timerDisplay, setTimerDisplay] = useState('00:00');

  const messagesRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const timerIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isConnected) {
      startedAtRef.current = Date.now();
      timerIvRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        setTimerDisplay(`${mm}:${ss}`);
      }, 500);
    } else {
      if (timerIvRef.current) clearInterval(timerIvRef.current);
      setTimerDisplay('00:00');
    }
    return () => { if (timerIvRef.current) clearInterval(timerIvRef.current); };
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n);
      setSessionId(`${rand(4)}·${rand(2)}`);
    }
  }, [isConnected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use ResizeObserver so we always have correct dimensions after layout
    let animW = 0, animH = 0;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      animW = width;
      animH = height;
    });
    ro.observe(canvas);

    function draw(t: number) {
      if (!animW || !animH) { rafRef.current = requestAnimationFrame(draw); return; }
      const cx = animW / 2;
      const cy = animH / 2;
      const baseR = Math.min(animW, animH) * 0.30;
      ctx.clearRect(0, 0, animW, animH);

      for (let L = 0; L < LAYERS.length; L++) {
        const layer = LAYERS[L];
        ctx.beginPath();
        for (let i = 0; i <= BANDS; i++) {
          const ang = (i / BANDS) * Math.PI * 2;
          const noise = 0.5 + 0.5 * Math.sin(t * layer.speed + i * 0.23 + L);
          const puff = Math.pow(noise, 2) * layer.amp * 0.7;
          const r = baseR + layer.rOffset + puff;
          const x = cx + Math.cos(ang) * r;
          const y = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const grad = ctx.createLinearGradient(cx - baseR, cy, cx + baseR, cy);
        grad.addColorStop(0, `hsla(${HUEBASE - 20}, 90%, 72%, ${layer.a})`);
        grad.addColorStop(0.5, `hsla(${HUEBASE}, 90%, 72%, ${layer.a})`);
        grad.addColorStop(1, `hsla(${HUEBASE + 30}, 90%, 72%, ${layer.a})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = layer.w;
        ctx.shadowColor = `hsla(${HUEBASE}, 90%, 70%, ${layer.a * 0.9})`;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !room) return;

    const onData = (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      try {
        const raw = new TextDecoder().decode(payload);
        const data = JSON.parse(raw) as { type?: string; text?: string };
        const fromKnownTopic = topic === 'voice-text' || topic === undefined || topic === '';
        if (!fromKnownTopic || !data?.type) return;

        if (data.type === 'interrupt') {
          const assistant = Array.from(room.remoteParticipants.values())[0];
          const audioTrack = assistant?.getTrackPublication(Track.Source.Microphone)?.audioTrack;
          if (audioTrack) {
            audioTrack.setVolume(0);
            setTimeout(() => audioTrack.setVolume(1), 150);
          }
          setAssistantIsSpeaking(false);
          setMode('recording');
          return;
        }

        const text = data.text;
        if (!text) return;

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const time = `${hh}:${mm}`;

        if (data.type === 'stt') {
          setMessages(prev => [...prev, { role: 'user', text, time }]);
          setMode('processing');
          return;
        }
        if (data.type === 'assistant') {
          setMessages(prev => [...prev, { role: 'assistant', text, time }]);
        }
      } catch (err) {
        console.error('Failed to parse data message', err);
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, isConnected]);

  useEffect(() => {
    if (!isConnected) setMessages([]);
  }, [isConnected]);

  useEffect(() => {
    if (!assistantParticipant) { setAssistantIsSpeaking(false); return; }
    const onSpeaking = (speaking: boolean) => setAssistantIsSpeaking(speaking);
    assistantParticipant.on(ParticipantEvent.IsSpeakingChanged, onSpeaking);
    setAssistantIsSpeaking(assistantParticipant.isSpeaking);
    return () => { assistantParticipant.off(ParticipantEvent.IsSpeakingChanged, onSpeaking); };
  }, [assistantParticipant]);

  useEffect(() => {
    if (!isConnected) {
      if (!isConnecting) setMode('idle');
      return;
    }
    if (assistantIsSpeaking) {
      setMode('speaking');
    } else if (mode !== 'processing') {
      setMode('recording');
    }
  }, [assistantIsSpeaking, isConnected, isConnecting]);

  const vbStateText =
    mode === 'speaking'   ? 'Speaking' :
    mode === 'processing' ? 'Thinking'  :
    'Listening';

  const vbSubText =
    mode === 'speaking'   ? 'Jarvis is speaking…'       :
    mode === 'processing' ? 'Processing your request…'  :
    "Go ahead, I'm listening…";

  const handleConnectClick = () => {
    if (isConnected) onDisconnect();
    else if (!isConnecting) connectAgent();
  };

  return (
    <div className="app-container">
      <div className="bg" />

      <header className="topbar">
        <div className="brand">
          {/* Logo icon: sound wave bars */}
          <div className="logo">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3"  y="10" width="3" height="8"  rx="1.5" fill="white" opacity="0.7"/>
              <rect x="8"  y="6"  width="3" height="16" rx="1.5" fill="white"/>
              <rect x="13" y="3"  width="3" height="22" rx="1.5" fill="white"/>
              <rect x="18" y="7"  width="3" height="14" rx="1.5" fill="white"/>
              <rect x="23" y="11" width="3" height="6"  rx="1.5" fill="white" opacity="0.7"/>
            </svg>
          </div>
          <div>
            <div className="brand-name">Jarvis</div>
            <div className="brand-tag">WSO2 Expert Voice Assistant · Powered by Ballerina</div>
          </div>
        </div>
        <div className="top-right">
          {error && <div className="error-chip">{error}</div>}
          <div className={`status-chip${isConnected ? ' live' : ''}`}>
            <span className="dot" />
            <span>{isConnected ? 'Live' : isConnecting ? 'Connecting…' : 'Offline'}</span>
          </div>
          <button
            className={`connect-btn${isConnected ? ' danger' : ''}`}
            onClick={handleConnectClick}
            disabled={isConnecting && !isConnected}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
            <span>{isConnected ? 'End Session' : isConnecting ? 'Connecting…' : 'Start Session'}</span>
          </button>
        </div>
      </header>

      <main className="stage">

        {/* IDLE VIEW */}
        <section className={`idle-view${isConnecting || isConnected ? ' hide' : ''}`}>
          <div className="orb-wrap">
            <div className="ring r1" />
            <div className="ring r2"><span className="orbit-dot" /></div>
            <div className="ring r3"><span className="orbit-dot cyan" /></div>
            <canvas ref={canvasRef} className="wave-ring" />
            <div className="orb-core" />
          </div>
          <div className="idle-caption">
            <h1>Say hello to Jarvis</h1>
            <p>Your WSO2 expert assistant. Press <strong>Start Session</strong> to ask about API Manager, Identity Server, Choreo, and more.</p>
          </div>
        </section>

        {/* LOADING VIEW */}
        <section className={`loading-view${isConnecting && !isConnected ? ' show' : ''}`}>
          <div className="loading-orb">
            <div className="loading-pulse" />
          </div>
          <p className="loading-label">Starting session…</p>
        </section>

        {/* CHAT VIEW */}
        <section className={`chat-view${isConnected ? ' show' : ''}`}>
          <div className="chat-head">
            <div className="session">
              <div className="mini-orb" />
              <div className="session-info">
                <div className="label">Jarvis</div>
                <div className="session-sub">Session</div>
              </div>
            </div>
            <div className="timer">
              <span className="rec" />
              <span>{timerDisplay}</span>
            </div>
          </div>

          <div className="messages" ref={messagesRef}>
            {messages.length === 0 && (
              <div className="messages-empty">Start speaking to see the conversation here…</div>
            )}
            {messages.map((msg, i) => {
              const isAgent = msg.role === 'assistant';
              const prev = messages[i - 1];
              const grouped = prev && prev.role === msg.role;
              return (
                <div key={i} className={`msg ${isAgent ? 'agent' : 'user'}${grouped ? ' grouped' : ''}`}>
                  {!grouped && (
                    <div className="msg-meta">
                      <span className="msg-author">{isAgent ? 'Jarvis' : 'You'}</span>
                      <span className="msg-time">{msg.time}</span>
                    </div>
                  )}
                  <div className="bubble">{msg.text}</div>
                </div>
              );
            })}
          </div>

          <div className="voice-bar">
            <div className="vb-orb" />
            <div className="vb-label">
              <div className="state">{vbStateText}</div>
              <div className="sub">{vbSubText}</div>
            </div>
            <div className="vb-bars">
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <span
                  key={i}
                  className={`bar bar-${mode}`}
                  style={{ animationDelay: `${((i * 0.08) % 1.4).toFixed(2)}s` }}
                />
              ))}
            </div>
          </div>
        </section>

      </main>

      <RoomAudioRenderer />
    </div>
  );
}

function App() {
  const [connectionDetails, setConnectionDetails] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const connect = useCallback(async () => {
    if (connectionDetails) return;
    try {
      setIsFetching(true);
      setError(null);
      const data = await fetchConnectionDetails('user');
      setConnectionDetails(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Token fetch error:', msg);
      setError(msg);
    } finally {
      setIsFetching(false);
    }
  }, [connectionDetails]);

  const disconnect = useCallback(() => {
    setConnectionDetails(null);
  }, []);

  return (
    <LiveKitRoom
      token={connectionDetails?.token}
      serverUrl={connectionDetails?.url}
      connect={!!connectionDetails}
      audio={true}
      onDisconnected={disconnect}
    >
      <AssistantUI connectAgent={connect} onDisconnect={disconnect} isFetching={isFetching} error={error} />
    </LiveKitRoom>
  );
}

export default App;
