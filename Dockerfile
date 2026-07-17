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

# Build the React frontend production bundle
RUN cd frontend && npm run build

# Expose backend port
EXPOSE 3000

# Start the Python AI service on port 8000 in the background, and run the Express backend on port 3000
CMD python ai-service/main.py & cd backend && npm start
