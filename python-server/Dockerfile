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

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Create non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

# Pre-initialize bundled inference models (VAD + TurnDetector, no HuggingFace download needed)
RUN python -c "from livekit.agents import inference; inference.VAD(); inference.TurnDetector()"

# Fix permissions for the app directory AND the home directory (where models live)
RUN chown -R appuser:appgroup /app /home/appuser

USER 10001

EXPOSE 8080

# Run the python server
CMD ["python", "main.py", "start", "--log-level", "INFO"]