export type GateName =
  | 'H'
  | 'X'
  | 'Y'
  | 'Z'
  | 'S'
  | 'T'
  | 'RX'
  | 'RY'
  | 'RZ'
  | 'CNOT'
  | 'CY'
  | 'CZ'
  | 'CRX'
  | 'CRY'
  | 'CRZ'
  | 'SWAP'
  | 'CCX'
  | 'CSWAP'
  | 'MEASURE'
  | 'CUSTOM';

export type GateCategory = 'single' | 'multi' | 'measure' | 'custom';

/** Single-qubit gate applied to the target(s) of a (possibly controlled) gate. */
export type BaseGate = 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'RX' | 'RY' | 'RZ' | 'SWAP';

export interface GateSpec {
  name: GateName;
  /** Short label shown on the gate box. */
  label: string;
  description: string;
  category: GateCategory;
  controls: number;
  /** Number of target wires; `null` means user-chosen (custom gates). */
  targets: number | null;
  params: number;
  /** The operation applied to the targets when all controls are |1>. */
  base?: BaseGate;
}

export const GATES: Record<GateName, GateSpec> = {
  H: { name: 'H', label: 'H', description: 'Hadamard', category: 'single', controls: 0, targets: 1, params: 0, base: 'H' },
  X: { name: 'X', label: 'X', description: 'Pauli-X (bit flip)', category: 'single', controls: 0, targets: 1, params: 0, base: 'X' },
  Y: { name: 'Y', label: 'Y', description: 'Pauli-Y', category: 'single', controls: 0, targets: 1, params: 0, base: 'Y' },
  Z: { name: 'Z', label: 'Z', description: 'Pauli-Z (phase flip)', category: 'single', controls: 0, targets: 1, params: 0, base: 'Z' },
  S: { name: 'S', label: 'S', description: 'Phase (S)', category: 'single', controls: 0, targets: 1, params: 0, base: 'S' },
  T: { name: 'T', label: 'T', description: 'T (π/8)', category: 'single', controls: 0, targets: 1, params: 0, base: 'T' },
  RX: { name: 'RX', label: 'RX', description: 'Rotation around X', category: 'single', controls: 0, targets: 1, params: 1, base: 'RX' },
  RY: { name: 'RY', label: 'RY', description: 'Rotation around Y', category: 'single', controls: 0, targets: 1, params: 1, base: 'RY' },
  RZ: { name: 'RZ', label: 'RZ', description: 'Rotation around Z', category: 'single', controls: 0, targets: 1, params: 1, base: 'RZ' },
  CNOT: { name: 'CNOT', label: 'CX', description: 'Controlled-NOT', category: 'multi', controls: 1, targets: 1, params: 0, base: 'X' },
  CY: { name: 'CY', label: 'CY', description: 'Controlled-Y', category: 'multi', controls: 1, targets: 1, params: 0, base: 'Y' },
  CZ: { name: 'CZ', label: 'CZ', description: 'Controlled-Z', category: 'multi', controls: 1, targets: 1, params: 0, base: 'Z' },
  CRX: { name: 'CRX', label: 'CRX', description: 'Controlled RX', category: 'multi', controls: 1, targets: 1, params: 1, base: 'RX' },
  CRY: { name: 'CRY', label: 'CRY', description: 'Controlled RY', category: 'multi', controls: 1, targets: 1, params: 1, base: 'RY' },
  CRZ: { name: 'CRZ', label: 'CRZ', description: 'Controlled RZ', category: 'multi', controls: 1, targets: 1, params: 1, base: 'RZ' },
  SWAP: { name: 'SWAP', label: 'SWAP', description: 'SWAP', category: 'multi', controls: 0, targets: 2, params: 0, base: 'SWAP' },
  CCX: { name: 'CCX', label: 'CCX', description: 'Toffoli (CCX)', category: 'multi', controls: 2, targets: 1, params: 0, base: 'X' },
  CSWAP: { name: 'CSWAP', label: 'CSWAP', description: 'Fredkin (controlled SWAP)', category: 'multi', controls: 1, targets: 2, params: 0, base: 'SWAP' },
  MEASURE: { name: 'MEASURE', label: 'M', description: 'Measurement (readout basis)', category: 'measure', controls: 0, targets: 1, params: 0 },
  CUSTOM: { name: 'CUSTOM', label: 'U', description: 'Custom gate (LaTeX only)', category: 'custom', controls: 0, targets: null, params: 0 },
};

export const GATE_NAMES = Object.keys(GATES) as GateName[];
