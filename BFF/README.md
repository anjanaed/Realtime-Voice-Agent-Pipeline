# BFF (Backend For Frontend) token server

A thin server between the browser client and the Choreo-exposed `getToken`
API. It moves the OAuth2 client-credentials exchange out of the browser:

```
client ──(no auth)──▶ BFF ──(OAuth2 client credentials)──▶ Choreo gateway ──▶ getToken API
```

On each client request the BFF:

1. Exchanges the Choreo application's Consumer Key + Secret for a bearer token
   at the Choreo token endpoint (cached in memory and reused until ~60 s before
   expiry; concurrent requests share one exchange).
2. Calls the Choreo-exposed `getToken` API with `Authorization: Bearer ...`,
   forwarding the client's query params (`roomName`, `participantName`, ...).
   On a 401 it refreshes the token once and retries.
3. Returns the upstream `{ "token": ..., "url": ... }` LiveKit payload as-is.

There is currently **no authentication between the client and the BFF** — add
one before exposing the BFF publicly.

## Endpoints

| Route       | Description                                          |
|-------------|------------------------------------------------------|
| `GET /getToken?roomName=&participantName=` | LiveKit token + server URL |
| `GET /health` | Liveness probe                                     |

## Run

```bash
cd BFF
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in the Choreo values
.venv/bin/python bff_server.py
# → http://localhost:8007/getToken
```

Or with Docker:

```bash
docker build -t pipeline-bff BFF/
docker run --env-file BFF/.env -p 8007:8007 pipeline-bff
```

## Pointing the client at the BFF

In `client/.env`, drop the Choreo OAuth vars and point the token URL here —
the client sends no auth headers when no consumer key is configured:

```bash
VITE_TOKEN_URL=http://localhost:8007/getToken
# VITE_TOKEN_ENDPOINT / VITE_CONSUMER_KEY / VITE_CONSUMER_SECRET no longer needed
```
