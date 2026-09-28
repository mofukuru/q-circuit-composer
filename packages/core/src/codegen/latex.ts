import { type Circuit, customLabel, type Operation, spanOf } from '../circuit';
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

/**
 * Generates a quantikz diagram of the circuit exactly as drawn: empty steps
 * are dropped and measurements appear where they were placed.
 */
export function generateLatex(circuit: Circuit, opts: CodegenOptions = {}): CodegenResult {
  const { issues, ops } = prepare(circuit);
  const columns = [...new Set(ops.map((op) => op.column))].sort((a, b) => a - b);
  const grid: string[][] = Array.from({ length: circuit.numQubits }, () => columns.map(() => '\\qw'));

  for (const op of ops) {
    const col = columns.indexOf(op.column);
    const set = (wire: number, cell: string) => {
      if (wire >= 0 && wire < circuit.numQubits) grid[wire][col] = cell;
    };
    const [t0, t1] = op.targets;

    if (op.gate === 'CUSTOM') {
      const [lo, hi] = spanOf(op);
      set(lo, hi > lo ? `\\gate[${hi - lo + 1}]{${customLabel(circuit, op)}}` : `\\gate{${customLabel(circuit, op)}}`);
      continue;
    }
    for (const c of op.controls) set(c, `\\ctrl{${t0 - c}}`);
    if (op.gate === 'SWAP' || op.gate === 'CSWAP') {
      set(t0, `\\swap{${t1 - t0}}`);
      set(t1, '\\targX{}');
    } else {
      set(t0, targetCell(op));
    }
  }

  const rows = grid.map((cells, q) => {
    const label = circuit.qubitLabels[q] ?? `q_{${q}}`;
    return [`\\lstick{$${label}$}`, ...(cells.length > 0 ? cells : ['\\qw'])].join(' & ');
  });
  const body = ['\\begin{quantikz}', ...rows.map((r, i) => `  ${r}${i < rows.length - 1 ? ' \\\\' : ''}`), '\\end{quantikz}'];

  const code = opts.standalone
    ? ['\\documentclass[border=2pt]{standalone}', '\\usepackage{quantikz}', '', '\\begin{document}', ...body, '\\end{document}']
    : body;
  return { code: code.join('\n') + '\n', issues };
}
