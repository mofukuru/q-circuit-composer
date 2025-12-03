#!/bin/bash

# Quantum Circuit Composer - Development Server Launcher

set -e

# Check if we're in the right directory
if [ ! -f "GEMINI.md" ]; then
    echo "❌ Please run this script from the qcircuit_composer directory"
    exit 1
fi

echo "🚀 Starting Quantum Circuit Composer..."

# Cleanup function to stop background processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup INT TERM

# Start backend
echo "📡 Starting backend server..."
source .venv/bin/activate
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..
deactivate

echo "✓ Backend started (PID: $BACKEND_PID)"

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "✓ Frontend started (PID: $FRONTEND_PID)"
echo ""
echo "✅ Both servers are running!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
