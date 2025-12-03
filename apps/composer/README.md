# Quantum Circuit Composer

A web-based graphical user interface for designing and simulating quantum circuits with support for multiple quantum computing frameworks.

## Features

- **Visual Circuit Design**: Drag and drop quantum gates onto a canvas
- **Multi-Framework Code Generation**: Generate executable code for:
  - PennyLane
  - Qiskit
  - Qulacs
  - OpenQASM 2.0
- **Real-time Simulation**: Execute circuits using PennyLane backend
- **Interactive Results**: Visualize probability distributions and measurement outcomes
- **Rich Gate Library**: Support for single-qubit, two-qubit, and three-qubit gates
- **Multi-language Support**: English and Japanese interface
- **Dark/Light Theme**: Toggle between themes for comfortable viewing

## Supported Quantum Gates

- **Single-qubit gates**: H (Hadamard), X, Y, Z (Pauli gates), RX, RY, RZ (rotations), S (Phase), T
- **Two-qubit gates**: CNOT, CZ, CY, SWAP, CRX, CRY, CRZ (controlled rotations)
- **Three-qubit gates**: Toffoli (CCX)
- **Measurement gates**: MeasureZ, MeasureX, MeasureY (basis selection)

## Project Structure

```
qcircuit_composer/
├── backend/           # FastAPI + PennyLane backend
│   ├── main.py       # FastAPI application with multi-framework code generation
│   ├── models.py     # Pydantic models
│   └── requirements.txt
├── frontend/         # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components (CircuitCanvas, GatePalette, etc.)
│   │   ├── api.ts      # API client
│   │   └── types.ts    # TypeScript interfaces
│   ├── public/
│   │   └── locales/    # i18n translations (en, ja)
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

The setup script will:
1. Create a Python virtual environment
2. Install backend dependencies
3. Install frontend dependencies
4. Start both backend and frontend servers

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
3. **Build Circuits**: 
   - Drag quantum gates from the palette onto the circuit canvas
   - Configure gate parameters (angles for rotation gates)
   - Swap control/target qubits for two-qubit gates by dragging
4. **Configure Execution**: 
   - Set the number of qubits (1-10)
   - Set the number of shots (1-100,000)
5. **Execute**: Click "Run Circuit" to simulate with PennyLane
6. **View Results**: 
   - Toggle between Results and Code views
   - See probability distributions in chart format
   - View detailed probability tables
7. **Export Code**: 
   - Select your preferred framework (PennyLane/Qiskit/Qulacs/OpenQASM)
   - Copy the generated code to use in your own projects

## Code Generation

The application generates executable quantum circuit code in multiple frameworks. All generated code has been tested and verified to work correctly.

### Tested Environments

The generated code has been verified to execute successfully in the following environments:

- **Python**: 3.10.19
- **PennyLane**: 0.42.3
- **Qiskit**: 2.2.3
- **Qiskit-aer**: 0.17.2
- **Qulacs**: 0.6.12

### Example: Bell State Circuit

**PennyLane**:
```python
import pennylane as qml
import numpy as np

dev = qml.device("default.qubit", wires=2, shots=1000)

@qml.qnode(dev)
def circuit():
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    return qml.probs(wires=[0, 1])

result = circuit()
print(result)
```

**Qiskit**:
```python
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator

qr = QuantumRegister(2, 'q')
cr = ClassicalRegister(2, 'c')
qc = QuantumCircuit(qr, cr)

qc.h(0)
qc.cx(0, 1)
qc.measure(0, 0)
qc.measure(1, 1)

backend = AerSimulator()
job = backend.run(qc, shots=1000)
result = job.result().get_counts(qc)
print(result)
```

**Qulacs**:
```python
from qulacs import QuantumState, QuantumCircuit
from qulacs.gate import *

state = QuantumState(2)
circuit = QuantumCircuit(2)

circuit.add_gate(H(0))
circuit.add_gate(CNOT(0, 1))
circuit.update_quantum_state(state)
print(state.get_vector())
```

**OpenQASM 2.0**:
```qasm
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0],q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];
```

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for interactive API documentation powered by FastAPI's Swagger UI.

### Key Endpoints

- `POST /execute`: Execute a quantum circuit
  - Request: Circuit definition with gates, qubits, and shots
  - Response: Probabilities, expectations, and generated code in all frameworks
- `GET /gates`: List all available quantum gates
- `GET /health`: Health check endpoint

## Development

### Backend Development
```bash
cd backend
source venv/bin/activate
python main.py
```

The FastAPI server supports hot-reload for development.

### Frontend Development
```bash
cd frontend
npm start
```

The React dev server supports hot-reload and will automatically open your browser.

### Running Tests
```bash
# Test backend
cd backend
pytest

# Test frontend
cd frontend
npm test
```

## Technologies Used

### Backend
- **FastAPI**: Modern Python web framework
- **PennyLane**: Quantum machine learning and simulation
- **Pydantic**: Data validation and settings management
- **uvicorn**: ASGI server

### Frontend
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Konva**: Canvas rendering for circuit visualization
- **Chart.js**: Data visualization for results
- **i18next**: Internationalization
- **Lucide React**: Icon library

## Requirements

### Backend
- Python 3.8+
- PennyLane 0.42+
- FastAPI 0.104+

### Frontend
- Node.js 14+
- npm or yarn

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.