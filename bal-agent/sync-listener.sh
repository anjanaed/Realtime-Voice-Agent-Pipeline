#!/usr/bin/env bash
# Refresh modules/voice from the listener package in "../WS Listener".
#
# The listener is vendored rather than depended on, so this package builds in a
# clean environment (a CI or Devant/Choreo builder) with no pre-seeded local
# Ballerina repository. The cost is that the copy has to be refreshed by hand:
# run this whenever "../WS Listener" changes.
#
# Once wso2/voice is published to Ballerina Central, delete modules/voice and
# this script, and go back to a plain [[dependency]] on wso2/voice.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/../WS Listener"
dest="$here/modules/voice"

if [[ ! -d "$src" ]]; then
    echo "error: listener package not found at $src" >&2
    exit 1
fi

rm -rf "$dest"
mkdir -p "$dest"
cp "$src/listener.bal" "$src/connection.bal" "$src/types.bal" "$dest/"
cp -r "$src/tests" "$dest/"

echo "synced modules/voice from ../WS Listener"
if git -C "$src" rev-parse --short HEAD >/dev/null 2>&1; then
    echo "source commit: $(git -C "$src" rev-parse --short HEAD)"
fi
