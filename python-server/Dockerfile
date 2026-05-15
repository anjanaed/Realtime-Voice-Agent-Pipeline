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

# Container entrypoint
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m appuser

# Pre-download the LiveKit models (VAD, Turn Detector, etc.)
# This runs as root during build but stores them in the appuser's home
RUN python3 main.py download-files

# Fix permissions for the app directory AND the home directory (where models live)
RUN chown -R appuser:appgroup /app /home/appuser

USER 10001

# Expose the correct port
# Note: Ensure your code uses port 8006 or 8081 as discussed earlier
EXPOSE 8006

# Run the python server + token server
CMD ["/app/start.sh"]