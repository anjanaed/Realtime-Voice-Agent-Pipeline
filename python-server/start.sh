#!/bin/sh
set -e

python token_server.py &
exec python main.py start --log-level INFO
