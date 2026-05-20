import os
import asyncio
import json
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

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

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("livekit.agents").setLevel(logging.WARNING)
logging.getLogger("livekit.rtc").setLevel(logging.WARNING)

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

    def log_tracking(msg: str):
        nonlocal last_event_ts
        now = time.perf_counter() * 1000.0
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        delta = f"+{now - last_event_ts:.0f}ms"
        last_event_ts = now
        print(f"TRACKING [{timestamp}] ({delta}) {msg}")

    @session.on("user_state_changed")
    def _on_user_state_changed(ev):
        if ev.new_state == "speaking":
            log_tracking("VAD: User started speaking")
        elif ev.new_state == "listening" and ev.old_state == "speaking":
            log_tracking("VAD: User stopped speaking (turn closed)")

    @session.on("user_input_transcribed")
    def _on_user_transcribed(ev):
        if not getattr(ev, "is_final", False):
            return
        transcript = (getattr(ev, "transcript", "") or "").strip()
        if not transcript:
            return
        log_tracking(f"STT final result: '{transcript[:50]}'")
        loop.create_task(_publish(room, "stt", transcript))

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

    @session.on("metrics_collected")
    def _on_metrics(ev):
        m    = ev.metrics
        kind = type(m).__name__

        if "EOUMetrics" in kind:
            eou_ms   = getattr(m, "end_of_utterance_delay", 0) * 1000
            trans_ms = getattr(m, "transcription_delay", 0) * 1000
            log_tracking(f"[EOU]  endpointing_delay={eou_ms:.0f}ms  transcription_delay={trans_ms:.0f}ms")

        elif "STTMetrics" in kind:
            audio_dur = getattr(m, "audio_duration", 0)
            duration  = getattr(m, "duration", 0)
            log_tracking(f"[STT]  audio_duration={audio_dur:.2f}s  processing_time={duration:.2f}s")

        elif "LLMMetrics" in kind:
            ttft_ms    = getattr(m, "ttft", 0) * 1000
            tokens_in  = getattr(m, "prompt_tokens", "?")
            tokens_out = getattr(m, "completion_tokens", "?")
            log_tracking(f"[LLM]  ttft={ttft_ms:.0f}ms  tokens_in={tokens_in}  tokens_out={tokens_out}")

        elif "TTSMetrics" in kind:
            ttfb_ms   = getattr(m, "ttfb", 0) * 1000
            audio_dur = getattr(m, "audio_duration", 0)
            log_tracking(f"[TTS]  ttfb={ttfb_ms:.0f}ms  audio_duration={audio_dur:.2f}s")


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