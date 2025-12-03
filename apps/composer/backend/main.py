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


def create_circuit_function(
    circuit_operations: list,
    num_qubits: int,
    num_classical_bits: int = 0,
    result_mode: str = "probs",
):
    """Dynamically create a quantum circuit function from operations.

    Supports dynamic quantum circuits with:
    - Mid-circuit measurements: Store measurement results in classical
      bits
    - Conditional gates: Apply gates based on classical bit values
    - Terminal measurements: Traditional end-of-circuit measurements

    Measurement gates (MeasureZ/MeasureX/MeasureY) can be:
    1. Mid-circuit (with classical_store): Perform measurement and
       store result
    2. Terminal (without classical_store): Mark readout basis for
       final measurement
    """

    # Track measurement basis for terminal measurements
    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    # Track which wires have been mid-circuit measured
    mid_circuit_measured = set()

    def circuit():
        # Dictionary to store classical bit values (for conditional operations)
        classical_bits = {}

        for operation in circuit_operations:
            gate = operation.gate.lower()
            wires = operation.wires
            params = operation.params or []

            # Check if this operation is conditional
            condition = getattr(operation, "condition", None)
            if condition:
                # Skip this operation if condition is not met
                classical_bit = condition.classical_bit
                expected_value = condition.value
                if classical_bit not in classical_bits:
                    logger.warning(
                        f"Classical bit {classical_bit} not yet "
                        "measured, skipping conditional gate"
                    )
                    continue
                if classical_bits[classical_bit] != expected_value:
                    continue  # Condition not met, skip this gate

            # Check if this is a mid-circuit measurement
            classical_store = getattr(operation, "classical_store", None)
            is_mid_circuit_meas = classical_store is not None

            try:
                # Helper to wrap gates with conditional execution
                def apply_gate_op(gate_func):
                    """Apply gate with conditional execution if needed."""
                    if condition:
                        # Use PennyLane's conditional execution
                        qml.cond(
                            classical_bits[condition.classical_bit]
                            == condition.value,
                            gate_func,
                        )()
                    else:
                        gate_func()

                if gate == "hadamard" or gate == "h":
                    apply_gate_op(lambda: qml.Hadamard(wires=wires[0]))
                elif gate == "paulix" or gate == "x":
                    apply_gate_op(lambda: qml.PauliX(wires=wires[0]))
                elif gate == "pauliy" or gate == "y":
                    apply_gate_op(lambda: qml.PauliY(wires=wires[0]))
                elif gate == "pauliz" or gate == "z":
                    apply_gate_op(lambda: qml.PauliZ(wires=wires[0]))
                elif gate == "swap":
                    # SWAP gate - order can be either direction
                    if len(wires) != 2:
                        raise ValueError(
                            "SWAP gate requires exactly 2 wires, "
                            + f"got {len(wires)}"
                        )
                    apply_gate_op(lambda: qml.SWAP(wires=[wires[0], wires[1]]))
                elif gate == "cnot" or gate == "cx":
                    # CNOT - wires[0]=control, wires[1]=target
                    if len(wires) != 2:
                        raise ValueError(
                            "CNOT gate requires exactly 2 wires, "
                            + f"got {len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CNOT(wires=[wires[0], wires[1]]))
                elif gate == "cz":
                    # CZ - wires[0]=control, wires[1]=target
                    if len(wires) != 2:
                        raise ValueError(
                            "CZ gate requires exactly 2 wires, "
                            + f"got {len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CZ(wires=[wires[0], wires[1]]))
                elif gate == "cy":
                    # CY - wires[0]=control, wires[1]=target
                    if len(wires) != 2:
                        raise ValueError(
                            "CY gate requires exactly 2 wires, "
                            + f"got {len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CY(wires=[wires[0], wires[1]]))
                elif gate in ("crx", "controlled-rx"):
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRX gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRX gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CRX(params[0], wires=wires))
                elif gate in ("cry", "controlled-ry"):
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRY gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRY gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CRY(params[0], wires=wires))
                elif gate in ("crz", "controlled-rz"):
                    if not params or len(params) == 0:
                        raise ValueError(
                            "CRZ gate requires rotation angle parameter"
                        )
                    if len(wires) != 2:
                        raise ValueError(
                            "CRZ gate requires exactly 2 wires, got "
                            f"{len(wires)}"
                        )
                    apply_gate_op(lambda: qml.CRZ(params[0], wires=wires))
                elif gate == "rx":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RX gate requires rotation angle parameter"
                        )
                    apply_gate_op(lambda: qml.RX(params[0], wires=wires[0]))
                elif gate == "ry":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RY gate requires rotation angle parameter"
                        )
                    apply_gate_op(lambda: qml.RY(params[0], wires=wires[0]))
                elif gate == "rz":
                    if not params or len(params) == 0:
                        raise ValueError(
                            "RZ gate requires rotation angle parameter"
                        )
                    apply_gate_op(lambda: qml.RZ(params[0], wires=wires[0]))
                elif gate == "phase" or gate == "s":
                    apply_gate_op(lambda: qml.S(wires=wires[0]))
                elif gate == "t":
                    apply_gate_op(lambda: qml.T(wires=wires[0]))
                elif gate == "toffoli" or gate == "ccx":
                    # Toffoli - c1=wires[0], c2=wires[1], t=wires[2]
                    if len(wires) != 3:
                        raise ValueError(
                            "Toffoli gate requires exactly 3 wires, "
                            + f"got {len(wires)}"
                        )
                    apply_gate_op(
                        lambda: qml.Toffoli(
                            wires=[wires[0], wires[1], wires[2]]
                        )
                    )
                elif gate in ("measurez", "mz", "measure_z"):
                    if len(wires) != 1:
                        raise ValueError("MeasureZ requires exactly 1 wire")

                    if is_mid_circuit_meas:
                        # Mid-circuit: measure and store in classical
                        # For Z-basis, no rotation needed
                        m = qml.measure(wires[0])
                        classical_bits[classical_store] = m
                        mid_circuit_measured.add(wires[0])
                    else:
                        # Terminal: mark basis for final readout
                        measurement_basis[wires[0]] = "Z"
                        explicit_measured.add(wires[0])

                elif gate in ("measurex", "mx", "measure_x"):
                    if len(wires) != 1:
                        raise ValueError("MeasureX requires exactly 1 wire")

                    if is_mid_circuit_meas:
                        # Mid-circuit in X basis: H, measure
                        qml.Hadamard(wires=wires[0])
                        m = qml.measure(wires[0])
                        classical_bits[classical_store] = m
                        mid_circuit_measured.add(wires[0])
                    else:
                        # Terminal: mark basis for final readout
                        measurement_basis[wires[0]] = "X"
                        explicit_measured.add(wires[0])

                elif gate in ("measurey", "my", "measure_y"):
                    if len(wires) != 1:
                        raise ValueError("MeasureY requires exactly 1 wire")

                    if is_mid_circuit_meas:
                        # Mid-circuit in Y: S†H, measure
                        qml.adjoint(qml.S)(wires=wires[0])
                        qml.Hadamard(wires=wires[0])
                        m = qml.measure(wires[0])
                        classical_bits[classical_store] = m
                        mid_circuit_measured.add(wires[0])
                    else:
                        # Terminal: mark basis for final readout
                        measurement_basis[wires[0]] = "Y"
                        explicit_measured.add(wires[0])
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

        # Decide measurement wires set
        measured_wires = sorted(explicit_measured)
        if not measured_wires:
            measured_wires = list(range(num_qubits))

        # Return according to result_mode
        if (result_mode or "probs").lower() == "expval":
            # Expectation values of Z on selected wires after basis rotation
            return [qml.expval(qml.PauliZ(wires=w)) for w in measured_wires]
        # Default: probabilities (marginal over selected wires)
        return qml.probs(wires=measured_wires)

    return circuit


