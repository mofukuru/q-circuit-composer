# PennyLane Quantum Circuit Composer

A web-based graphical user interface for designing and simulating quantum circuits using PennyLane.

## Project Structure

```
qcircuit_composer/
├── backend/           # FastAPI + PennyLane backend
│   ├── main.py       # FastAPI application
│   ├── models.py     # Pydantic models
│   └── requirements.txt
├── frontend/         # React + TypeScript frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Quick Setup

### Automated Setup (Recommended)
```bash
# On macOS/Linux:
./setup.sh

# On Windows:
setup.bat
```

### Manual Setup

#### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
python main.py
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## Usage

1. **Start the Backend**: The FastAPI server will run on http://localhost:8000
2. **Start the Frontend**: The React app will run on http://localhost:3000
3. **Build Circuits**: Drag quantum gates from the palette onto the circuit canvas
4. **Configure**: Adjust the number of qubits and shots in the control panel
5. **Execute**: Click "Run Circuit" to simulate with PennyLane
6. **View Results**: See probability distributions and measurement outcomes

## Features

- Drag and drop quantum gates
- Visual circuit design
- PennyLane backend simulation
- Real-time results visualization
- Support for common quantum gates (H, X, Y, Z, CNOT, etc.)