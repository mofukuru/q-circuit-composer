import { type Circuit, customLabel, measurementBases, numClbits, type Operation, spanOf } from '../circuit';
import { toLatex } from '../expr';
import { type CodegenOptions, type CodegenResult, parsed, prepare } from './common';

const ROTATION: Record<string, string> = { RX: 'R_x', RY: 'R_y', RZ: 'R_z', CRX: 'R_x', CRY: 'R_y', CRZ: 'R_z' };

const angle = (op: Operation) => toLatex(parsed(op.params[0]));

/** The quantikz cell drawn on the target of a single-target gate. */
function targetCell(op: Operation): string {
  switch (op.gate) {
    case 'X':
    case 'CNOT':
    case 'CCX':
      return op.controls.length > 0 ? '\\targ{}' : '\\gate{X}';
    case 'CZ':
      return '\\control{}';
    case 'CY':
      return '\\gate{Y}';
    case 'RX':
    case 'RY':
    case 'RZ':
    case 'CRX':
    case 'CRY':
    case 'CRZ':
      return `\\gate{${ROTATION[op.gate]}(${angle(op)})}`;
    case 'MEASURE':
      return op.basis && op.basis !== 'Z' ? `\\meter{${op.basis}}` : '\\meter{}';
    default:
      return `\\gate{${op.gate}}`;
  }
}

/** A control dot on a classical wire: filled for "bit is 1", open for "bit is 0". */
const classicalControl = (value: 0 | 1) => `${value ? '\\control{}' : '\\ocontrol{}'} \\cw`;

/**
 * Generates a quantikz diagram of the circuit exactly as drawn: empty steps
 * are dropped and measurements appear where they were placed. Classical bits
 * are drawn as double wires below the qubits; their rows use \setwiretype,
 * which needs quantikz 1.0 or later.
 */
export function generateLatex(circuit: Circuit, opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops } = prepare(circuit);
  const columns = [...new Set(ops.map((op) => op.column))].sort((a, b) => a - b);
  const clbits = numClbits(circuit);
  const grid: string[][] = Array.from({ length: circuit.numQubits + clbits }, (_, row) =>
    columns.map(() => (row < circuit.numQubits ? '\\qw' : '\\cw')),
  );
  /** Vertical classical wire from the lowest wire of `op` down to classical bit `bit`. */
  const link = (op: Operation, col: number, bit: number) => {
    const from = spanOf(op)[1];
    const to = circuit.numQubits + bit;
    if (grid[from] && grid[to]) grid[from][col] += ` \\vcw{${to - from}}`;
  };

  for (const op of ops) {
    const col = columns.indexOf(op.column);
    const set = (wire: number, cell: string) => {
      if (wire >= 0 && wire < circuit.numQubits) grid[wire][col] = cell;
    };
    const [t0, t1] = op.targets;

    if (op.gate === 'CUSTOM') {
      const [lo, hi] = spanOf(op);
      set(lo, hi > lo ? `\\gate[${hi - lo + 1}]{${customLabel(circuit, op)}}` : `\\gate{${customLabel(circuit, op)}}`);
    } else {
      for (const c of op.controls) set(c, `\\ctrl{${t0 - c}}`);
      if (op.gate === 'SWAP' || op.gate === 'CSWAP') {
        set(t0, `\\swap{${t1 - t0}}`);
        set(t1, '\\targX{}');
      } else {
        set(t0, targetCell(op));
      }
    }

    if (op.gate === 'MEASURE' && op.classicalTarget !== undefined) link(op, col, op.classicalTarget);
    if (op.condition) {
      link(op, col, op.condition.bit);
      const wire = grid[circuit.numQubits + op.condition.bit];
      if (wire) wire[col] = classicalControl(op.condition.value);
    }
  }

  const ends = measurementBases(circuit);
  const rows = grid.map((cells, q) => {
    if (q >= circuit.numQubits) return [`\\lstick{$c_{${q - circuit.numQubits}}$} \\setwiretype{c}`, ...cells, '\\cw'].join(' & ');
    const label = circuit.qubitLabels[q] ?? `q_{${q}}`;
    // A wire ends at its final measurement: later empty cells stay blank. Other
    // wires get one extra \qw so the last gate does not sit at the very edge.
    const lastMeter = ends.has(q) ? cells.findLastIndex((c) => c.startsWith('\\meter')) : -1;
    const trailing = cells.map((c, i) => (lastMeter >= 0 && i > lastMeter && c === '\\qw' ? '' : c));
    while (trailing.at(-1) === '') trailing.pop();
    const padded = lastMeter >= 0 ? trailing : [...trailing, '\\qw'];
    return [`\\lstick{$${label}$}`, ...padded].join(' & ');
  });
  const body = ['\\begin{quantikz}', ...rows.map((r, i) => `  ${r}${i < rows.length - 1 ? ' \\\\' : ''}`), '\\end{quantikz}'];

  const code = opts.standalone
    ? ['\\documentclass[border=2pt]{standalone}', '\\usepackage{quantikz}', '', '\\begin{document}', ...body, '\\end{document}']
    : body;
  return { code: code.join('\n') + '\n', issues };
}
