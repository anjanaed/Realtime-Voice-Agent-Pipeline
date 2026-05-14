import os


from opentelemetry.sdk.trace import TracerProvider
from livekit.agents.telemetry import set_tracer_provider
set_tracer_provider(TracerProvider())  

import livekit.agents.telemetry.traces as _lk_traces
async def _noop(*args, **kwargs): pass
_lk_traces._upload_session_report = _noop 

import asyncio
import json
import logging
import time

from dotenv import load_dotenv

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
from livekit.plugins import silero, deepgram, cartesia
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from ballerina_llm import BallerinaLLM

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("livekit").setLevel(logging.INFO)
logging.getLogger("livekit.agents").setLevel(logging.INFO)
logging.getLogger("livekit.plugins").setLevel(logging.INFO)
for noisy in ("websockets", "httpx", "httpcore", "aiohttp", "openai", "urllib3", "asyncio"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

LATENCY_LOG = logging.getLogger("latency")

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY")
LIVEKIT_URL      = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY  = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LLM_SERVICE_URL  = os.getenv("LLM_SERVICE_URL", "ws://localhost:8003/llm")
CARTESIA_API_KEY = os.getenv("CARTESIA_2")
LIVEKIT_ROOM     = os.getenv("LIVEKIT_ROOM", "voice-room")


def _now_ms() -> float:
    return time.perf_counter() * 1000.0


def _preview_text(text: str, limit: int = 120) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit] + "..."


def _fmt_ms(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value * 1000.0:.1f}"


def _ms_since(start_ms: float | None) -> str:
    if start_ms is None:
        return "n/a"
    return f"{_now_ms() - start_ms:.1f}"


async def _publish(room: rtc.Room, msg_type: str, text: str):
    payload = json.dumps({"type": msg_type, "text": text}).encode("utf-8")
    try:
        await room.local_participant.publish_data(
            payload, reliable=True, topic="voice-text"
        )
    except Exception as e:
        print(f"[Data] publish failed: {e}")


def wire_events(
    session: AgentSession,
    room: rtc.Room,
    latency_state: dict[str, float | int | None],
):
    loop = asyncio.get_running_loop()

    @session.on("user_state_changed")
    def _on_user_state(ev):
        new_state = getattr(ev, "new_state", None)
        if new_state == "speaking":
            latency_state["turn"] = int(latency_state.get("turn", 0)) + 1
            latency_state["speech_start_ms"] = _now_ms()
            LATENCY_LOG.info("[Turn %s] VAD start (user speaking)", latency_state["turn"])
        elif new_state == "listening":
            LATENCY_LOG.info(
                "[Turn %s] VAD end (ms=%s)",
                latency_state.get("turn", 0),
                _ms_since(latency_state.get("speech_start_ms")),
            )

    @session.on("user_input_transcribed")
    def _on_user(ev):
        if not getattr(ev, "is_final", False):
            return
        transcript = (getattr(ev, "transcript", "") or "").strip()
        if not transcript:
            return
        LATENCY_LOG.info(
            "[Turn %s] STT final (ms=%s, text=%s)",
            latency_state.get("turn", 0),
            _ms_since(latency_state.get("speech_start_ms")),
            _preview_text(transcript),
        )
        print(f"[STT] {transcript}")
        loop.create_task(_publish(room, "stt", transcript))

    @session.on("speech_created")
    def _on_speech_created(ev):
        handle = getattr(ev, "speech_handle", None)
        speech_id = getattr(handle, "id", None)
        source = getattr(ev, "source", None)
        LATENCY_LOG.info(
            "[Turn %s] TTS queued (source=%s, speech_id=%s)",
            latency_state.get("turn", 0),
            source,
            speech_id,
        )

    @session.on("agent_state_changed")
    def _on_state(ev):
        new_state = getattr(ev, "new_state", None)
        old_state = getattr(ev, "old_state", None)
        if new_state == "speaking":
            LATENCY_LOG.info("[Turn %s] Agent speaking", latency_state.get("turn", 0))
        if new_state == "listening" and old_state == "speaking":
            loop.create_task(_publish(room, "interrupt", ""))


