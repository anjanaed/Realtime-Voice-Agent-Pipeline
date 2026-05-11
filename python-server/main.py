import asyncio
import json
import logging
import os

from dotenv import load_dotenv

from livekit import rtc
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    WorkerType,
)
from livekit.plugins import silero, deepgram, cartesia

from ballerina_llm import BallerinaLLM

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("livekit").setLevel(logging.INFO)
logging.getLogger("livekit.agents").setLevel(logging.INFO)
logging.getLogger("livekit.plugins").setLevel(logging.INFO)
for noisy in ("websockets", "httpx", "httpcore", "aiohttp", "openai", "urllib3", "asyncio"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "ws://localhost:8003/llm")
CARTESIA_API_KEY = os.getenv("CARTESIA_2")
LIVEKIT_ROOM = os.getenv("LIVEKIT_ROOM", "voice-room")


async def _publish(room: rtc.Room, msg_type: str, text: str):
    payload = json.dumps({"type": msg_type, "text": text}).encode("utf-8")
    try:
        await room.local_participant.publish_data(
            payload, reliable=True, topic="voice-text"
        )
    except Exception as e:
        print(f"[Data] publish failed: {e}")


def wire_events(session: AgentSession, room: rtc.Room):
    loop = asyncio.get_running_loop()

    @session.on("user_input_transcribed")
    def _on_user(ev):
        if not getattr(ev, "is_final", False):
            return
        transcript = (getattr(ev, "transcript", "") or "").strip()
        if not transcript:
            return
        print(f"[STT] {transcript}")
        loop.create_task(_publish(room, "stt", transcript))

    @session.on("agent_state_changed")
    def _on_state(ev):
        new_state = getattr(ev, "new_state", None)
        old_state = getattr(ev, "old_state", None)
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
    ballerina_llm = BallerinaLLM(
        url=LLM_SERVICE_URL,
        on_response=lambda text: loop.create_task(_publish(room, "assistant", text)),
    )

    session = AgentSession(
        stt=deepgram.STT(api_key=DEEPGRAM_API_KEY, model="nova-3", language="en"),
        llm=ballerina_llm,
        tts=cartesia.TTS(
            api_key=CARTESIA_API_KEY,
            model="sonic-3",
            voice="2c239000-fbd8-4430-83e6-b43a835ef62c",
        ),
        vad=silero.VAD.load(
            activation_threshold=0.5,
            min_speech_duration=0.8,
            min_silence_duration=0.5,
            prefix_padding_duration=0.4,
        ),
    )
    wire_events(session, room)

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
        agent=Agent(instructions="You are Jarvis, a WSO2 expert voice assistant. Response generation is handled by the Ballerina LLM backend."),
    )
    print("\n✓ Agent ready\n")


if __name__ == "__main__":
    agents.cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            agent_name="voice-agent",
            num_idle_processes=0,
            load_threshold=1.0,
            drain_timeout=1800,
        )
    )