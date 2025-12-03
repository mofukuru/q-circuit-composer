@echo off
REM PennyLane Quantum Circuit Composer Setup Script for Windows

echo 🔬 Setting up PennyLane Quantum Circuit Composer...

REM Check if we're in the right directory
if not exist "GEMINI.md" (
    echo ❌ Please run this script from the qcircuit_composer directory
    exit /b 1
)

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    exit /b 1
)

echo ✓ Python detected

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 16 or higher.
    exit /b 1
)

echo ✓ Node.js detected

REM Check for npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm.
    exit /b 1
)

echo ✓ npm detected

echo.
echo 📦 Setting up backend...

REM Create virtual environment in project root if it doesn't exist
if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        exit /b 1
    )
) else (
    echo Virtual environment already exists
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Failed to activate virtual environment
    exit /b 1
)

REM Install Python dependencies
echo Installing Python packages...
python -m pip install --upgrade pip
if errorlevel 1 (
    echo ❌ Failed to upgrade pip
    exit /b 1
)

pip install -r backend\requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install Python dependencies
    exit /b 1
)

echo ✅ Backend setup complete!

call deactivate

echo.
echo 📦 Setting up frontend...
cd frontend

REM Install Node.js dependencies
echo Installing Node.js packages...
npm install
if errorlevel 1 (
    echo ❌ Failed to install Node.js dependencies
    cd ..
    exit /b 1
)

echo ✅ Frontend setup complete!

cd ..

echo.
echo 🎉 Setup complete!
echo.
echo To start the application:
echo 1. Start the backend:
echo    .venv\Scripts\activate.bat ^&^& cd backend ^&^& python main.py
echo.
echo 2. In another terminal, start the frontend:
echo    cd frontend ^&^& npm start
echo.
echo 3. Open http://localhost:3000 in your browser
echo.
echo Happy quantum circuit building! 🚀