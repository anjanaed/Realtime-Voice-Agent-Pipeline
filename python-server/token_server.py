import asyncio
import datetime
import os
import threading

from aiohttp import web
import aiohttp_cors
from dotenv import load_dotenv
from livekit import api

load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_ROOM = os.getenv("LIVEKIT_ROOM", "voice-room")

# The voice agent registers as an explicit-dispatch worker under this name;
# it must match the agent_name the worker registers with.
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "voice-agent")

# How long an issued token stays valid, in seconds. Overridable per request
# via ?ttl=. Defaults to 1 hour (the LiveKit SDK's own default is 6h).
DEFAULT_TOKEN_TTL = int(os.getenv("LIVEKIT_TOKEN_TTL", "3600"))

# How long LiveKit keeps an empty room alive before closing it, in seconds.
# Overridable per request via ?emptyTimeout=. Defaults to 5 minutes.
DEFAULT_EMPTY_TIMEOUT = int(os.getenv("LIVEKIT_EMPTY_TIMEOUT", "300"))

# Comma-separated list of CORS origins allowed to call the token endpoint.
# Defaults to "*" (any origin). For production, pin it to your frontend(s), e.g.
#   CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]


def _query_int(request, name, default):
    """Read a positive integer query param, falling back to `default` when it
    is absent, non-numeric, or non-positive."""
    raw = request.query.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


async def handle_token(request):
    room_name = request.query.get("roomName") or LIVEKIT_ROOM
    participant_name = request.query.get("participantName", "user")
    ttl_seconds = _query_int(request, "ttl", DEFAULT_TOKEN_TTL)
    empty_timeout = _query_int(request, "emptyTimeout", DEFAULT_EMPTY_TIMEOUT)

    missing = [
        name
        for name, value in {
            "LIVEKIT_URL": LIVEKIT_URL,
            "LIVEKIT_API_KEY": LIVEKIT_API_KEY,
            "LIVEKIT_API_SECRET": LIVEKIT_API_SECRET,
        }.items()
        if not value
    ]
    if missing:
        print(f"[TokenServer] Missing env vars: {', '.join(missing)}")
        return web.json_response(
            {"error": "Missing LiveKit credentials", "missing": missing},
            status=500,
        )

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(participant_name)
        .with_name(participant_name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                # Voice pipeline: restrict publishing to the microphone only.
                # can_publish_sources supersedes can_publish, so the client
                # cannot publish camera or screen-share video.
                can_publish_sources=["microphone"],
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_ttl(datetime.timedelta(seconds=ttl_seconds))
        # Embed the agent dispatch in the token instead of making a separate
        # API call. When the user connects, LiveKit creates the room and places
        # a "voice-agent" instance into it; empty_timeout closes the room once
        # everyone (including the agent) has left. The room config is applied
        # only when the room is first created.
        .with_room_config(
            api.RoomConfiguration(
                empty_timeout=empty_timeout,
                agents=[api.RoomAgentDispatch(agent_name=AGENT_NAME)],
            )
        )
    )

    print(
        f"[TokenServer] Issued token for '{participant_name}' room='{room_name}' "
        f"ttl={ttl_seconds}s emptyTimeout={empty_timeout}s agent='{AGENT_NAME}'"
    )
    return web.json_response({"token": token.to_jwt(), "url": LIVEKIT_URL})


async def handle_health(request):
    # Liveness/readiness probe. Stays cheap and side-effect free so it is safe
    # for orchestrators to poll frequently.
    return web.Response(text="ok")


async def run_token_server():
    app = web.Application()
    cors = aiohttp_cors.setup(
        app,
        defaults={
            origin: aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
            for origin in CORS_ALLOWED_ORIGINS
        },
    )
    app.router.add_get("/health", handle_health)  # plain route, no CORS needed
    cors.add(app.router.add_get("/getToken", handle_token))

    runner = web.AppRunner(app)
    await runner.setup()
    # Clients fetch a token from GET http://<host>:8006/getToken
    site = web.TCPSite(runner, "0.0.0.0", 8006)
    await site.start()
    print("[TokenServer] Listening on http://0.0.0.0:8006")
    print(f"[TokenServer] CORS allowed origins: {', '.join(CORS_ALLOWED_ORIGINS)}")


def start_token_server_in_thread():
    """Run the aiohttp token server in its own thread + event loop so it
    starts at worker boot (the agents CLI takes over the main loop)."""

    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_token_server())
        loop.run_forever()

    t = threading.Thread(target=_run, daemon=True, name="token-server")
    t.start()


if __name__ == "__main__":
    async def _main():
        await run_token_server()
        # Keep the server alive until interrupted.
        await asyncio.Event().wait()

    try:
        asyncio.run(_main())
    except KeyboardInterrupt:
        pass
