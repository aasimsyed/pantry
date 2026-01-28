# Dockerfile for Streamlit Dashboard
# Production: Cloud Run
# Build from project root: docker build -f dashboard/Dockerfile -t pantry-dashboard .

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Copy dashboard requirements first (for better caching)
# Note: Build context is project root, so paths are relative to root
COPY dashboard/requirements.txt ./requirements.txt

# Install dashboard dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy dashboard code (including .streamlit config)
COPY dashboard/ ./dashboard/

# Expose port (Cloud Run uses PORT env var, defaults to 8501 for Streamlit)
EXPOSE 8501

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests, os; port=os.environ.get('PORT', '8501'); requests.get(f'http://localhost:{port}/_stcore/health')" || exit 1

# Run Streamlit
# Cloud Run sets PORT env var; Streamlit reads it automatically
# Set API_BASE_URL environment variable to point to your production API
CMD streamlit run dashboard/app.py --server.port=${PORT:-8501} --server.address=0.0.0.0 --server.headless=true
