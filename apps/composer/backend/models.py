from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class GateOperation(BaseModel):
    gate: str
    wires: List[int]
    params: Optional[List[float]] = None


class CircuitRequest(BaseModel):
    qubits: int
    shots: int = 1024
    circuit: List[GateOperation]


class CircuitResponse(BaseModel):
    probabilities: Dict[str, float]
    success: bool = True
    message: str = ""
