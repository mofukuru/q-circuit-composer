#!/bin/bash

# PennyLane Quantum Circuit Composer Setup Script

echo "🔬 Setting up PennyLane Quantum Circuit Composer..."

# Check if we're in the right directory
if [ ! -f "GEMINI.md" ]; then
    echo "❌ Please run this script from the qcircuit_composer directory"
    exit 1
fi

echo "📦 Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Backend setup complete!"

cd ..

echo "📦 Setting up frontend..."
cd frontend

# Install Node.js dependencies
echo "Installing Node.js packages..."
npm install

echo "✅ Frontend setup complete!"

cd ..

echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "1. Start the backend:"
echo "   cd backend && source venv/bin/activate && python main.py"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   cd frontend && npm start"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Happy quantum circuit building! 🚀"