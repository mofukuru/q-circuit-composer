import type { Circuit, Issue } from '../circuit';
import { type CodegenOptions, type CodegenResult, prepare, pyAngle, skipped, symbolDeclarations } from './common';

const NAMES: Record<string, string> = {
  H: 'Hadamard',
  X: 'PauliX',
  Y: 'PauliY',
  Z: 'PauliZ',
  S: 'S',
  T: 'T',
  RX: 'RX',
  RY: 'RY',
  RZ: 'RZ',
  CNOT: 'CNOT',
  CY: 'CY',
  CZ: 'CZ',
  CRX: 'CRX',
  CRY: 'CRY',
  CRZ: 'CRZ',
  SWAP: 'SWAP',
  CCX: 'Toffoli',
  CSWAP: 'CSWAP',
};

const wiresArg = (wires: number[]) => (wires.length === 1 ? `${wires[0]}` : `[${wires.join(', ')}]`);

export function generatePennyLane(circuit: Circuit, opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops, bases, measured, symbols } = prepare(circuit);
  const extra: Issue[] = [];
  const body: string[] = [];

  for (const op of ops) {
    if (op.gate === 'MEASURE') continue;
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'PennyLane'));
      body.push(`    # custom gate on wires ${wiresArg(op.targets)} skipped`);
      continue;
    }
    const args = [...op.params.map((p) => pyAngle(p)), `wires=${wiresArg([...op.controls, ...op.targets])}`];
    body.push(`    qml.${NAMES[op.gate]}(${args.join(', ')})`);
  }

  const rotations: string[] = [];
  for (const [w, b] of [...bases].sort(([a], [c]) => a - c)) {
    if (b === 'Y') rotations.push(`    qml.adjoint(qml.S)(wires=${w})`);
    if (b !== 'Z') rotations.push(`    qml.Hadamard(wires=${w})`);
  }
  if (rotations.length > 0) body.push('', '    # Rotate into the readout basis', ...rotations);
  if (body.length === 0) body.push('    pass');

  const ret =
    opts.resultMode === 'expval'
      ? `    return [qml.expval(qml.PauliZ(w)) for w in [${measured.join(', ')}]]`
      : `    return qml.probs(wires=[${measured.join(', ')}])`;

  const lines = [
    'import pennylane as qml',
    'import numpy as np',
    '',
    ...symbolDeclarations(symbols),
    `dev = qml.device("default.qubit", wires=${circuit.numQubits})`,
    '',
    ...(opts.shots ? [`@qml.set_shots(${opts.shots})`] : []),
    '@qml.qnode(dev)',
    'def circuit():',
    ...body,
    '',
    ret,
    '',
    '',
    'print(circuit())',
  ];
  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
