import os
import asyncio
import json
import logging
import time
import warnings
from datetime import datetime
from dotenv import load_dotenv

# Suppress deprecation warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*metrics_collected.*")

from opentelemetry.sdk.trace import TracerProvider
from livekit.agents.telemetry import set_tracer_provider
set_tracer_provider(TracerProvider())

import livekit.agents.telemetry.traces as _lk_traces
async def _noop(*args, **kwargs): pass
_lk_traces._upload_session_report = _noop

from livekit import rtc
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    WorkerType,
    TurnHandlingOptions,
)
from livekit.plugins import silero, deepgram

from ballerina_llm import BallerinaLLM

load_dotenv()

# Custom log filter to remove unwanted logs
class LogFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        if "_SegmentSynchronizerImpl.on_playback_started called after start_fut is set" in msg:
            return False
        if "metrics_collected is deprecated" in msg:
            return False
        return True

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("livekit.agents").setLevel(logging.WARNING)
logging.getLogger("livekit.agents").addFilter(LogFilter())
logging.getLogger("livekit.rtc").setLevel(logging.WARNING)
logging.getLogger("livekit.rtc").addFilter(LogFilter())
logging.getLogger().addFilter(LogFilter())

async def _publish(room: rtc.Room, msg_type: str, text: str):
    payload = json.dumps({"type": msg_type, "text": text}).encode("utf-8")
    try:
        await room.local_participant.publish_data(payload, reliable=True, topic="voice-text")
    except Exception:
        pass

