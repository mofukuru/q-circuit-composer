import type { Circuit, Issue } from '../circuit';
import { type CodegenOptions, type CodegenResult, inBasis, prepare, pyAngle, skipped, symbolDeclarations } from './common';

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
  const { issues, ops, bases, measured, clbit, clbits, symbols, usesPi } = prepare(circuit);
  const extra: Issue[] = [];
  const body: string[] = [];
  // Mid-circuit results take the first classical bits; the final readout follows them.
  const readout = measured.map((_, i) => clbits + i);

  for (const op of ops) {
    if (op.gate === 'MEASURE') {
      const bit = clbit.get(op.id);
      if (bit === undefined) continue;
      const w = op.targets[0];
      const { before, after } = inBasis(op.basis, `qc.sdg(${w})`, `qc.h(${w})`, `qc.s(${w})`);
      body.push(...before, `qc.measure(${w}, ${bit})`, ...after);
      continue;
    }
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'Qiskit'));
      body.push(`# custom gate on qubits ${op.targets.join(', ')} skipped`);
      continue;
    }
    const args = [...op.params.map((p) => pyAngle(p)), ...op.controls, ...op.targets];
    const call = `qc.${METHODS[op.gate]}(${args.join(', ')})`;
    if (op.condition) body.push(`with qc.if_test((qc.clbits[${op.condition.bit}], ${op.condition.value})):`, `    ${call}`);
    else body.push(call);
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
    ...(clbits > 0 ? ['from qiskit.result import marginal_counts'] : []),
    'from qiskit_aer import AerSimulator',
    '',
    ...symbolDeclarations(symbols),
    ...(clbits > 0 ? [`# Mid-circuit results use the first ${clbits} classical bit(s); the final readout follows.`] : []),
    `qc = QuantumCircuit(${circuit.numQubits}, ${clbits + measured.length})`,
    ...body,
    `qc.measure([${measured.join(', ')}], [${readout.join(', ')}])`,
    '',
    `counts = AerSimulator().run(qc, shots=${opts.shots ?? 1024}).result().get_counts()`,
    ...(clbits > 0
      ? ['# Keep only the final readout.', `counts = marginal_counts(counts, indices=[${readout.join(', ')}])`]
      : []),
    '# Qiskit writes the last classical bit first; reverse the keys to read',
    `# them in wire order (q${measured[0]} first).`,
    'print({bits[::-1]: n for bits, n in sorted(counts.items())})',
  ];
  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
