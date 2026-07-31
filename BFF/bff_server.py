import asyncio
import base64
import os
import time

import aiohttp
from aiohttp import web
import aiohttp_cors
from dotenv import load_dotenv

load_dotenv()

# --- Choreo upstream configuration -------------------------------------------
# The BFF holds the OAuth2 application credentials (Consumer Key/Secret from
# the Choreo Developer Portal) so they never reach the browser. On each client
# request it exchanges them for a bearer token (client-credentials grant,
# cached until near expiry) and calls the Choreo-exposed getToken API.

# Choreo-exposed getToken API, e.g.
#   https://<org>-<env>.e1-us-east-azure.choreoapis.dev/pipeline/python-server/v1.0/getToken
CHOREO_TOKEN_URL = os.getenv("CHOREO_TOKEN_URL", "")

# Choreo OAuth2 token endpoint (same gateway host as the API), e.g.
#   https://<org>-<env>.e1-us-east-azure.choreoapis.dev/oauth2/token
CHOREO_TOKEN_ENDPOINT = os.getenv("CHOREO_TOKEN_ENDPOINT", "")

CHOREO_CONSUMER_KEY = os.getenv("CHOREO_CONSUMER_KEY", "")
CHOREO_CONSUMER_SECRET = os.getenv("CHOREO_CONSUMER_SECRET", "")

# Port the BFF listens on. 8006 is the local token server, so default to 8007.
PORT = int(os.getenv("PORT", "8007"))

# Comma-separated list of CORS origins allowed to call the BFF. Defaults to
# "*" (any origin). For production, pin it to your frontend(s).
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
] or ["*"]

# Refresh the bearer token this many seconds before it actually expires, so an
# in-flight upstream call never races the expiry.
EXPIRY_SKEW_SECONDS = 60


class AccessTokenCache:
    """Caches the Choreo OAuth2 access token; de-dupes concurrent refreshes so
    many simultaneous client requests share one token exchange."""

    def __init__(self):
        self._value: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    def invalidate(self):
        self._value = None
        self._expires_at = 0.0

    async def get(self, session: aiohttp.ClientSession) -> str:
        now = time.monotonic()
        if self._value and self._expires_at - EXPIRY_SKEW_SECONDS > now:
            return self._value

        async with self._lock:
            # Re-check: another request may have refreshed while we waited.
            now = time.monotonic()
            if self._value and self._expires_at - EXPIRY_SKEW_SECONDS > now:
                return self._value

            basic = base64.b64encode(
                f"{CHOREO_CONSUMER_KEY}:{CHOREO_CONSUMER_SECRET}".encode()
            ).decode()
            async with session.post(
                CHOREO_TOKEN_ENDPOINT,
                data={"grant_type": "client_credentials"},
                headers={"Authorization": f"Basic {basic}"},
            ) as resp:
                if resp.status != 200:
                    detail = await resp.text()
                    raise web.HTTPBadGateway(
                        text=f"Choreo token endpoint failed: {resp.status} {detail}"
                    )
                data = await resp.json()

            access_token = data.get("access_token")
            if not access_token:
                raise web.HTTPBadGateway(
                    text='Choreo token endpoint response missing "access_token"'
                )

            self._value = access_token
            self._expires_at = time.monotonic() + float(data.get("expires_in", 3600))
            print("[BFF] Refreshed Choreo access token")
            return access_token


token_cache = AccessTokenCache()


async def handle_get_token(request: web.Request) -> web.Response:
    missing = [
        name
        for name, value in {
            "CHOREO_TOKEN_URL": CHOREO_TOKEN_URL,
            "CHOREO_TOKEN_ENDPOINT": CHOREO_TOKEN_ENDPOINT,
            "CHOREO_CONSUMER_KEY": CHOREO_CONSUMER_KEY,
            "CHOREO_CONSUMER_SECRET": CHOREO_CONSUMER_SECRET,
        }.items()
        if not value
    ]
    if missing:
        print(f"[BFF] Missing env vars: {', '.join(missing)}")
        return web.json_response(
            {"error": "BFF is not configured", "missing": missing}, status=500
        )

    session: aiohttp.ClientSession = request.app["client_session"]

    async def call_upstream(bearer: str) -> aiohttp.ClientResponse:
        # Forward the client's query params (roomName, participantName, ttl,
        # emptyTimeout, ...) to the upstream getToken API unchanged.
        return await session.get(
            CHOREO_TOKEN_URL,
            params=request.query,
            headers={"Authorization": f"Bearer {bearer}"},
        )

    try:
        bearer = await token_cache.get(session)
        resp = await call_upstream(bearer)
        # A 401 means the cached token was revoked/expired early — refresh once
        # and retry before giving up.
        if resp.status == 401:
            resp.release()
            token_cache.invalidate()
            bearer = await token_cache.get(session)
            resp = await call_upstream(bearer)
    except web.HTTPBadGateway:
        raise
    except aiohttp.ClientError as err:
        print(f"[BFF] Upstream request failed: {err}")
        return web.json_response({"error": "Upstream request failed"}, status=502)

    async with resp:
        if resp.status != 200:
            detail = await resp.text()
            print(f"[BFF] getToken upstream returned {resp.status}: {detail}")
            return web.json_response(
                {"error": "Upstream getToken failed", "status": resp.status},
                status=502,
            )
        data = await resp.json()

    if not data.get("token") or not data.get("url"):
        return web.json_response(
            {"error": 'Upstream response missing "token" or "url"'}, status=502
        )

    print(
        f"[BFF] Issued token for participant="
        f"'{request.query.get('participantName', 'user')}' "
        f"room='{request.query.get('roomName', '')}'"
    )
    return web.json_response({"token": data["token"], "url": data["url"]})


async def handle_health(request: web.Request) -> web.Response:
    # Liveness/readiness probe. Stays cheap and side-effect free so it is safe
    # for orchestrators to poll frequently.
    return web.Response(text="ok")


async def make_app() -> web.Application:
    app = web.Application()

    async def client_session_ctx(app: web.Application):
        app["client_session"] = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=15)
        )
        yield
        await app["client_session"].close()

    app.cleanup_ctx.append(client_session_ctx)

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
    cors.add(app.router.add_get("/getToken", handle_get_token))
    return app


if __name__ == "__main__":
    print(f"[BFF] Listening on http://0.0.0.0:{PORT}")
    print(f"[BFF] CORS allowed origins: {', '.join(CORS_ALLOWED_ORIGINS)}")
    web.run_app(make_app(), host="0.0.0.0", port=PORT, print=None)
