FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app

# Install dependencies first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the token HTTP server port (as defined in CLAUDE.md)
EXPOSE 8006

# Run the python server using the command from the Makefile
CMD ["python", "main.py", "start", "--log-level", "INFO"]
