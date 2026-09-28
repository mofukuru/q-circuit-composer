import type { Circuit, Issue } from '../circuit';
import { type CodegenOptions, type CodegenResult, prepare, pyAngle, skipped, symbolDeclarations } from './common';

const METHODS: Record<string, string> = {
  H: 'h',
  X: 'x',
  Y: 'y',
  Z: 'z',
  S: 's',
  T: 't',
  RX: 'rx',
  RY: 'ry',
  RZ: 'rz',
  CNOT: 'cx',
  CY: 'cy',
  CZ: 'cz',
  CRX: 'crx',
  CRY: 'cry',
  CRZ: 'crz',
  SWAP: 'swap',
  CCX: 'ccx',
  CSWAP: 'cswap',
};

export function generateQiskit(circuit: Circuit, opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops, bases, measured, symbols, usesPi } = prepare(circuit);
  const extra: Issue[] = [];
  const body: string[] = [];

  for (const op of ops) {
    if (op.gate === 'MEASURE') continue;
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'Qiskit'));
      body.push(`# custom gate on qubits ${op.targets.join(', ')} skipped`);
      continue;
    }
    const args = [...op.params.map((p) => pyAngle(p)), ...op.controls, ...op.targets];
    body.push(`qc.${METHODS[op.gate]}(${args.join(', ')})`);
  }

  const rotations: string[] = [];
  for (const [w, b] of [...bases].sort(([a], [c]) => a - c)) {
    if (b === 'Y') rotations.push(`qc.sdg(${w})`);
    if (b !== 'Z') rotations.push(`qc.h(${w})`);
  }
  if (rotations.length > 0) body.push('', '# Rotate into the readout basis', ...rotations);

  const lines = [
    ...(usesPi ? ['import numpy as np'] : []),
    'from qiskit import QuantumCircuit',
    'from qiskit_aer import AerSimulator',
    '',
    ...symbolDeclarations(symbols),
    `qc = QuantumCircuit(${circuit.numQubits}, ${measured.length})`,
    ...body,
    `qc.measure([${measured.join(', ')}], [${measured.map((_, i) => i).join(', ')}])`,
    '',
    `counts = AerSimulator().run(qc, shots=${opts.shots ?? 1024}).result().get_counts()`,
    '# Qiskit writes the last classical bit first; reverse the keys to read',
    `# them in wire order (q${measured[0]} first).`,
    'print({bits[::-1]: n for bits, n in sorted(counts.items())})',
  ];
  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
