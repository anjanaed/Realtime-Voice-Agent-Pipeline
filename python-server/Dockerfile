# Build context is THIS folder (python-server/). The token server is vendored
# in here as token_server.py (canonical source stays in ../token-server/), so
# the image is fully self-contained and can be built straight from this dir:
#   docker build -t voice-agent .
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

# Install dependencies (this requirements file is a superset that also covers
# the bundled token server, so a single install is enough)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application (main.py, ballerina_llm.py and the vendored token_server.py)
COPY . ./

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

# main.py also starts the token server in a background thread
CMD ["python", "main.py", "start", "--log-level", "INFO"]
