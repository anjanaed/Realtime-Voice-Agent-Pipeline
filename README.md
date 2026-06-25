# Voice Agent Pipeline

A low-latency voice assistant for answering questions about WSO2 products. A
user speaks into a LiveKit room from the browser; their speech is transcribed,
answered by a Ballerina-hosted language agent, and spoken back, all in close to
real time.

The system is split into three services so that the speech layer, the
connection/authorization layer, and the reasoning layer can be developed,
deployed, and scaled on their own:

- **`python-server`** — the voice agent. A LiveKit worker that joins a room,
  runs speech-to-text and text-to-speech, and forwards transcripts to the
  reasoning service.
- **`token-server`** — issues short-lived LiveKit access tokens to clients and
  dispatches the voice agent into the requested room.
- **`bal-agent`** — the language agent, written in Ballerina. Holds the
  conversation, calls the model, and streams the answer back.

## How a turn flows

```
  Browser/client                                  token-server (:8006)
       |  1. GET /getToken?roomName=...                  |
       |------------------------------------------------>|  mints a JWT and
       |  2. { token, url }                              |  dispatches the
       |<------------------------------------------------|  voice agent
       |
       |  3. join room over WebRTC (audio)
       v
  ===================  LiveKit room  ===================
       |                                               |
       |  user audio        python-server (voice agent)|
       |---------------->  Deepgram STT (nova-3)        |
       |                        |  transcript           |
       |                        v                       |
       |                   bal-agent  (ws://.../llm)    |
       |                        |  streamed answer      |
       |                        v                       |
       |  agent audio      Deepgram TTS (aura-2)        |
       |<----------------                               |
  ======================================================
```

Steps 1–2 happen once when the client connects. From step 3 onward the voice
agent and the client share a LiveKit room and exchange audio directly; the
agent also publishes the live transcript and the assistant's text on the
`voice-text` data topic so the client can display the conversation.

## Services

### python-server — voice agent

The entry point (`main.py`) registers a LiveKit worker named `voice-agent`.
When the token server dispatches it into a room it:

- transcribes incoming audio with Deepgram `nova-3`,
- detects turn boundaries using LiveKit's bundled VAD and turn detector,
- relays each finished utterance to the reasoning service through
  `IntegratorAgent` (`ballerina_llm.py`), a custom LiveKit `LLM` that holds one
  WebSocket per session and streams the reply back sentence by sentence,
- speaks the reply with Deepgram TTS (`aura-2-asteria-en`).

A plain HTTP health endpoint is served on port `8080` for container probes.
The worker reads `DEEPGRAM_API_KEY`, `LLM_SERVICE_URL`, and the standard
`LIVEKIT_*` credentials from its environment.

### token-server

A small aiohttp service exposing `GET /getToken` on port `8006`. It signs a
LiveKit JWT scoped to the requested room, asks LiveKit to dispatch the
`voice-agent` into that room, and returns the token together with the server
URL. CORS is open so a browser client can call it directly. See
[`token-server/README.md`](token-server/README.md) for details.

### bal-agent — reasoning service

A Ballerina WebSocket service (`/llm` on port `8003`) backed by the
`ballerina/ai` agent framework and an OpenAI model. It is primed as a WSO2
product expert and can perform web lookups through Serper. Each client session
opens its own WebSocket connection; the agent receives the user's text, runs the
model, and streams the answer in chunks terminated by an `END` marker.

## Repository layout

```
.
├── python-server/        Voice agent (LiveKit worker)
│   ├── main.py               worker entry point + health server
│   ├── ballerina_llm.py      IntegratorAgent: WebSocket bridge to bal-agent
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── k8s/                  Kubernetes deployment manifest
│   └── tests/               call-simulation harness and audio fixtures
├── token-server/         LiveKit token issuer + agent dispatch
│   ├── token_server.py
│   ├── requirements.txt
│   └── Dockerfile
└── bal-agent/            Ballerina reasoning service
    ├── main.bal
    └── Config.toml           OpenAI / Serper credentials
```

## Prerequisites

- Python 3.11+ and the [Ballerina](https://ballerina.io) toolchain.
- A LiveKit deployment (cloud or self-hosted) with an API key and secret.
- A Deepgram API key (speech-to-text and text-to-speech).
- An OpenAI API key, and optionally a Serper key for web search.

## Setup

Each Python service keeps its own virtual environment and its own `.env`,
created from the `.env.example` in that directory.

```bash
# Voice agent
cd python-server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # add DEEPGRAM_API_KEY, LLM_SERVICE_URL, LIVEKIT_*

# Token server
cd ../token-server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET

# Reasoning service
cd ../bal-agent
cp Config.toml.example Config.toml   # add openaiToken and serperApiKey
```

## Running

Start the three services in separate terminals. A `Makefile` at the repository
root wraps each command:

```bash
make bal       # bal-agent      — reasoning service on ws://localhost:8003/llm
make agent     # python-server  — voice agent worker (health on :8080)
make token     # token-server   — token endpoint on http://localhost:8006
```

The short aliases `b`, `p`, and `t` map to the same targets. Once all three are
running, point a LiveKit client at the token server's `/getToken` endpoint to
join a room and start talking.

### Simulating a call

`make sim` (alias `y`) runs `python-server/tests/simulate_call.py`, which joins
the room as a synthetic participant and streams a recorded utterance in as
microphone audio. It is useful for exercising the full pipeline without a
browser. See [`python-server/tests/README.md`](python-server/tests/README.md).

## Deployment

`python-server` and `token-server` each ship a `Dockerfile` and run as
non-root. `python-server/k8s/deployment.yaml` deploys the voice agent and reads
its credentials from a `python-server-secrets` Kubernetes secret. `bal-agent`
includes a Choreo component descriptor that exposes the `/llm` WebSocket
endpoint.
