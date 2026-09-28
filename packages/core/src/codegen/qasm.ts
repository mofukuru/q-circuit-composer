import type { Circuit, Issue } from '../circuit';
import { toQasm } from '../expr';
import { type CodegenOptions, type CodegenResult, parsed, prepare, skipped } from './common';

const NAMES: Record<string, string> = {
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

/** Gates missing from the qelib1.inc of the OpenQASM 2.0 specification. */
const DEFINITIONS: Record<string, string> = {
  swap: 'gate swap a, b { cx a, b; cx b, a; cx a, b; }',
  cswap: 'gate cswap c, a, b { cx b, a; ccx c, a, b; cx b, a; }',
  crx: 'gate crx(theta) c, t { u1(pi/2) t; cx c, t; u3(-theta/2, 0, 0) t; cx c, t; u3(theta/2, -pi/2, 0) t; }',
  cry: 'gate cry(theta) c, t { ry(theta/2) t; cx c, t; ry(-theta/2) t; cx c, t; }',
};

export function generateQasm(circuit: Circuit, _opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops, bases, measured, symbols } = prepare(circuit);
  const extra: Issue[] = [];
  if (symbols.length > 0) {
    extra.push({
      level: 'error',
      message: `OpenQASM 2.0 needs numeric angles; give ${symbols.join(', ')} a value`,
    });
  }

  const body: string[] = [];

  for (const op of ops) {
    if (op.gate === 'MEASURE') continue;
    if (op.gate === 'CUSTOM') {
      extra.push(skipped(op, 'OpenQASM'));
      body.push(`// custom gate on q[${op.targets.join('], q[')}] skipped`);
      continue;
    }
    const params = op.params.length > 0 ? `(${op.params.map((p) => toQasm(parsed(p))).join(', ')})` : '';
    const qubits = [...op.controls, ...op.targets].map((w) => `q[${w}]`).join(', ');
    body.push(`${NAMES[op.gate]}${params} ${qubits};`);
  }

  for (const [w, b] of [...bases].sort(([a], [c]) => a - c)) {
    if (b === 'Y') body.push(`sdg q[${w}];`);
    if (b !== 'Z') body.push(`h q[${w}];`);
  }
  measured.forEach((w, i) => body.push(`measure q[${w}] -> c[${i}];`));

  const used = new Set(body.map((line) => line.split(/[ (]/)[0]));
  const lines = [
    'OPENQASM 2.0;',
    'include "qelib1.inc";',
    ...Object.entries(DEFINITIONS)
      .filter(([name]) => used.has(name))
      .map(([, def]) => def),
    `qreg q[${circuit.numQubits}];`,
    `creg c[${measured.length}];`,
    ...body,
  ];

  return { code: lines.join('\n') + '\n', issues: [...issues, ...extra] };
}
