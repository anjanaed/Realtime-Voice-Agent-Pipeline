.PHONY: agent token sim bal p t y b

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

# Ballerina LLM agent (bal-agent)
bal b:
	cd bal-agent && bal run
