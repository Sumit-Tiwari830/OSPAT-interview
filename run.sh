#!/bin/bash

# Target: Keep OSPAT startup easy and single-command.
# Trap SIGINT (Ctrl+C) and terminate all background processes cleanly.
trap "echo -e '\nStopping all OSPAT services...'; kill 0" SIGINT

echo "🚀 Starting OSPAT Interview System..."

# 1. Start Python AI Microservice
echo "  → Starting Python AI Microservice (Port 8000)..."
cd ai-service
source venv/bin/activate
python main.py > ../ai-service.log 2>&1 &
cd ..

# 2. Start Inngest Dev Server
echo "  → Starting Inngest Dev Server..."
cd backend
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest > ../inngest.log 2>&1 &
cd ..

# 3. Start Express Backend
echo "  → Starting Express Backend (Port 3000)..."
cd backend
npm run dev &
cd ..

# 4. Start React Frontend
echo "  → Starting Vite Frontend (Port 5173)..."
cd frontend
npm run dev &
cd ..

echo ""
echo "✅ All services running! Logs for AI and Inngest are saved to ai-service.log and inngest.log."
echo "👉 Press Ctrl+C to stop all services at once."
echo ""

# Keep shell active to receive Ctrl+C trap
wait