def generate_pennylane_code(
    circuit_operations: list,
    num_qubits: int,
    num_shots: int,
    result_mode: str = "probs",
) -> str:
    """Generate PennyLane Python source code for the circuit."""

    lines = []
    lines.append("import pennylane as qml")
    lines.append("import numpy as np")
    lines.append("")
    lines.append(f"# Create a quantum device with {num_qubits} qubit(s)")
    lines.append(
        f'dev = qml.device("default.qubit", '
        f"wires={num_qubits}, shots={num_shots})"
    )
    lines.append("")
    lines.append("# Define the quantum circuit")
    lines.append("@qml.qnode(dev)")
    lines.append("def circuit():")

    # Track measurement bases
    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    # Generate circuit operations
    has_ops = False
    for operation in circuit_operations:
        gate = operation.gate.lower()
        wires = operation.wires
        params = operation.params or []

        if gate == "hadamard" or gate == "h":
            lines.append(f"    qml.Hadamard(wires={wires[0]})")
            has_ops = True
        elif gate == "paulix" or gate == "x":
            lines.append(f"    qml.PauliX(wires={wires[0]})")
            has_ops = True
        elif gate == "pauliy" or gate == "y":
            lines.append(f"    qml.PauliY(wires={wires[0]})")
            has_ops = True
        elif gate == "pauliz" or gate == "z":
            lines.append(f"    qml.PauliZ(wires={wires[0]})")
            has_ops = True
        elif gate == "swap":
            lines.append(f"    qml.SWAP(wires={wires})")
            has_ops = True
        elif gate == "cnot" or gate == "cx":
            lines.append(f"    qml.CNOT(wires={wires})")
            has_ops = True
        elif gate == "cz":
            lines.append(f"    qml.CZ(wires={wires})")
            has_ops = True
        elif gate == "cy":
            lines.append(f"    qml.CY(wires={wires})")
            has_ops = True
        elif gate in ("crx", "controlled-rx"):
            lines.append(f"    qml.CRX({params[0]}, wires={wires})")
            has_ops = True
        elif gate in ("cry", "controlled-ry"):
            lines.append(f"    qml.CRY({params[0]}, wires={wires})")
            has_ops = True
        elif gate in ("crz", "controlled-rz"):
            lines.append(f"    qml.CRZ({params[0]}, wires={wires})")
            has_ops = True
        elif gate == "rx":
            lines.append(f"    qml.RX({params[0]}, wires={wires[0]})")
            has_ops = True
        elif gate == "ry":
            lines.append(f"    qml.RY({params[0]}, wires={wires[0]})")
            has_ops = True
        elif gate == "rz":
            lines.append(f"    qml.RZ({params[0]}, wires={wires[0]})")
            has_ops = True
        elif gate == "phase" or gate == "s":
            lines.append(f"    qml.S(wires={wires[0]})")
            has_ops = True
        elif gate == "t":
            lines.append(f"    qml.T(wires={wires[0]})")
            has_ops = True
        elif gate == "toffoli" or gate == "ccx":
            lines.append(f"    qml.Toffoli(wires={wires})")
            has_ops = True
        elif gate in ("measurez", "mz", "measure_z"):
            measurement_basis[wires[0]] = "Z"
            explicit_measured.add(wires[0])
            lines.append(f"    # Measure qubit {wires[0]} in Z basis")
        elif gate in ("measurex", "mx", "measure_x"):
            measurement_basis[wires[0]] = "X"
            explicit_measured.add(wires[0])
            lines.append(f"    # Measure qubit {wires[0]} in X basis")
        elif gate in ("measurey", "my", "measure_y"):
            measurement_basis[wires[0]] = "Y"
            explicit_measured.add(wires[0])
            lines.append(f"    # Measure qubit {wires[0]} in Y basis")

    if not has_ops:
        lines.append("    pass  # Empty circuit")

    lines.append("")
    lines.append("    # Apply basis rotations for measurement")
    for w, b in measurement_basis.items():
        if b == "X":
            lines.append(f"    qml.Hadamard(wires={w})")
        elif b == "Y":
            lines.append(f"    qml.adjoint(qml.S)(wires={w})")
            lines.append(f"    qml.Hadamard(wires={w})")

    lines.append("")
    measured_wires = sorted(explicit_measured)
    if not measured_wires:
        measured_wires = list(range(num_qubits))

    if result_mode == "expval":
        lines.append("    # Return expectation values")
        lines.append(
            f"    return [qml.expval(qml.PauliZ(wires={w})) "
            f"for w in {measured_wires}]"
        )
    else:
        lines.append("    # Return probabilities")
        lines.append(f"    return qml.probs(wires={measured_wires})")

    lines.append("")
    lines.append("# Execute the circuit")
    lines.append("result = circuit()")
    lines.append("print(result)")

    return "\n".join(lines)


