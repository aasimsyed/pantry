# Dockerfile for FastAPI backend
# Production: Cloud Run. Also usable for self-hosted Docker.

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Tesseract OCR and OpenCV
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    libopencv-dev \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (platforms will set PORT env var)
# Cloud Run uses 8080 by default, but PORT env var is used dynamically
EXPOSE 8000

# Health check (uses PORT env var, defaults to 8000)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD sh -c 'python -c "import requests, os; port=os.environ.get(\"PORT\", \"8000\"); requests.get(f\"http://localhost:{port}/health\")"' || exit 1

# Run the application
# Use start_server.py which handles database initialization and then starts uvicorn
# Cloud Run sets PORT; override via env for local Docker.
CMD ["python", "start_server.py"]

