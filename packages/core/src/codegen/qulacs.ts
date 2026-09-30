import type { Circuit, Issue, Operation } from '../circuit';
import { type CodegenOptions, type CodegenResult, inBasis, prepare, pyAngle, skipped, symbolDeclarations } from './common';

/** Gates with a native Qulacs constructor, keyed by gate name. */
const NATIVE: Record<string, string> = {
  H: 'H',
  X: 'X',
  Y: 'Y',
  Z: 'Z',
  S: 'S',
  T: 'T',
  // Qulacs' RX/RY/RZ rotate by exp(+i θ/2 P); RotX/RotY/RotZ use the usual exp(-i θ/2 P).
  RX: 'RotX',
  RY: 'RotY',
  RZ: 'RotZ',
  CNOT: 'CNOT',
  CZ: 'CZ',
  SWAP: 'SWAP',
  CCX: 'TOFFOLI',
  CSWAP: 'FREDKIN',
};

/** Controlled gates built by adding control qubits to a single-qubit gate. */
const CONTROLLED_BASE: Record<string, string> = { CY: 'Y', CRX: 'RotX', CRY: 'RotY', CRZ: 'RotZ' };

/**
 * Qulacs cannot measure in the middle of a circuit and keep exact
 * probabilities, so a dynamic circuit is run branch by branch instead.
 */
const BRANCHING = [
  '# Every outcome of a mid-circuit measurement is followed as its own branch:',
  '# (state, classical bits). States are not renormalized, so the squared norm',
  '# of a branch is the probability of reaching it.',
  'branches = [(QuantumState(n), {})]',
  '',
  '',
  'def apply(gate, bit=None, value=1):',
  '    for state, bits in branches:',
  '        if bit is None or bits[bit] == value:',
  '            gate.update_quantum_state(state)',
  '',
  '',
  'def measure(qubit, bit=None):',
  '    global branches',
  '    outcomes = []',
  '    for state, bits in branches:',
  '        for value, projector in enumerate((P0(qubit), P1(qubit))):',
  '            projected = state.copy()',
  '            projector.update_quantum_state(projected)',
  '            if projected.get_squared_norm() > 1e-14:',
  '                outcomes.append((projected, {**bits, bit: value}))',
  '    branches = outcomes',
  '',
  '',
];

export function generateQulacs(circuit: Circuit, _opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops, bases, measured, clbit, symbols } = prepare(circuit);
  const dynamic = clbit.size > 0;
  const extra: Issue[] = [];
  const body: string[] = [];
  const imports = new Set<string>(dynamic ? ['P0', 'P1'] : []);
  const gate = (name: string, ...args: (number | string)[]) => {
    imports.add(name);
    return `${name}(${args.join(', ')})`;
  };
  const add = (expr: string, condition?: Operation['condition']) =>
    body.push(dynamic ? `apply(${[expr, ...(condition ? [condition.bit, condition.value] : [])].join(', ')})` : `circuit.add_gate(${expr})`);

  for (const op of ops) {
    if (op.gate === 'MEASURE') {
      if (!clbit.has(op.id)) continue;
      const w = op.targets[0];
      const { before, after } = inBasis(op.basis, 'Sdag', 'H', 'S');
      before.forEach((name) => add(gate(name, w)));
      body.push(`measure(${[w, ...(op.classicalTarget === undefined ? [] : [op.classicalTarget])].join(', ')})`);
      after.forEach((name) => add(gate(name, w)));
      continue;
    }
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'Qulacs'));
      body.push(`# custom gate on qubits ${op.targets.join(', ')} skipped`);
      continue;
    }
    const params = op.params.map((p) => pyAngle(p));
    const base = CONTROLLED_BASE[op.gate];
    if (base) {
      imports.add('to_matrix_gate');
      add(`controlled(${gate(base, op.targets[0], ...params)}, ${op.controls.join(', ')})`, op.condition);
    } else {
      add(gate(NATIVE[op.gate], ...op.controls, ...op.targets, ...params), op.condition);
    }
  }

  const rotations = body.length;
  for (const [w, b] of [...bases].sort(([a], [c]) => a - c)) {
    inBasis(b, 'Sdag', 'H', 'S').before.forEach((name) => add(gate(name, w)));
  }
  if (body.length > rotations) body.splice(rotations, 0, '', '# Rotate into the readout basis');

  const helper = imports.has('to_matrix_gate')
    ? [
        'def controlled(gate, *controls):',
        '    gate = to_matrix_gate(gate)',
        '    for c in controls:',
        '        gate.add_control_qubit(c, 1)',
        '    return gate',
        '',
        '',
      ]
    : [];

  const lines = [
    'import numpy as np',
    `from qulacs import ${dynamic ? 'QuantumState' : 'QuantumCircuit, QuantumState'}`,
    ...(imports.size > 0 ? [`from qulacs.gate import ${[...imports].sort().join(', ')}`] : []),
    '',
    ...helper,
    ...symbolDeclarations(symbols),
    `n = ${circuit.numQubits}`,
    ...(dynamic ? ['', ...BRANCHING] : ['state = QuantumState(n)', 'circuit = QuantumCircuit(n)']),
    ...body,
    ...(dynamic ? [] : ['circuit.update_quantum_state(state)']),
    '',
    '# Qulacs stores qubit k in bit k of the state index; collect the',
    '# probabilities as bitstrings in wire order.',
    `measured = [${measured.join(', ')}]`,
    'probs = {}',
    ...(dynamic ? ['for state, _ in branches:'] : []),
    ...[
      'for index, p in enumerate(np.abs(state.get_vector()) ** 2):',
      '    bits = "".join(str((index >> w) & 1) for w in measured)',
      '    probs[bits] = probs.get(bits, 0.0) + p',
    ].map((line) => (dynamic ? `    ${line}` : line)),
    'print(probs)',
  ];
  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
