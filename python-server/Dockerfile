# NOTE: build context is the REPO ROOT, not python-server/, because the image
# bundles the sibling token-server/ folder too. Build with:
#   docker build -f python-server/Dockerfile -t voice-agent .
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/appuser

# Set the working directory
WORKDIR /app

# Install system dependencies (required for some audio/onnx plugins)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (python-server's requirements is a superset that also
# covers the bundled token server, so a single install is enough)
COPY python-server/requirements.txt ./python-server/requirements.txt
RUN pip install --no-cache-dir -r ./python-server/requirements.txt

# Copy both services, preserving the repo's relative layout so main.py can
# reach the token server at ../token-server (same path as in local dev)
COPY python-server/ ./python-server/
COPY token-server/   ./token-server/

# Create non-root user (with home dir, where the inference models are cached)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

# Pre-initialize bundled inference models (VAD + TurnDetector, no HuggingFace download needed)
RUN python -c "from livekit.agents import inference; inference.VAD(); inference.TurnDetector()"

# Fix permissions for the app directory AND the home directory (where models live)
RUN chown -R appuser:appgroup /app /home/appuser

USER 10001

# Only the token server is exposed; the voice agent talks to LiveKit, not HTTP.
EXPOSE 8006

# Run from the voice-agent dir; main.py also starts the token server in a thread
WORKDIR /app/python-server
CMD ["python", "main.py", "start", "--log-level", "INFO"]
