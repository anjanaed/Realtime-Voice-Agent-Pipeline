.PHONY: agent token sim bal listener bff image vendor-token p t y b l f

# Voice agent (python-server). Also starts the token server in-process on :8006.
agent p:
	cd python-server && .venv/bin/python3 main.py start --log-level INFO

# Token server standalone (token-server). Only needed to run it WITHOUT the
# agent; `make agent` already serves tokens on :8006, so don't run both locally.
token t:
	cd token-server && .venv/bin/python3 token_server.py

# Call simulation / load test (streams a wav fixture into the room)
sim y:
	cd python-server && .venv/bin/python3 tests/simulate_call.py

# Refresh bal-agent/modules/voice from WS Listener/. The listener is vendored
# into the agent so it builds anywhere with no local-repo setup, so run this
# whenever WS Listener/ changes.
listener l:
	cd bal-agent && ./sync-listener.sh

# Ballerina LLM agent (bal-agent). Self-contained; no setup step needed.
bal b:
	cd bal-agent && bal run

# BFF token server (BFF): proxies getToken through the Choreo gateway using
# OAuth2 client credentials, on :8007. Configure BFF/.env first.
bff f:
	cd BFF && .venv/bin/python3 bff_server.py

# Refresh the vendored copy of the token server from its canonical source.
# Run this whenever token-server/token_server.py changes.
vendor-token:
	cp token-server/token_server.py python-server/token_server.py

# Build the production image (voice agent + bundled token server).
# Context is python-server/ itself; token_server.py is vendored in there.
image: vendor-token
	cd python-server && docker build -t voice-agent:latest .

client c:
	cd client && npm run dev