def generate_qiskit_code(
    circuit_operations: list,
    num_qubits: int,
    num_shots: int,
    result_mode: str = "probs",
):
    """Generate Qiskit Python source code for the circuit."""
    lines = []
    lines.append(
        "from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister"
    )
    lines.append("from qiskit_aer import AerSimulator")
    lines.append("")
    lines.append(f"qr = QuantumRegister({num_qubits}, 'q')")
    lines.append(f"cr = ClassicalRegister({num_qubits}, 'c')")
    lines.append("qc = QuantumCircuit(qr, cr)")
    lines.append("")

    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    for op in circuit_operations:
        gate = op.gate.lower()
        w = op.wires
        p = op.params or []
        if gate in ("hadamard", "h"):
            lines.append(f"qc.h({w[0]})")
        elif gate in ("paulix", "x"):
            lines.append(f"qc.x({w[0]})")
        elif gate in ("pauliy", "y"):
            lines.append(f"qc.y({w[0]})")
        elif gate in ("pauliz", "z"):
            lines.append(f"qc.z({w[0]})")
        elif gate == "swap":
            lines.append(f"qc.swap({w[0]}, {w[1]})")
        elif gate in ("cnot", "cx"):
            lines.append(f"qc.cx({w[0]}, {w[1]})")
        elif gate == "cz":
            lines.append(f"qc.cz({w[0]}, {w[1]})")
        elif gate == "cy":
            lines.append(f"qc.cy({w[0]}, {w[1]})")
        elif gate in ("crx", "controlled-rx"):
            lines.append(f"qc.crx({p[0]}, {w[0]}, {w[1]})")
        elif gate in ("cry", "controlled-ry"):
            lines.append(f"qc.cry({p[0]}, {w[0]}, {w[1]})")
        elif gate in ("crz", "controlled-rz"):
            lines.append(f"qc.crz({p[0]}, {w[0]}, {w[1]})")
        elif gate == "rx":
            lines.append(f"qc.rx({p[0]}, {w[0]})")
        elif gate == "ry":
            lines.append(f"qc.ry({p[0]}, {w[0]})")
        elif gate == "rz":
            lines.append(f"qc.rz({p[0]}, {w[0]})")
        elif gate in ("phase", "s"):
            lines.append(f"qc.s({w[0]})")
        elif gate == "t":
            lines.append(f"qc.t({w[0]})")
        elif gate in ("toffoli", "ccx"):
            lines.append(f"qc.ccx({w[0]}, {w[1]}, {w[2]})")
        elif gate in ("measurez", "mz", "measure_z"):
            measurement_basis[w[0]] = "Z"
            explicit_measured.add(w[0])
        elif gate in ("measurex", "mx", "measure_x"):
            measurement_basis[w[0]] = "X"
            explicit_measured.add(w[0])
        elif gate in ("measurey", "my", "measure_y"):
            measurement_basis[w[0]] = "Y"
            explicit_measured.add(w[0])

    # Basis rotation before measurement (approximate with H and Sdg+H)
    for w, b in measurement_basis.items():
        if b == "X":
            lines.append(f"qc.h({w})")
        elif b == "Y":
            lines.append(f"qc.sdg({w})")
            lines.append(f"qc.h({w})")

    measured_wires = sorted(explicit_measured) or list(range(num_qubits))
    for w in measured_wires:
        lines.append(f"qc.measure({w}, {w})")

    lines.append("")
    lines.append("backend = AerSimulator()")
    lines.append(f"job = backend.run(qc, shots={num_shots})")
    lines.append("result = job.result().get_counts(qc)")
    lines.append("print(result)")

    return "\n".join(lines)


