#!/bin/sh
set -e

wait_for_envoy() {
  attempt=0
  until curl -fsS http://127.0.0.1:9901/server_info >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
      echo "Envoy did not become ready on 127.0.0.1:9901" >&2
      exit 1
    fi
    sleep 1
  done
}

wait_for_envoy

python token_server.py &
exec python main.py start --log-level INFO