async def entrypoint(ctx: JobContext):
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set")
        return

    print("─" * 50)
    print("  Voice Agent (AgentSession worker)")
    print(f"  LLM: {LLM_SERVICE_URL}")
    print("─" * 50)

    await ctx.connect()
    room = ctx.room
    print(f"[LiveKit] Connected — room: {room.name}, waiting for participant...")
    await ctx.wait_for_participant()
    print("[LiveKit] Participant joined")

    loop = asyncio.get_running_loop()
    latency_state: dict[str, float | int | None] = {"turn": 0, "speech_start_ms": None}

    ballerina_llm = BallerinaLLM(
        url=LLM_SERVICE_URL,
        on_response=lambda text: loop.create_task(_publish(room, "assistant", text)),
    )

    tts_engine = cartesia.TTS(
        api_key=CARTESIA_API_KEY,
        model="sonic-3",
        voice="2c239000-fbd8-4430-83e6-b43a835ef62c",
    )

    @tts_engine.on("metrics_collected")
    def _on_tts_metrics(ev):
        LATENCY_LOG.info(
            "[Turn %s] TTS metrics (ttfb_ms=%s, duration_ms=%s, audio_s=%s, chars=%s)",
            latency_state.get("turn", 0),
            _fmt_ms(getattr(ev, "ttfb", None)),
            _fmt_ms(getattr(ev, "duration", None)),
            f"{getattr(ev, 'audio_duration', 0.0):.2f}",
            getattr(ev, "characters_count", None),
        )

    session = AgentSession(
        stt=deepgram.STT(api_key=DEEPGRAM_API_KEY, model="nova-3", language="en"),
        llm=ballerina_llm,
        tts=deepgram.TTS(api_key=DEEPGRAM_API_KEY),
        vad=silero.VAD.load(
            activation_threshold=0.5,
            min_speech_duration=0.8,
            min_silence_duration=0.5,
            prefix_padding_duration=0.4,
        ),

        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
            allow_interruptions=True,
            min_interruption_duration=0.5,
            min_interruption_words=1,
            false_interruption_timeout=1.5,
            resume_false_interruption=True,
            discard_audio_if_uninterruptible=False,
            endpointing={
                "mode": "dynamic",
                "min_delay": 0.2,
                "max_delay": 2.0,
            },
        ),
        # ─────────────────────────────────────────────────────────
    )

    wire_events(session, room, latency_state)

    async def _attach_audio_output_hooks():
        while session.output.audio is None:
            await asyncio.sleep(0.05)
        audio_output = session.output.audio
        if audio_output is None:
            return

        @audio_output.on("playback_started")
        def _on_playback_started(ev):
            LATENCY_LOG.info(
                "[Turn %s] TTS playback started (sending audio)",
                latency_state.get("turn", 0),
            )

        @audio_output.on("playback_finished")
        def _on_playback_finished(ev):
            LATENCY_LOG.info(
                "[Turn %s] TTS playback finished (interrupted=%s, played=%.2fs)",
                latency_state.get("turn", 0),
                getattr(ev, "interrupted", False),
                getattr(ev, "playback_position", 0.0),
            )

    loop.create_task(_attach_audio_output_hooks())

    async def _on_shutdown():
        try:
            await session.aclose()
        except Exception:
            pass
        try:
            await ballerina_llm.aclose()
        except Exception:
            pass

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(
        room=room,
        agent=Agent(
            instructions="You are Jarvis, a WSO2 expert voice assistant. Response generation is handled by the Ballerina LLM backend.",
        ),
    )
    print("\n✓ Agent ready\n")


if __name__ == "__main__":
    agents.cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="voice-agent",
            num_idle_processes=1,
            load_threshold=1.0,
            drain_timeout=1800,
        )
    )