def generate_qulacs_code(
    circuit_operations: list,
    num_qubits: int,
    num_shots: int,
    result_mode: str = "probs",
):
    """Generate Qulacs Python source code for the circuit (basic gates)."""
    lines = []
    lines.append("from qulacs import QuantumState, QuantumCircuit")
    lines.append("from qulacs.gate import *")
    lines.append("")
    lines.append(f"state = QuantumState({num_qubits})")
    lines.append(f"circuit = QuantumCircuit({num_qubits})")
    lines.append("")

    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    for op in circuit_operations:
        g = op.gate.lower()
        w = op.wires
        p = op.params or []
        if g in ("hadamard", "h"):
            lines.append(f"circuit.add_gate(H({w[0]}))")
        elif g in ("paulix", "x"):
            lines.append(f"circuit.add_gate(X({w[0]}))")
        elif g in ("pauliy", "y"):
            lines.append(f"circuit.add_gate(Y({w[0]}))")
        elif g in ("pauliz", "z"):
            lines.append(f"circuit.add_gate(Z({w[0]}))")
        elif g == "swap":
            lines.append(f"circuit.add_gate(SWAP({w[0]}, {w[1]}))")
        elif g in ("cnot", "cx"):
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
        elif g == "cz":
            lines.append(f"circuit.add_gate(CZ({w[0]}, {w[1]}))")
        elif g == "cy":
            lines.append(
                "# CY gate (Qulacs may not have native CY, use "
                "decomposition)"
            )
            lines.append(f"circuit.add_gate(Sdag({w[1]}))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
            lines.append(f"circuit.add_gate(S({w[1]}))")
        elif g in ("crx", "controlled-rx"):
            lines.append("# CRX gate (use decomposition)")
            lines.append(f"circuit.add_gate(RX({w[1]}, {p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
            lines.append(f"circuit.add_gate(RX({w[1]}, -{p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
        elif g in ("cry", "controlled-ry"):
            lines.append("# CRY gate (use decomposition)")
            lines.append(f"circuit.add_gate(RY({w[1]}, {p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
            lines.append(f"circuit.add_gate(RY({w[1]}, -{p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
        elif g in ("crz", "controlled-rz"):
            lines.append("# CRZ gate (use decomposition)")
            lines.append(f"circuit.add_gate(RZ({w[1]}, {p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
            lines.append(f"circuit.add_gate(RZ({w[1]}, -{p[0]}/2))")
            lines.append(f"circuit.add_gate(CNOT({w[0]}, {w[1]}))")
        elif g == "rx":
            lines.append(f"circuit.add_gate(RX({w[0]}, {p[0]}))")
        elif g == "ry":
            lines.append(f"circuit.add_gate(RY({w[0]}, {p[0]}))")
        elif g == "rz":
            lines.append(f"circuit.add_gate(RZ({w[0]}, {p[0]}))")
        elif g in ("phase", "s"):
            lines.append(f"circuit.add_gate(S({w[0]}))")
        elif g == "t":
            lines.append(f"circuit.add_gate(T({w[0]}))")
        elif g in ("toffoli", "ccx"):
            lines.append(f"circuit.add_gate(TOFFOLI({w[0]}, {w[1]}, {w[2]}))")
        elif g in ("measurez", "mz", "measure_z"):
            measurement_basis[w[0]] = "Z"
            explicit_measured.add(w[0])
        elif g in ("measurex", "mx", "measure_x"):
            measurement_basis[w[0]] = "X"
            explicit_measured.add(w[0])
        elif g in ("measurey", "my", "measure_y"):
            measurement_basis[w[0]] = "Y"
            explicit_measured.add(w[0])

    # Basis rotation (approximate)
    for w, b in measurement_basis.items():
        if b == "X":
            lines.append(f"circuit.add_gate(H({w}))")
        elif b == "Y":
            lines.append(f"circuit.add_gate(Sdag({w}))")
            lines.append(f"circuit.add_gate(H({w}))")

    lines.append("circuit.update_quantum_state(state)")
    lines.append("print(state.get_vector())  # amplitudes")
    lines.append(
        "# To obtain probabilities, square amplitudes or sample via "
        "repeated runs."
    )

    return "\n".join(lines)


def generate_qasm_code(
    circuit_operations: list,
    num_qubits: int,
    num_shots: int,
    result_mode: str = "probs",
):
    """Generate OpenQASM 2.0 source code for the circuit."""
    lines = []
    lines.append("OPENQASM 2.0;")
    lines.append('include "qelib1.inc";')
    lines.append(f"qreg q[{num_qubits}];")
    lines.append(f"creg c[{num_qubits}];")

    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    for op in circuit_operations:
        g = op.gate.lower()
        w = op.wires
        p = op.params or []
        if g in ("hadamard", "h"):
            lines.append(f"h q[{w[0]}];")
        elif g in ("paulix", "x"):
            lines.append(f"x q[{w[0]}];")
        elif g in ("pauliy", "y"):
            lines.append(f"y q[{w[0]}];")
        elif g in ("pauliz", "z"):
            lines.append(f"z q[{w[0]}];")
        elif g == "swap":
            lines.append(f"swap q[{w[0]}],q[{w[1]}];")
        elif g in ("cnot", "cx"):
            lines.append(f"cx q[{w[0]}],q[{w[1]}];")
        elif g == "cz":
            lines.append(f"cz q[{w[0]}],q[{w[1]}];")
        elif g == "cy":
            lines.append(f"cy q[{w[0]}],q[{w[1]}];")
        elif g in ("crx", "controlled-rx"):
            lines.append(f"crx({p[0]}) q[{w[0]}],q[{w[1]}];")
        elif g in ("cry", "controlled-ry"):
            lines.append(f"cry({p[0]}) q[{w[0]}],q[{w[1]}];")
        elif g in ("crz", "controlled-rz"):
            lines.append(f"crz({p[0]}) q[{w[0]}],q[{w[1]}];")
        elif g == "rx":
            lines.append(f"rx({p[0]}) q[{w[0]}];")
        elif g == "ry":
            lines.append(f"ry({p[0]}) q[{w[0]}];")
        elif g == "rz":
            lines.append(f"rz({p[0]}) q[{w[0]}];")
        elif g in ("phase", "s"):
            lines.append(f"s q[{w[0]}];")
        elif g == "t":
            lines.append(f"t q[{w[0]}];")
        elif g in ("toffoli", "ccx"):
            lines.append(f"ccx q[{w[0]}],q[{w[1]}],q[{w[2]}];")
        elif g in ("measurez", "mz", "measure_z"):
            measurement_basis[w[0]] = "Z"
            explicit_measured.add(w[0])
        elif g in ("measurex", "mx", "measure_x"):
            measurement_basis[w[0]] = "X"
            explicit_measured.add(w[0])
        elif g in ("measurey", "my", "measure_y"):
            measurement_basis[w[0]] = "Y"
            explicit_measured.add(w[0])

    for w, b in measurement_basis.items():
        if b == "X":
            lines.append(f"h q[{w}];")
        elif b == "Y":
            lines.append(f"sdg q[{w}];")
            lines.append(f"h q[{w}];")

    measured_wires = sorted(explicit_measured) or list(range(num_qubits))
    for w in measured_wires:
        lines.append(f"measure q[{w}] -> c[{w}];")

    return "\n".join(lines)


def generate_latex_code(
    circuit_operations: list,
    num_qubits: int,
    num_shots: int,
    result_mode: str = "probs",
):
    """Generate standalone LaTeX code using quantikz package for
    the circuit."""

    def format_angle(radians):
        """Format angle in radians to a nice LaTeX representation."""
        import math

        # Check for common multiples of pi
        pi_ratio = radians / math.pi

        # Check if it's close to a simple fraction of pi
        simple_fractions = [
            (0, "0"),
            (0.125, "\\pi/8"),
            (0.25, "\\pi/4"),
            (0.375, "3\\pi/8"),
            (0.5, "\\pi/2"),
            (0.625, "5\\pi/8"),
            (0.75, "3\\pi/4"),
            (0.875, "7\\pi/8"),
            (1, "\\pi"),
            (1.25, "5\\pi/4"),
            (1.5, "3\\pi/2"),
            (1.75, "7\\pi/4"),
            (2, "2\\pi"),
            (-0.125, "-\\pi/8"),
            (-0.25, "-\\pi/4"),
            (-0.375, "-3\\pi/8"),
            (-0.5, "-\\pi/2"),
            (-0.625, "-5\\pi/8"),
            (-0.75, "-3\\pi/4"),
            (-0.875, "-7\\pi/8"),
            (-1, "-\\pi"),
            (-1.25, "-5\\pi/4"),
            (-1.5, "-3\\pi/2"),
            (-1.75, "-7\\pi/4"),
            (-2, "-2\\pi"),
        ]

        for fraction, latex_str in simple_fractions:
            if abs(pi_ratio - fraction) < 0.01:  # tolerance
                return latex_str

        # Check if it's close to n*pi where n is an integer
        if abs(pi_ratio - round(pi_ratio)) < 0.01:
            n = int(round(pi_ratio))
            if n == 0:
                return "0"
            elif n == 1:
                return "\\pi"
            elif n == -1:
                return "-\\pi"
            else:
                return f"{n}\\pi"

        # Otherwise, format as decimal
        return f"{radians:.3f}".rstrip("0").rstrip(".")

    lines = []
    lines.append("\\documentclass[border=2pt]{standalone}")
    lines.append("\\usepackage{quantikz}")
    lines.append("")
    lines.append("\\begin{document}")
    lines.append("\\begin{quantikz}")

    # Track operations by column
    # Build gate matrix: [qubit][column] = gate_instruction
    max_cols = len(circuit_operations) + 2  # Initial + ops + measurements
    grid = [[None for _ in range(max_cols)] for _ in range(num_qubits)]

    # Track which columns are used for multi-qubit gates
    col_idx = 0

    measurement_basis = {w: "Z" for w in range(num_qubits)}
    explicit_measured = set()

    for op in circuit_operations:
        g = op.gate.lower()
        w = op.wires
        p = op.params or []

        # Single-qubit gates
        if g in ("hadamard", "h"):
            grid[w[0]][col_idx] = "\\gate{H}"
        elif g in ("paulix", "x"):
            grid[w[0]][col_idx] = "\\gate{X}"
        elif g in ("pauliy", "y"):
            grid[w[0]][col_idx] = "\\gate{Y}"
        elif g in ("pauliz", "z"):
            grid[w[0]][col_idx] = "\\gate{Z}"
        elif g == "rx":
            angle_str = format_angle(p[0])
            grid[w[0]][col_idx] = f"\\gate{{R_x({angle_str})}}"
        elif g == "ry":
            angle_str = format_angle(p[0])
            grid[w[0]][col_idx] = f"\\gate{{R_y({angle_str})}}"
        elif g == "rz":
            angle_str = format_angle(p[0])
            grid[w[0]][col_idx] = f"\\gate{{R_z({angle_str})}}"
        elif g in ("phase", "s"):
            grid[w[0]][col_idx] = "\\gate{S}"
        elif g == "t":
            grid[w[0]][col_idx] = "\\gate{T}"

        # Two-qubit gates
        elif g == "swap":
            min_w, max_w = min(w[0], w[1]), max(w[0], w[1])
            grid[min_w][col_idx] = f"\\swap{{{max_w - min_w}}}"
            grid[max_w][col_idx] = "\\targX{}"
            # Fill wires in between
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g in ("cnot", "cx"):
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = "\\targ{}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g == "cz":
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = "\\gate{Z}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g == "cy":
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = "\\gate{Y}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g in ("crx", "controlled-rx"):
            angle_str = format_angle(p[0])
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = f"\\gate{{R_x({angle_str})}}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g in ("cry", "controlled-ry"):
            angle_str = format_angle(p[0])
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = f"\\gate{{R_y({angle_str})}}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
        elif g in ("crz", "controlled-rz"):
            angle_str = format_angle(p[0])
            ctrl, targ = w[0], w[1]
            grid[ctrl][col_idx] = f"\\ctrl{{{targ - ctrl}}}"
            grid[targ][col_idx] = f"\\gate{{R_z({angle_str})}}"
            # Fill wires in between
            min_w, max_w = (ctrl, targ) if ctrl < targ else (targ, ctrl)
            for between in range(min_w + 1, max_w):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"

        # Three-qubit gates
        elif g in ("toffoli", "ccx"):
            ctrl1, ctrl2, targ = w[0], w[1], w[2]
            grid[ctrl1][col_idx] = f"\\ctrl{{{ctrl2 - ctrl1}}}"
            grid[ctrl2][col_idx] = f"\\ctrl{{{targ - ctrl2}}}"
            grid[targ][col_idx] = "\\targ{}"
            # Fill wires in between ctrl1 and ctrl2
            min_w1, max_w1 = (
                (ctrl1, ctrl2) if ctrl1 < ctrl2 else (ctrl2, ctrl1)
            )
            for between in range(min_w1 + 1, max_w1):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"
            # Fill wires in between ctrl2 and targ
            min_w2, max_w2 = (ctrl2, targ) if ctrl2 < targ else (targ, ctrl2)
            for between in range(min_w2 + 1, max_w2):
                if grid[between][col_idx] is None:
                    grid[between][col_idx] = "\\qwx"

        # Measurement gates
        elif g in ("measurez", "mz", "measure_z"):
            measurement_basis[w[0]] = "Z"
            explicit_measured.add(w[0])
        elif g in ("measurex", "mx", "measure_x"):
            measurement_basis[w[0]] = "X"
            explicit_measured.add(w[0])
        elif g in ("measurey", "my", "measure_y"):
            measurement_basis[w[0]] = "Y"
            explicit_measured.add(w[0])

        col_idx += 1

    # Add basis rotations for measurement
    basis_col = col_idx
    has_basis_rotation = False
    for w, b in measurement_basis.items():
        if b == "X":
            grid[w][basis_col] = "\\gate{H}"
            has_basis_rotation = True
        elif b == "Y":
            grid[w][basis_col] = "\\gate{S^\\dagger}"
            has_basis_rotation = True

    if has_basis_rotation:
        col_idx += 1
        # Add H for Y basis after S†
        for w, b in measurement_basis.items():
            if b == "Y" and grid[w][col_idx] is None:
                grid[w][col_idx] = "\\gate{H}"
        col_idx += 1

    # Add measurement symbols
    measured_wires = sorted(explicit_measured) or list(range(num_qubits))
    meas_col = col_idx
    for w in measured_wires:
        grid[w][meas_col] = "\\meter{}"

    # Generate quantikz code
    for q in range(num_qubits):
        row_parts = [f"\\lstick{{$|q_{{{q}}}\\rangle$}}"]

        for c in range(max_cols):
            if grid[q][c] is not None:
                row_parts.append(grid[q][c])
            else:
                row_parts.append("\\qw")

        line = " & ".join(row_parts)
        if q < num_qubits - 1:
            line += " \\\\"
        lines.append("  " + line)

    lines.append("\\end{quantikz}")
    lines.append("\\end{document}")

    return "\n".join(lines)


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

        # Check if circuit uses dynamic features
        has_dynamic_features = any(
            (hasattr(op, "classical_store") and op.classical_store is not None)
            or (hasattr(op, "condition") and op.condition is not None)
            for op in request.circuit
        )

        # Create PennyLane device with appropriate settings
        if has_dynamic_features:
            # Dynamic circuits with mid-circuit measurement
            device = qml.device(
                "default.qubit", wires=request.qubits, shots=request.shots
            )
        else:
            # Standard circuits
            device = qml.device(
                "default.qubit", wires=request.qubits, shots=request.shots
            )

        # Create the circuit function
        circuit_func = create_circuit_function(
            request.circuit,
            request.qubits,
            request.classical_bits,
            request.result_mode,
        )

        # Create QNode
        qnode = qml.QNode(circuit_func, device)

        # Execute the circuit
        result_raw = qnode()

        # Generate code outputs
        requested = set((request.code_formats or ["pennylane"]))
        pennylane_code = None
        qiskit_code = None
        qulacs_code = None
        qasm_code = None
        latex_code = None

        if "pennylane" in requested:
            pennylane_code = generate_pennylane_code(
                request.circuit,
                request.qubits,
                request.shots,
                request.result_mode,
            )
        if "qiskit" in requested:
            qiskit_code = generate_qiskit_code(
                request.circuit,
                request.qubits,
                request.shots,
                request.result_mode,
            )
        if "qulacs" in requested:
            qulacs_code = generate_qulacs_code(
                request.circuit,
                request.qubits,
                request.shots,
                request.result_mode,
            )
        if "qasm" in requested:
            qasm_code = generate_qasm_code(
                request.circuit,
                request.qubits,
                request.shots,
                request.result_mode,
            )
        if "latex" in requested:
            latex_code = generate_latex_code(
                request.circuit,
                request.qubits,
                request.shots,
                request.result_mode,
            )

        # Decide labeling width (if measured subset, width = len(measured))
        # Reconstruct explicit measured wires/bases like in circuit build
        measurement_basis = {w: "Z" for w in range(request.qubits)}
        explicit_measured = set()
        for op in request.circuit:
            g = op.gate.lower()
            if g in ("measurez", "mz", "measure_z"):
                measurement_basis[op.wires[0]] = "Z"
                explicit_measured.add(op.wires[0])
            elif g in ("measurex", "mx", "measure_x"):
                measurement_basis[op.wires[0]] = "X"
                explicit_measured.add(op.wires[0])
            elif g in ("measurey", "my", "measure_y"):
                measurement_basis[op.wires[0]] = "Y"
                explicit_measured.add(op.wires[0])
        measured_wires = sorted(explicit_measured)
        has_subset = (
            len(measured_wires) > 0 and len(measured_wires) < request.qubits
        )
        mode = (request.result_mode or "probs").lower()

        if mode == "expval":
            # result_raw is a sequence of expectation values per measured wire
            # order
            expectations = {}
            for idx, w in enumerate(
                measured_wires if measured_wires else range(request.qubits)
            ):
                # result_raw could be a list/np array; cast to float
                expectations[w] = float(result_raw[idx])
            logger.info(
                f"Circuit execution successful. Expectations: {expectations}"
            )
            return CircuitResponse(
                probabilities={},
                success=True,
                message="Circuit executed successfully",
                measured_wires=measured_wires if has_subset else None,
                measured_bases=measurement_basis if has_subset else None,
                expectations=expectations,
                pennylane_code=pennylane_code,
                qiskit_code=qiskit_code,
                qulacs_code=qulacs_code,
                qasm_code=qasm_code,
                latex_code=latex_code,
            )
        else:
            # probs mode
            label_width = len(measured_wires) if has_subset else request.qubits
            prob_dict = {}
            for i, prob in enumerate(result_raw):
                binary_state = format(i, f"0{label_width}b")
                prob_dict[binary_state] = float(prob)

            logger.info(f"Circuit execution successful. Results: {prob_dict}")

            marginal = prob_dict if has_subset else None

            return CircuitResponse(
                probabilities=prob_dict,
                success=True,
                message="Circuit executed successfully",
                marginal_probabilities=marginal,
                measured_wires=measured_wires if has_subset else None,
                measured_bases=measurement_basis if has_subset else None,
                pennylane_code=pennylane_code,
                qiskit_code=qiskit_code,
                qulacs_code=qulacs_code,
                qasm_code=qasm_code,
                latex_code=latex_code,
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
            "name": "SWAP",
            "symbol": "SWAP",
            "description": "SWAP gate",
            "params": 0,
            "qubits": 2,
        },
        {
            "name": "CNOT",
            "symbol": "⊕",
            "description": "Controlled-NOT gate",
            "params": 0,
            "qubits": 2,
        },
        {
            "name": "Controlled-Z",
            "symbol": "CZ",
            "description": "Controlled-Z gate",
            "params": 0,
            "qubits": 2,
        },
        {
            "name": "Controlled-Y",
            "symbol": "CY",
            "description": "Controlled-Y gate",
            "params": 0,
            "qubits": 2,
        },
        {
            "name": "Controlled-RX",
            "symbol": "CRX",
            "description": "Controlled-RX gate",
            "params": 1,
            "qubits": 2,
        },
        {
            "name": "Controlled-RY",
            "symbol": "CRY",
            "description": "Controlled-RY gate",
            "params": 1,
            "qubits": 2,
        },
        {
            "name": "Controlled-RZ",
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
        {
            "name": "Toffoli",
            "symbol": "CCX",
            "description": "Toffoli (CCX) gate",
            "params": 0,
            "qubits": 3,
        },
    ]
    return {"gates": gates}
