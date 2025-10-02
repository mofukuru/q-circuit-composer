from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pennylane as qml
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
    """Dynamically create a quantum circuit function from operations.

    Measurement gates (MeasureZ/MeasureX/MeasureY) are treated as
    readout-basis selection markers. We record the chosen basis per wire
    and, at the end of the circuit, rotate into that basis before
    returning qml.probs over all wires. If multiple measurement gates are
    placed on the same wire, the last one wins. Wires without an explicit
    measurement gate are measured in Z basis by default.
    """

    # default all wires to Z basis, override if measurement gates are present
    measurement_basis = {w: "Z" for w in range(num_qubits)}

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
                    # wires[0] = control qubit, wires[1] = target qubit
                    if len(wires) != 2:
                        raise ValueError(
                            "CNOT gate requires exactly 2 wires, "
                            + f"got {len(wires)}"
                        )
                    qml.CNOT(wires=[wires[0], wires[1]])
                elif gate == "crx":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRX gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRX gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    qml.CRX(params[0], wires=wires)
                elif gate == "cry":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRY gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRY gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    qml.CRY(params[0], wires=wires)
                elif gate == "crz":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRZ gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRZ gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    qml.CRZ(params[0], wires=wires)
                elif gate == "rx":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RX gate requires rotation angle parameter"
                        )
                    qml.RX(params[0], wires=wires[0])
                elif gate == "ry":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RY gate requires rotation angle parameter"
                        )
                    qml.RY(params[0], wires=wires[0])
                elif gate == "rz":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RZ gate requires rotation angle parameter"
                        )
                    qml.RZ(params[0], wires=wires[0])
                elif gate == "phase" or gate == "s":
                    qml.S(wires=wires[0])
                elif gate == "t":
                    qml.T(wires=wires[0])
                elif gate in ("measurez", "mz", "measure_z"):
                    # Mark wire for Z basis (no-op for circuit; before probs)
                    if len(wires) != 1:
                        raise ValueError("MeasureZ requires exactly 1 wire")
                    measurement_basis[wires[0]] = "Z"
                elif gate in ("measurex", "mx", "measure_x"):
                    if len(wires) != 1:
                        raise ValueError("MeasureX requires exactly 1 wire")
                    measurement_basis[wires[0]] = "X"
                elif gate in ("measurey", "my", "measure_y"):
                    if len(wires) != 1:
                        raise ValueError("MeasureY requires exactly 1 wire")
                    measurement_basis[wires[0]] = "Y"
                else:
                    logger.warning(f"Unknown gate: {gate}")

            except Exception as e:
                logger.error(f"Error applying gate {gate}: {str(e)}")
                raise ValueError(f"Invalid gate operation: {gate}")

        # Apply basis rotations just before measuring probabilities
        # Z: no-op; X: H; Y: S^† then H
        for w, b in measurement_basis.items():
            if b == "X":
                qml.Hadamard(wires=w)
            elif b == "Y":
                qml.adjoint(qml.S)(wires=w)
                qml.Hadamard(wires=w)

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
            f"Executing circuit with {request.qubits} qubits, "
            + f"{len(request.circuit)} operations"
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
            "name": "CRX",
            "symbol": "CRX",
            "description": "Controlled-RX gate",
            "params": 1,
            "qubits": 2,
        },
        {
            "name": "CRY",
            "symbol": "CRY",
            "description": "Controlled-RY gate",
            "params": 1,
            "qubits": 2,
        },
        {
            "name": "CRZ",
            "symbol": "CRZ",
            "description": "Controlled-RZ gate",
            "params": 1,
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
        # Measurement gates (readout basis selectors)
        {
            "name": "MeasureZ",
            "symbol": "MZ",
            "description": "Measure in Z basis (readout basis)",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "MeasureX",
            "symbol": "MX",
            "description": "Measure in X basis (readout basis)",
            "params": 0,
            "qubits": 1,
        },
        {
            "name": "MeasureY",
            "symbol": "MY",
            "description": "Measure in Y basis (readout basis)",
            "params": 0,
            "qubits": 1,
        },
    ]
    return {"gates": gates}
