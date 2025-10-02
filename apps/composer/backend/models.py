from pydantic import BaseModel
from typing import List, Dict, Optional


class GateOperation(BaseModel):
    gate: str
    wires: List[int]
    params: Optional[List[float]] = None
    # For CNOT: wires[0] = control, wires[1] = target
    # For rotation gates: params[0] = rotation angle in radians


class CircuitRequest(BaseModel):
    qubits: int
    shots: int = 1024
    circuit: List[GateOperation]
    # Result mode: 'probs' (default) or 'expval' (per-wire expectation values)
    result_mode: str = "probs"


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
