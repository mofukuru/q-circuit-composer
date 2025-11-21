import { GateType } from '@/store/circuitStore';

export const GATE_CONFIGS: Record<GateType, { label: string; color: string; description: string }> = {
  H: { label: 'H', color: 'bg-blue-500', description: 'Hadamard Gate' },
  X: { label: 'X', color: 'bg-red-500', description: 'Pauli-X Gate' },
  Y: { label: 'Y', color: 'bg-green-500', description: 'Pauli-Y Gate' },
  Z: { label: 'Z', color: 'bg-purple-500', description: 'Pauli-Z Gate' },
  CNOT: { label: 'CNOT', color: 'bg-orange-500', description: 'Controlled-NOT' },
  SWAP: { label: 'SWAP', color: 'bg-pink-500', description: 'SWAP Gate' },
  MEASURE: { label: 'M', color: 'bg-gray-500', description: 'Measurement' },
  Rx: { label: 'Rx', color: 'bg-cyan-500', description: 'X-Rotation' },
  Ry: { label: 'Ry', color: 'bg-teal-500', description: 'Y-Rotation' },
  Rz: { label: 'Rz', color: 'bg-indigo-500', description: 'Z-Rotation' },
  CCNOT: { label: 'CCNOT', color: 'bg-yellow-600', description: 'Toffoli Gate' },
  CSWAP: { label: 'CSWAP', color: 'bg-rose-600', description: 'Fredkin Gate' },
  CUSTOM: { label: 'Custom', color: 'bg-violet-600', description: 'Custom Gate' },
};
