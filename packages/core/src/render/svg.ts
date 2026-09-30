import {
  type Circuit,
  customLabel,
  measurementBases,
  numClbits,
  type Operation,
  orderedOperations,
  spanOf,
  validate,
} from '../circuit';
import { parseExpr, toLatex } from '../expr';
import { parseMath } from './math';

/**
 * Draws the circuit as a standalone SVG in the style of a quantikz figure:
 * black on white, boxed gates, dots for controls. The layout matches the
 * LaTeX output: empty columns are dropped, wires get a little space after
 * the last gate, and wires that end in a measurement stop at their meter.
 * Classical bits are double wires below the qubits.
 */

const ROW = 56;
const CLASSICAL_ROW = 40;
const DOUBLE = 1.7; // half the gap between the two strokes of a classical wire
const PAD = 14;
const BOX_H = 34;
const MIN_COL = 52;
const FONT = 17;
const CHAR = FONT * 0.56;
const STROKE = 1.6;
const FONT_FAMILY = "'STIX Two Text', 'Latin Modern Roman', 'Times New Roman', serif";

const SCRIPT = 0.7; // size of sub/superscripts relative to the text

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Approximate rendered width of a LaTeX math snippet. */
const textWidth = (latex: string, size = FONT) =>
  parseMath(latex).reduce((w, r) => w + [...r.text].length * CHAR * (size / FONT) * (r.shift ? SCRIPT : 1), 0);

/** SVG <tspan>s for a LaTeX math snippet; sub/superscripts are shifted with dy (baseline-shift is not portable). */
function mathTspans(latex: string, size: number): string {
  let offset = 0;
  const parts = parseMath(latex).map((r) => {
    const target = r.shift === 'sub' ? size * 0.3 : r.shift === 'super' ? -size * 0.4 : 0;
    const dy = target - offset;
    offset = target;
    const attrs = `${dy ? ` dy="${dy.toFixed(1)}"` : ''}${r.shift ? ` font-size="${(size * SCRIPT).toFixed(1)}"` : ''}`;
    return `<tspan${attrs}>${esc(r.text)}</tspan>`;
  });
  return parts.join('');
}

const ROTATION: Record<string, string> = { RX: 'R_x', RY: 'R_y', RZ: 'R_z', CRX: 'R_x', CRY: 'R_y', CRZ: 'R_z' };

function angleLatex(op: Operation): string {
  const r = parseExpr(op.params[0] ?? '');
  return r.ok ? toLatex(r.expr) : (op.params[0] ?? '');
}

/** LaTeX for the text inside a gate's box, or null when the target is not drawn as a box. */
function boxLatex(circuit: Circuit, op: Operation): string | null {
  switch (op.gate) {
    case 'CNOT':
    case 'CCX':
    case 'CZ':
    case 'SWAP':
    case 'CSWAP':
    case 'MEASURE':
      return null;
    case 'CY':
      return 'Y';
    case 'CUSTOM':
      return customLabel(circuit, op);
    default:
      return ROTATION[op.gate] ? `${ROTATION[op.gate]}(${angleLatex(op)})` : op.gate;
  }
}

