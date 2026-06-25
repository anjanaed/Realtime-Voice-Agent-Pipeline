# Voice Agent with OpenAI Realtime API (STT/TTS) + Ballerina LLM

## Architecture

This implementation uses a **hybrid approach**:
- **OpenAI Realtime API**: Handles Speech-to-Text (STT) and Text-to-Speech (TTS)
- **Ballerina Agent**: Handles LLM reasoning and conversation logic
- **LiveKit**: Manages WebRTC connections for real-time audio streaming

### Pipeline Flow

```
User speaks audio
    ↓
LiveKit (WebRTC)
    ↓
OpenAI Realtime API (STT + VAD)
    ↓
Transcribed text
    ↓
Ballerina LLM (WebSocket)
    ↓
Response text
    ↓
OpenAI Realtime API (TTS)
    ↓
Synthesized audio
    ↓
LiveKit (WebRTC)
    ↓
User hears response
```

## Setup

### 1. Install Dependencies
```bash
cd python-server
pip install -r requirements.txt
```

### 2. Configure Environment
Create/update `.env` file:

```bash
# Required: OpenAI API Key for STT/TTS
OPENAI_API_KEY=sk-your-api-key-here

# Required: Ballerina LLM Service
LLM_SERVICE_URL=ws://localhost:8003/llm

# Required: LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-instance
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

### 3. Start Ballerina LLM Service
Make sure your Ballerina agent is running and accessible at the `LLM_SERVICE_URL`.

### 4. Run the Voice Agent
```bash
python main.py        # or: make agent
```

This starts the LiveKit worker (voice bridge) **and**, in a background thread,
the LiveKit token server on HTTP port `8006` (`GET /getToken`, `GET /health`).
The voice agent itself exposes no port.

> The token server's code lives in [`../token-server`](../token-server/README.md);
> `main.py` imports it from there and runs it in-process. The Docker image
> bundles it too, so production runs a single container. Build from the repo
> root: `docker build -f python-server/Dockerfile -t voice-agent .`

## Features

### ✅ Real-time STT (Speech-to-Text)
- Powered by OpenAI Whisper via Realtime API
- Automatic voice activity detection (VAD)
- Low-latency transcription
- 24kHz audio quality

### ✅ Ballerina LLM Integration
- Transcribed text sent to your Ballerina agent via WebSocket
- Supports streaming responses (CHUNK protocol)
- Full conversation context maintained by Ballerina

### ✅ Real-time TTS (Text-to-Speech)
- Powered by OpenAI's advanced voice synthesis
- Natural-sounding speech with "alloy" voice
- Streaming audio for minimal latency
- Direct audio streaming to LiveKit

### ✅ Built-in VAD
- Server-side voice activity detection
- Configurable thresholds:
  - Activation threshold: 0.5
  - Prefix padding: 300ms (captures speech start)
  - Silence duration: 500ms (detects speech end)

## How It Works

### 1. Audio Input Processing
When a user speaks:
1. LiveKit captures raw audio from the user's microphone
2. Audio streams to OpenAI Realtime API in real-time
3. OpenAI's VAD detects when speech starts and stops
4. Speech is transcribed using Whisper

### 2. LLM Processing
When transcription completes:
1. Transcript is sent to Ballerina LLM via WebSocket
2. Ballerina processes the message and streams response chunks
3. Full response is accumulated

### 3. Audio Output Synthesis
When LLM response is ready:
1. Response text is sent to OpenAI for TTS conversion
2. OpenAI streams back synthesized audio
3. Audio is immediately forwarded to LiveKit
4. User hears the response in real-time

## Code Structure

### Main Components

- **`connect_to_openai_realtime()`**: Establishes WebSocket connection to OpenAI
  - Configures STT/TTS only (LLM disabled)
  - Sets up VAD parameters
  
- **`query_ballerina_llm(transcript)`**: Sends text to Ballerina
  - Handles WebSocket connection
  - Accumulates streaming chunks
  
- **`request_tts_from_openai(text)`**: Converts text to speech
  - Creates conversation item
  - Requests audio synthesis
  
- **`handle_openai_events(ws, room)`**: Processes OpenAI events
  - STT: `conversation.item.input_audio_transcription.completed`
  - VAD: `input_audio_buffer.speech_started/stopped`
  - TTS: `response.audio.delta`, `response.audio.done`
  
- **`process_with_ballerina(transcript, room)`**: Main pipeline
  - Queries Ballerina LLM
  - Publishes response text
  - Requests TTS conversion

### Global State

- `openai_ws`: WebSocket connection to OpenAI
- `llm_ws`: WebSocket connection to Ballerina
- `audio_source`: LiveKit audio source for playback
- `is_processing`: Flag to prevent concurrent processing

## Configuration Options

### Audio Settings
- `SAMPLE_RATE = 24000`: 24kHz (OpenAI standard)
- `NUM_CHANNELS = 1`: Mono audio

### VAD Settings (in `connect_to_openai_realtime()`)
```python
"turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,           # Adjust sensitivity (0.0-1.0)
    "prefix_padding_ms": 300,   # Audio before speech
    "silence_duration_ms": 500  # Silence to end turn
}
```

### TTS Voice
Change the voice in `connect_to_openai_realtime()`:
```python
"voice": "alloy"  # Options: alloy, echo, fable, onyx, nova, shimmer
```

## Troubleshooting

### "OPENAI_API_KEY not set"
- Add your API key to `.env` file
- Ensure `.env` is in the same directory as the script

### "ERROR: LLM_SERVICE_URL not set"
- Add your Ballerina WebSocket URL to `.env`
- Ensure Ballerina service is running

### Connection Issues
- Verify OpenAI API key is valid
- Check LiveKit credentials
- Ensure Ballerina service is accessible
- Check firewall/network settings

### No Audio Output
- Verify TTS track is published to LiveKit
- Check browser/client audio permissions
- Ensure audio format compatibility (24kHz PCM16)

### Processing Lag
- Check Ballerina response time
- Verify network latency to OpenAI
- Monitor OpenAI API rate limits

## API Costs

### OpenAI Realtime API
- **Audio Input (STT)**: ~$0.06/minute
- **Audio Output (TTS)**: ~$0.24/minute
- **Total**: ~$0.30/minute of conversation

### Cost Optimization
- Only audio processing is done via OpenAI
- LLM reasoning uses your Ballerina agent (no OpenAI LLM costs)
- This is significantly cheaper than using OpenAI's LLM in the Realtime API

## Benefits of This Architecture

1. **Cost Effective**: Use OpenAI only for STT/TTS, not LLM
2. **Flexible LLM**: Keep your custom Ballerina agent logic
3. **High Quality**: Professional STT and TTS from OpenAI
4. **Low Latency**: Streaming audio in both directions
5. **Easy Integration**: Minimal changes to existing Ballerina agent

## Development

### Testing Locally
1. Start Ballerina LLM service: `bal run` (in bal-agent directory)
2. Start LiveKit (or use cloud instance)
3. Start this agent: `python main.py`
4. Connect client to LiveKit room

### Debugging
Enable verbose logging by adding print statements or use the existing log messages:
- `[TokenServer]`: Token generation events
- `[OpenAI]`: OpenAI Realtime API events
- `[LLM]`: Ballerina communication
- `[STT]`: Speech-to-text transcription
- `[TTS]`: Text-to-speech synthesis
- `[VAD]`: Voice activity detection
- `[LiveKit]`: LiveKit events
- `[Pipeline]`: End-to-end processing

## File Reference

- `main.py`: Voice agent worker (LiveKit entrypoint + health server)
- `ballerina_llm.py`: `IntegratorAgent` — LLM adapter that bridges to the
  Ballerina service over WebSocket
- `requirements.txt`: Python dependencies
- `.env`: Configuration (create from `.env.example`)
- `tests/`: Call-simulation harness and fixtures
- `k8s/`: Kubernetes deployment manifest

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure environment variables
3. ✅ Start Ballerina LLM service
4. ✅ Run the voice agent
5. ✅ Test with a client
6. 🔄 Adjust VAD/TTS settings as needed
7. 🔄 Monitor costs and performance
