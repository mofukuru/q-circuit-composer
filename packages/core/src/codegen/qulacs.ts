import type { Circuit, Issue } from '../circuit';
import { type CodegenOptions, type CodegenResult, prepare, pyAngle, skipped, symbolDeclarations } from './common';

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

export function generateQulacs(circuit: Circuit, _opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops, bases, measured, symbols } = prepare(circuit);
  const extra: Issue[] = [];
  const body: string[] = [];
  const imports = new Set<string>();

  for (const op of ops) {
    if (op.gate === 'MEASURE') continue;
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'Qulacs'));
      body.push(`# custom gate on qubits ${op.targets.join(', ')} skipped`);
      continue;
    }
    const params = op.params.map((p) => pyAngle(p));
    const base = CONTROLLED_BASE[op.gate];
    if (base) {
      imports.add(base).add('to_matrix_gate');
      body.push(`circuit.add_gate(controlled(${base}(${[op.targets[0], ...params].join(', ')}), ${op.controls.join(', ')}))`);
    } else {
      const name = NATIVE[op.gate];
      imports.add(name);
      body.push(`circuit.add_gate(${name}(${[...op.controls, ...op.targets, ...params].join(', ')}))`);
    }
  }

  const rotations: string[] = [];
  for (const [w, b] of [...bases].sort(([a], [c]) => a - c)) {
    if (b === 'Y') {
      imports.add('Sdag');
      rotations.push(`circuit.add_gate(Sdag(${w}))`);
    }
    if (b !== 'Z') {
      imports.add('H');
      rotations.push(`circuit.add_gate(H(${w}))`);
    }
  }
  if (rotations.length > 0) body.push('', '# Rotate into the readout basis', ...rotations);

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
    'from qulacs import QuantumCircuit, QuantumState',
    ...(imports.size > 0 ? [`from qulacs.gate import ${[...imports].sort().join(', ')}`] : []),
    '',
    ...helper,
    ...symbolDeclarations(symbols),
    `n = ${circuit.numQubits}`,
    'state = QuantumState(n)',
    'circuit = QuantumCircuit(n)',
    ...body,
    'circuit.update_quantum_state(state)',
    '',
    '# Qulacs stores qubit k in bit k of the state index; collect the',
    '# probabilities as bitstrings in wire order.',
    `measured = [${measured.join(', ')}]`,
    'probs = {}',
    'for index, p in enumerate(np.abs(state.get_vector()) ** 2):',
    '    bits = "".join(str((index >> w) & 1) for w in measured)',
    '    probs[bits] = probs.get(bits, 0.0) + p',
    'print(probs)',
  ];
  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
