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
  result_mode?: 'probs' | 'expval';
}

export interface CircuitResponse {
  probabilities: { [key: string]: number };
  success: boolean;
  message: string;
  // Optional fields returned by backend for measured-wire semantics
  marginal_probabilities?: { [key: string]: number };
  measured_wires?: number[];
  measured_bases?: { [wire: number]: 'Z' | 'X' | 'Y' };
  expectations?: { [wire: number]: number };
}