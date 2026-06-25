import asyncio
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


async def handle_token(request):
    room_name = request.query.get("roomName") or LIVEKIT_ROOM
    participant_name = request.query.get("participantName", "user")

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
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
    )

    lkapi = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )
    # The voice agent registers as an explicit-dispatch worker, so it does not
    # auto-join rooms. Ask LiveKit to place a "voice-agent" instance into this
    # room; without this the user would connect to an empty room.
    try:
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(room=room_name, agent_name="voice-agent")
        )
        print(f"[TokenServer] Dispatched agent to room: {room_name}")
    except Exception as e:
        # Non-fatal: an agent may already be in the room. Still return the token.
        print(f"[TokenServer] Agent dispatch warning: {e}")
    finally:
        await lkapi.aclose()

    return web.json_response({"token": token.to_jwt(), "url": LIVEKIT_URL})


async def handle_health(request):
    # Liveness/readiness probe. Stays cheap and side-effect free (unlike
    # /getToken, which dispatches an agent) so it is safe for orchestrators
    # to poll frequently.
    return web.Response(text="ok")


async def run_token_server():
    app = web.Application()
    cors = aiohttp_cors.setup(
        app,
        defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
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
