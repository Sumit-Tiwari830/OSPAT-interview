# ─────────────────────────────────────────────────────────────────
# Dockerfile
# Unified single-container build for OSPAT full-stack system.
# ─────────────────────────────────────────────────────────────────

# Use a multi-language base image containing Python 3.11 and Node.js 20
FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# Install system dependencies (ffmpeg is required by Groq Whisper for audio processing)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy and install Python microservice dependencies
COPY ai-service/requirements.txt ./ai-service/
RUN pip install --no-cache-dir -r ./ai-service/requirements.txt

# Copy and install Node Express backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy and install React frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy the rest of the application files
COPY . .

# Declare build arguments to inject environment variables at build-time in Docker
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_STREAM_API_KEY
ARG VITE_API_URL
ARG VITE_RAPIDAPI_KEY

ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_STREAM_API_KEY=$VITE_STREAM_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RAPIDAPI_KEY=$VITE_RAPIDAPI_KEY

# Build the React frontend production bundle
RUN cd frontend && npm run build

# Expose backend port
EXPOSE 3000

# Start the Python AI service on port 8000 in the background, and run the Express backend on port 3000
CMD python ai-service/main.py & cd backend && npm start
