from pydantic import BaseModel
from typing import List, Dict, Optional


class ConditionalSpec(BaseModel):
    """Specification for conditional gate execution based on classical bit."""

    classical_bit: int  # classical bit index to check
    value: int  # expected value (0 or 1)


class GateOperation(BaseModel):
    gate: str
    wires: List[int]
    params: Optional[List[float]] = None
    # For CNOT: wires[0] = control, wires[1] = target
    # For rotation gates: params[0] = rotation angle in radians
    # For mid-circuit measurement: store result in classical bit
    classical_store: Optional[int] = None
    # For conditional gates: apply only if classical bit matches condition
    condition: Optional[ConditionalSpec] = None


class CircuitRequest(BaseModel):
    qubits: int
    shots: int = 1024
    circuit: List[GateOperation]
    classical_bits: int = 0  # number of classical bits/registers
    # Result mode: 'probs' (default) or 'expval' (per-wire expectation values)
    result_mode: str = "probs"
    # Code formats to generate: e.g., ["pennylane", "qiskit", "qulacs", "qasm"]
    code_formats: Optional[List[str]] = None


class CircuitResponse(BaseModel):
    probabilities: Dict[str, float]
    success: bool = True
    message: str = ""
    # Optional: measured-only marginal and metadata
    marginal_probabilities: Optional[Dict[str, float]] = None
    measured_wires: Optional[List[int]] = None
    measured_bases: Optional[Dict[int, str]] = None
    # Optional: per-wire expectation values when result_mode == 'expval'
    expectations: Optional[Dict[int, float]] = None
    # Mid-circuit measurement results (for dynamic circuits)
    classical_results: Optional[Dict[int, int]] = None
    # Optional: PennyLane source code
    pennylane_code: Optional[str] = None
    # Optional: additional code outputs
    qiskit_code: Optional[str] = None
    qulacs_code: Optional[str] = None
    qasm_code: Optional[str] = None
    latex_code: Optional[str] = None
