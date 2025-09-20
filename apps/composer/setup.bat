@echo off
REM PennyLane Quantum Circuit Composer Setup Script for Windows

echo 🔬 Setting up PennyLane Quantum Circuit Composer...

REM Check if we're in the right directory
if not exist "GEMINI.md" (
    echo ❌ Please run this script from the qcircuit_composer directory
    exit /b 1
)

echo 📦 Setting up backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install Python dependencies
echo Installing Python packages...
pip install --upgrade pip
pip install -r requirements.txt

echo ✅ Backend setup complete!

cd ..

echo 📦 Setting up frontend...
cd frontend

REM Install Node.js dependencies
echo Installing Node.js packages...
npm install

echo ✅ Frontend setup complete!

cd ..

echo 🎉 Setup complete!
echo.
echo To start the application:
echo 1. Start the backend:
echo    cd backend && venv\Scripts\activate.bat && python main.py
echo.
echo 2. In another terminal, start the frontend:
echo    cd frontend && npm start
echo.
echo 3. Open http://localhost:3000 in your browser
echo.
echo Happy quantum circuit building! 🚀