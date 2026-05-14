.PHONY: p,t

p:
	cd python-server && .venv/bin/python3 main.py start --log-level INFO

t:
	cd python-server && .venv/bin/python3 token_server.py start --log-level INFO