from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pennylane as qml
import numpy as np
from models import CircuitRequest, CircuitResponse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Quantum Circuit Composer API",
    description="Backend API for PennyLane quantum circuit simulation",
    version="1.0.0",
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_circuit_function(circuit_operations: list, num_qubits: int):
    """Dynamically create a quantum circuit function from operations."""

    def circuit():
        for operation in circuit_operations:
            gate = operation.gate.lower()
            wires = operation.wires
            params = operation.params or []

            try:
                if gate == "hadamard" or gate == "h":
                    qml.Hadamard(wires=wires[0])
                elif gate == "paulix" or gate == "x":
                    qml.PauliX(wires=wires[0])
                elif gate == "pauliy" or gate == "y":
                    qml.PauliY(wires=wires[0])
                elif gate == "pauliz" or gate == "z":
                    qml.PauliZ(wires=wires[0])
                elif gate == "cnot" or gate == "cx":
                    qml.CNOT(wires=wires)
                elif gate == "rx":
                    qml.RX(params[0], wires=wires[0])
                elif gate == "ry":
                    qml.RY(params[0], wires=wires[0])
                elif gate == "rz":
                    qml.RZ(params[0], wires=wires[0])
                elif gate == "phase" or gate == "s":
                    qml.S(wires=wires[0])
                elif gate == "t":
                    qml.T(wires=wires[0])
                else:
                    logger.warning(f"Unknown gate: {gate}")

            except Exception as e:
                logger.error(f"Error applying gate {gate}: {str(e)}")
                raise ValueError(f"Invalid gate operation: {gate}")

        return qml.probs(wires=range(num_qubits))

    return circuit


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Quantum Circuit Composer API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "qcircuit-composer-api"}


@app.post("/execute", response_model=CircuitResponse)
async def execute_circuit(request: CircuitRequest):
    """Execute a quantum circuit using PennyLane."""
    try:
        logger.info(
            f"Executing circuit with {request.qubits} qubits, {len(request.circuit)} operations"
        )

        # Validate request
        if request.qubits <= 0 or request.qubits > 10:
            raise HTTPException(
                status_code=400,
                detail="Number of qubits must be between 1 and 10",
            )

        if request.shots <= 0 or request.shots > 100000:
            raise HTTPException(
                status_code=400,
                detail="Number of shots must be between 1 and 100,000",
            )

        # Create PennyLane device
        device = qml.device(
            "default.qubit", wires=request.qubits, shots=request.shots
        )

        # Create the circuit function
        circuit_func = create_circuit_function(request.circuit, request.qubits)

        # Create QNode
        qnode = qml.QNode(circuit_func, device)

        # Execute the circuit
        probabilities = qnode()

        # Convert probabilities to binary string format
        prob_dict = {}
        for i, prob in enumerate(probabilities):
            binary_state = format(i, f"0{request.qubits}b")
            prob_dict[binary_state] = float(prob)

        logger.info(f"Circuit execution successful. Results: {prob_dict}")

        return CircuitResponse(
            probabilities=prob_dict,
            success=True,
            message="Circuit executed successfully",
        )

    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))

    except Exception as e:
        logger.error(f"Execution error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Circuit execution failed: {str(e)}"
        )


@app.get("/gates")
async def get_available_gates():
    """Get list of available quantum gates."""
    gates = [
        {
            "name": "Hadamard",
            "symbol": "H",
            "description": "Hadamard gate - creates superposition",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "PauliX",
            "symbol": "X",
            "description": "Pauli-X gate - bit flip",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "PauliY",
            "symbol": "Y",
            "description": "Pauli-Y gate",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "PauliZ",
            "symbol": "Z",
            "description": "Pauli-Z gate - phase flip",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "CNOT",
            "symbol": "⊕",
            "description": "Controlled-NOT gate",
            "params": 0,
            "qubits": 2,
        },
        {
            "name": "RX",
            "symbol": "RX",
            "description": "Rotation around X-axis",
            "params": 1,
            "qubits": 1,
        },
        {
            "name": "RY",
            "symbol": "RY",
            "description": "Rotation around Y-axis",
            "params": 1,
            "qubits": 1,
        },
        {
            "name": "RZ",
            "symbol": "RZ",
            "description": "Rotation around Z-axis",
            "params": 1,
            "qubits": 1,
        },
        {
            "name": "Phase",
            "symbol": "S",
            "description": "Phase gate (S gate)",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "T",
            "symbol": "T",
            "description": "T gate (π/8 gate)",
            "params": 0,
            "qubits": 1,
        },
    ]
    return {"gates": gates}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
