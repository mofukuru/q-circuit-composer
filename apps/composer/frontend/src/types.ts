export interface Gate {
  name: string;
  symbol: string;
  description: string;
  params: number;
  qubits: number;
}

export interface GateOperation {
  gate: string;
  wires: number[];
  params?: number[];
  id: string;
  position: { x: number; y: number };
  targetX?: number; // For CNOT target position
}

export interface CircuitState {
  qubits: number;
  operations: GateOperation[];
  shots: number;
}

export interface CircuitRequest {
  qubits: number;
  shots: number;
  circuit: Array<{
    gate: string;
    wires: number[];
    params?: number[];
  }>;
}

export interface CircuitResponse {
  probabilities: { [key: string]: number };
  success: boolean;
  message: string;
}