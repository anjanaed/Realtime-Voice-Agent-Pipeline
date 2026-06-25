# Tests

Manual / integration harnesses for the voice agent.

- **`simulate_call.py`** — connects to the LiveKit room as a fake participant,
  dispatches the agent, and streams `fixtures/testvoice.wav` in as microphone
  audio (looped several times) to exercise the full STT → LLM → TTS pipeline
  under repeated turns. Prints any transcriptions it receives back.
- **`fixtures/testvoice.wav`** — 16 kHz mono WAV used as the simulated speech.

## Run

Requires the voice agent (`make agent`) and the Ballerina LLM service
(`make bal`) to be running, plus valid LiveKit credentials in
`python-server/.env`.

```bash
make sim          # from the repo root
# or
cd python-server && .venv/bin/python3 tests/simulate_call.py
```
