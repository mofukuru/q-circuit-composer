import type { Circuit, Issue } from '../circuit';
import { type CodegenOptions, type CodegenResult, inBasis, prepare, pyAngle, pySymbol, skipped, symbolDeclarations } from './common';

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
  const { issues, ops, bases, measured, clbit, symbols } = prepare(circuit);
  const extra: Issue[] = [];
  const body: string[] = [];
  // Python variable holding a classical bit; kept clear of the free parameters.
  const taken = new Set(symbols.map(pySymbol));
  const bitName = (bit: number) => {
    let name = `c${bit}`;
    while (taken.has(name)) name += '_';
    return name;
  };

  for (const op of ops) {
    if (op.gate === 'MEASURE') {
      if (!clbit.has(op.id)) continue;
      const w = op.targets[0];
      const { before, after } = inBasis(op.basis, `qml.adjoint(qml.S)(wires=${w})`, `qml.Hadamard(wires=${w})`, `qml.S(wires=${w})`);
      const measure = `qml.measure(${w})`;
      const stored = op.classicalTarget === undefined ? measure : `${bitName(op.classicalTarget)} = ${measure}`;
      body.push(...[...before, stored, ...after].map((line) => `    ${line}`));
      continue;
    }
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'PennyLane'));
      body.push(`    # custom gate on wires ${wiresArg(op.targets)} skipped`);
      continue;
    }
    const args = [...op.params.map((p) => pyAngle(p)), `wires=${wiresArg([...op.controls, ...op.targets])}`];
    const gate = `qml.${NAMES[op.gate]}`;
    const fn = op.condition ? `qml.cond(${bitName(op.condition.bit)} == ${op.condition.value}, ${gate})` : gate;
    body.push(`    ${fn}(${args.join(', ')})`);
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
    // Tree traversal follows each measurement outcome without the extra wires that deferred measurement needs.
    clbit.size > 0 ? '@qml.qnode(dev, mcm_method="tree-traversal")' : '@qml.qnode(dev)',
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
