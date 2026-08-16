FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all app files
COPY . .

# Render sets the PORT environment variable automatically
EXPOSE 10000

# Start the FastAPI app using the PORT environment variable (or fallback to 10000)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1
