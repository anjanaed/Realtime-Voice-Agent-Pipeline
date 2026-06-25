# Token Server

A small aiohttp service that mints LiveKit access tokens for clients and
dispatches the `voice-agent` into the requested room. Extracted from
`python-server` so it can be developed, deployed, and scaled independently.

## Endpoint

```
GET /getToken?roomName=<room>&participantName=<name>
```

Returns `{ "token": "<jwt>", "url": "<LIVEKIT_URL>" }`. Both query params are
optional — `roomName` defaults to `LIVEKIT_ROOM`, `participantName` to `user`.
CORS is open (`*`) so a browser client can call it directly.

Listens on `http://0.0.0.0:8006`.

## Setup

```bash
cd token-server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill in your LiveKit credentials
```

## Run

```bash
make token      # from the repo root
# or
.venv/bin/python3 token_server.py
```

## Docker

```bash
docker build -t token-server .
docker run --rm -p 8006:8006 --env-file .env token-server
```
