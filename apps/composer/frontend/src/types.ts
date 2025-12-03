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
  // For mid-circuit measurement: store result in classical bit
  classical_store?: number; // classical bit index to store measurement result
  // For conditional gates: apply only if classical bit matches condition
  condition?: {
    classical_bit: number; // classical bit index to check
    value: 0 | 1; // expected value (0 or 1)
  };
}

export interface CircuitState {
  qubits: number;
  operations: GateOperation[];
  shots: number;
  classical_bits: number; // number of classical bits/registers
}

export interface CircuitRequest {
  qubits: number;
  shots: number;
  circuit: Array<{
    gate: string;
    wires: number[];
    params?: number[];
    classical_store?: number;
    condition?: {
      classical_bit: number;
      value: 0 | 1;
    };
  }>;
  classical_bits?: number;
  result_mode?: 'probs' | 'expval';
  code_formats?: Array<'pennylane' | 'qiskit' | 'qulacs' | 'qasm' | 'latex'>;
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
  // Mid-circuit measurement results (for dynamic circuits)
  classical_results?: { [bit: number]: number }; // classical bit -> measured value
  pennylane_code?: string;
  qiskit_code?: string;
  qulacs_code?: string;
  qasm_code?: string;
  latex_code?: string;
}