def wire_events(session: AgentSession, room: rtc.Room):
    loop = asyncio.get_running_loop()
    
    # Thread-safe local tracking counter
    last_event_ts = time.perf_counter() * 1000.0
    
    first_interim_logged = False
    user_speech_start_time = None
    turn_complete_logs = []

    def log_tracking(msg: str):
        nonlocal last_event_ts
        now = time.perf_counter() * 1000.0
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        delta = f"+{now - last_event_ts:.0f}ms"
        last_event_ts = now
        print(f"TRACKING [{timestamp}] ({delta}) {msg}")

    async def monitor_webrtc_health():
        try:
            stats = await room.get_rtc_stats()
            audio_stats = []
            for s in stats.subscriber_stats:
                if s.HasField("inbound_rtp") and s.inbound_rtp.stream.kind == "audio":
                    inbound = s.inbound_rtp
                    packet_loss = inbound.received.packets_lost
                    jitter_ms = inbound.received.jitter * 1000.0
                    packets_discarded = inbound.inbound.packets_discarded
                    audio_stats.append(
                        f"Loss: {packet_loss} | Jitter: {jitter_ms:.1f}ms | Discarded: {packets_discarded}"
                    )
            transport_msg = " | ".join(audio_stats) if audio_stats else "No audio inbound stats"
            
            stt_backlog = 0
            if hasattr(session, "stt") and hasattr(session.stt, "_streams"):
                for stream in session.stt._streams:
                    if hasattr(stream, "_input_ch"):
                        stt_backlog += stream._input_ch.qsize()
            
            asyncio_tasks = len(asyncio.all_tasks())
            
            log_tracking(
                f"[DIAGNOSTICS] "
                f"WebRTC: {transport_msg} | "
                f"STT Queue Backlog: {stt_backlog} | "
                f"Asyncio Tasks: {asyncio_tasks}"
            )
        except Exception:
            pass

    @session.on("user_state_changed")
    def _on_user_state_changed(ev):
        nonlocal user_speech_start_time, first_interim_logged
        if ev.new_state == "speaking":
            user_speech_start_time = time.perf_counter()
            first_interim_logged = False
            log_tracking("[VAD] Active speech stream opened.")
        elif ev.new_state == "listening" and ev.old_state == "speaking":
            log_tracking("[VAD] Speech boundary closed. Awaiting pipeline execution...")

    @session.on("user_input_transcribed")
    def _on_user_transcribed(ev):
        nonlocal first_interim_logged, user_speech_start_time
        if not ev.is_final:
            transcript = (ev.transcript or "").strip()
            if transcript and user_speech_start_time is not None and not first_interim_logged:
                delta_ms = (time.perf_counter() - user_speech_start_time) * 1000.0
                log_tracking(f"[VAD-STT] Time to first interim result: {delta_ms:.0f}ms | Transcript: '{transcript[:50]}'")
                first_interim_logged = True
            return
            
        transcript = (getattr(ev, "transcript", "") or "").strip()
        if not transcript:
            return
        log_tracking(f"STT final result: '{transcript[:50]}'")
        loop.create_task(_publish(room, "stt", transcript))

    @session.on("conversation_item_added")
    def _on_conversation_item_added(ev):
        item = ev.item
        if hasattr(item, "role") and item.role == "assistant" and getattr(item, "metrics", None):
            turn_metrics = item.metrics
            
            stt_delay = 0.0
            for msg in reversed(session._chat_ctx.messages()):
                if msg.role == "user":
                    stt_delay = msg.metrics.get("transcription_delay", 0.0)
                    break
                    
            llm_ttft = turn_metrics.get("llm_node_ttft", 0.0)
            tts_ttfb = turn_metrics.get("tts_node_ttfb", 0.0)
            e2e_total = turn_metrics.get("e2e_latency", 0.0)
            
            turn_log = (
                f"[TURN COMPLETE] "
                f"STT: {stt_delay*1000:.0f}ms | "
                f"LLM TTFT: {llm_ttft*1000:.0f}ms | "
                f"TTS TTFB: {tts_ttfb*1000:.0f}ms | "
                f"Total E2E: {e2e_total*1000:.0f}ms"
            )
            turn_complete_logs.append(turn_log)
            
            all_logs = "\n".join(turn_complete_logs)
            log_tracking(f"\n{all_logs}")
            
            loop.create_task(monitor_webrtc_health())

    @session.on("llm_first_token")
    def _on_llm_first_token(ev):
        log_tracking("LLM first token received")

    @session.on("speech_created")
    def _on_speech_created(ev):
        log_tracking("Speech created → sending to TTS")

    @session.tts.on("metrics_collected")
    def _on_tts_metrics(ev):
        ttfb = getattr(ev, "ttfb", 0) * 1000.0
        log_tracking(f"TTS generation done (TTFB: {ttfb:.0f}ms)")


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    room = ctx.room
    print(f"[LiveKit] Connected to {room.name}")
    await ctx.wait_for_participant()

    loop = asyncio.get_running_loop()

    ballerina_llm = BallerinaLLM(
        url=os.getenv("LLM_SERVICE_URL", "ws://localhost:8003/llm"),
        on_response=lambda text: loop.create_task(_publish(room, "assistant", text)),
    )

    session = AgentSession(
        stt=deepgram.STT(api_key=os.getenv("DEEPGRAM_API_KEY"), model="nova-3", language="en"),
        llm=ballerina_llm,
        tts=deepgram.TTS(api_key=os.getenv("DEEPGRAM_API_KEY"), model="aura-2-asteria-en"),
        vad=silero.VAD.load(
            activation_threshold=0.4,
            min_speech_duration=0.1,    
            min_silence_duration=0.3,   
            prefix_padding_duration=0.2,
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection="vad",      
            allow_interruptions=True,
            endpointing={
                "mode": "fixed",
                "min_delay": 0.5,       
                "max_delay": 0.8,       
            },
        ),
    )


    wire_events(session, room)

    async def _on_shutdown():
        await session.aclose()
        await ballerina_llm.aclose()

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(
        room=room,
        agent=Agent(instructions="You are Jarvis, a WSO2 expert voice assistant."),
    )
    print("\n✓ Agent ready and tracking...\n")

if __name__ == "__main__":
    agents.cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="voice-agent",
        )
    )