export function renderCircuitSvg(circuit: Circuit): string {
  const ops = validate(circuit).some((i) => i.level === 'error') ? [] : orderedOperations(circuit);
  const columns = [...new Set(ops.map((op) => op.column))].sort((a, b) => a - b);

  // Column widths from the widest box in each column.
  const widths = columns.map((col) =>
    Math.max(
      MIN_COL,
      ...ops.filter((op) => op.column === col).map((op) => {
        const text = boxLatex(circuit, op);
        return text === null ? MIN_COL : textWidth(text) + 36;
      }),
    ),
  );
  const labels = Array.from({ length: circuit.numQubits }, (_, q) => circuit.qubitLabels[q] ?? `q_{${q}}`);
  const labelWidth = Math.max(...labels.map(textWidth), 12) + 12;
  const x0 = PAD + labelWidth + 8;
  const centers: number[] = [];
  let x = x0 + 18;
  for (const w of widths) {
    centers.push(x + w / 2);
    x += w;
  }
  const xEnd = x + 22;
  const width = Math.ceil(xEnd + PAD);
  const clbits = ops.length > 0 ? numClbits(circuit) : 0;
  const height = PAD * 2 + circuit.numQubits * ROW + clbits * CLASSICAL_ROW;
  const y = (row: number) => PAD + row * ROW + ROW / 2;
  const yBit = (bit: number) => PAD + circuit.numQubits * ROW + bit * CLASSICAL_ROW + CLASSICAL_ROW / 2;

  // Wires end at their final meter; others run to the right edge.
  const ends = measurementBases(circuit);
  const wireEnd = Array.from({ length: circuit.numQubits }, () => xEnd);
  for (const op of ops) {
    if (op.gate === 'MEASURE' && ends.has(op.targets[0])) wireEnd[op.targets[0]] = Math.max(x0, centers[columns.indexOf(op.column)]);
  }

  const out: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
  const text = (tx: number, ty: number, s: string, anchor = 'middle', size = FONT) =>
    out.push(`<text x="${tx}" y="${ty}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="central" stroke="none" fill="#000">${mathTspans(s, size)}</text>`);
  const box = (cx: number, top: number, w: number, h: number) =>
    out.push(`<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" fill="#fff" />`);
  const dot = (cx: number, cy: number) => out.push(`<circle cx="${cx}" cy="${cy}" r="4.5" fill="#000" stroke="none" />`);

  labels.forEach((label, q) => {
    text(PAD + labelWidth, y(q), label, 'end');
    line(x0, y(q), wireEnd[q], y(q));
  });
  for (let bit = 0; bit < clbits; bit++) {
    text(PAD + labelWidth, yBit(bit), `c_{${bit}}`, 'end');
    for (const d of [-DOUBLE, DOUBLE]) line(x0, yBit(bit) + d, xEnd, yBit(bit) + d);
  }

  // Classical links go first so that gates cover the lines passing behind them.
  for (const op of ops) {
    const bit = op.gate === 'MEASURE' ? op.classicalTarget : op.condition?.bit;
    if (bit === undefined) continue;
    const cx = centers[columns.indexOf(op.column)];
    for (const d of [-DOUBLE, DOUBLE]) line(cx + d, y(spanOf(op)[1]), cx + d, yBit(bit));
    if (op.condition) {
      out.push(`<circle cx="${cx}" cy="${yBit(bit)}" r="4.5" fill="${op.condition.value ? '#000' : '#fff'}"${op.condition.value ? ' stroke="none"' : ''} />`);
    }
  }

  for (const op of ops) {
    const cx = centers[columns.indexOf(op.column)];
    const [lo, hi] = spanOf(op);
    const [t0, t1] = op.targets;

    if (op.gate === 'CUSTOM') {
      const w = Math.max(40, textWidth(customLabel(circuit, op)) + 24);
      box(cx, y(lo) - BOX_H / 2, w, y(hi) - y(lo) + BOX_H);
      text(cx, (y(lo) + y(hi)) / 2, customLabel(circuit, op));
      continue;
    }
    if (hi > lo) line(cx, y(lo), cx, y(hi));
    for (const c of op.controls) dot(cx, y(c));

    if (op.gate === 'MEASURE') {
      const top = y(t0) - BOX_H / 2;
      box(cx, top, 40, BOX_H);
      out.push(`<path d="M ${cx - 12} ${y(t0) + 7} A 12 12 0 0 1 ${cx + 12} ${y(t0) + 7}" fill="none" />`);
      line(cx, y(t0) + 7, cx + 10, y(t0) - 10);
      if (op.basis && op.basis !== 'Z') text(cx, top - 10, op.basis, 'middle', FONT - 2);
    } else if (op.gate === 'SWAP' || op.gate === 'CSWAP') {
      for (const t of [t0, t1]) {
        line(cx - 7, y(t) - 7, cx + 7, y(t) + 7);
        line(cx - 7, y(t) + 7, cx + 7, y(t) - 7);
      }
    } else if (op.gate === 'CNOT' || op.gate === 'CCX') {
      out.push(`<circle cx="${cx}" cy="${y(t0)}" r="11" fill="#fff" />`);
      line(cx - 11, y(t0), cx + 11, y(t0));
      line(cx, y(t0) - 11, cx, y(t0) + 11);
    } else if (op.gate === 'CZ') {
      dot(cx, y(t0));
    } else {
      const label = boxLatex(circuit, op) ?? '';
      box(cx, y(t0) - BOX_H / 2, textWidth(label) + 20, BOX_H);
      text(cx, y(t0), label);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#fff" />`,
    `<g stroke="#000" stroke-width="${STROKE}" font-family="${esc(FONT_FAMILY)}" font-style="italic">`,
    ...out,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
