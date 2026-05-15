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
from livekit.plugins import silero, deepgram, cartesia, elevenlabs
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from ballerina_llm import BallerinaLLM

load_dotenv()

# Formatting for the specific tracking logs
logging.basicConfig(level=logging.INFO, format="%(message)s")
TRACKING_LOG = logging.getLogger("TRACKING")

def log_tracking(msg: str):
    """Utility to print the specific TRACKING logs you requested."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"TRACKING [{timestamp}] {msg}")

# --- Environment Variables ---
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY")
LIVEKIT_URL      = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY  = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
CARTESIA_API_KEY = os.getenv("CARTESIA_2")
LLM_SERVICE_URL  = os.getenv("LLM_SERVICE_URL", "ws://localhost:8003/llm")
ELEVENLABS_STT_LANGUAGE = os.getenv("ELEVENLABS_STT_LANGUAGE", "en")
ELEVENLABS_STT_MODEL_ID = os.getenv("ELEVENLABS_STT_MODEL_ID", "scribe_v2_realtime")

def _now_ms() -> float:
    return time.perf_counter() * 1000.0

async def _publish(room: rtc.Room, msg_type: str, text: str):
    payload = json.dumps({"type": msg_type, "text": text}).encode("utf-8")
    try:
        await room.local_participant.publish_data(payload, reliable=True, topic="voice-text")
    except Exception as e:
        pass

def wire_events(
    session: AgentSession,
    room: rtc.Room,
    latency_state: dict,
):
    loop = asyncio.get_running_loop()

    @session.on("user_speech_committed")
    def _on_speech_committed(ev):
        # 1. Time it first detects voice / 2. Hits VAD
        log_tracking("Voice Stream Detected & VAD Committed")

    @session.on("user_input_transcribed")
    def _on_user_transcribed(ev):
        if not getattr(ev, "is_final", False):
            return
        
        transcript = (getattr(ev, "transcript", "") or "").strip()
        if not transcript:
            return

        # 3. Time it went to STT (implicitly just before this) 
        # 4. Time it came back from STT as text
        log_tracking(f"STT Completed (Result: '{transcript[:30]}...')")
        
        # 5. Time it goes to LLM
        log_tracking("Forwarding transcript to LLM")
        loop.create_task(_publish(room, "stt", transcript))

    @session.on("llm_first_token")
    def _on_llm_first_token(ev):
        # 6. Time it comes from LLM (first response chunk)
        log_tracking("LLM Response Started (First Token Received)")

    @session.on("speech_created")
    def _on_speech_created(ev):
        # 7. Time it goes to TTS
        log_tracking("Text sent to TTS Engine")

    # Hooking into the TTS plugin specifically for completion
    @session.tts.on("metrics_collected")
    def _on_tts_metrics(ev):
        # 8. Time it came back from TTS
        ttfb = getattr(ev, "ttfb", 0) * 1000.0
        log_tracking(f"TTS Audio Generation Completed (TTFB: {ttfb:.2f}ms)")

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    room = ctx.room
    print(f"[LiveKit] Connected to {room.name}")
    await ctx.wait_for_participant()

    loop = asyncio.get_running_loop()
    latency_state = {"turn": 0}

    ballerina_llm = BallerinaLLM(
        url=LLM_SERVICE_URL,
        on_response=lambda text: loop.create_task(_publish(room, "assistant", text)),
    )

    session = AgentSession(
        stt=deepgram.STT(api_key=DEEPGRAM_API_KEY, model="nova-3", language="en"),
        llm=ballerina_llm,
        tts=deepgram.TTS(
            api_key=DEEPGRAM_API_KEY,
            model="aura-2-asteria-en"
        ),
        vad=silero.VAD.load(
            activation_threshold=0.5,
            min_speech_duration=0.8,
            min_silence_duration=0.5,
            prefix_padding_duration=0.4,
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
            allow_interruptions=True,
            endpointing={
                "mode": "dynamic",
                "min_delay": 0.2,
                "max_delay": 2.0,
            },
        ),
    )

    wire_events(session, room, latency_state)

    # Audio playback tracking
    async def _attach_audio_output_hooks():
        while session.output.audio is None:
            await asyncio.sleep(0.05)
        
        @session.output.audio.on("playback_started")
        def _on_playback_started(ev):
            log_tracking("TTS Playback started (Audio hitting speakers)")

    loop.create_task(_attach_audio_output_hooks())

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