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


class CircuitResponse(BaseModel):
    probabilities: Dict[str, float]
    success: bool = True
    message: str = ""
