import { parseExpr, parseMath, toLatex } from '@qcc/core';

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '†': '†',
};

const script = (text: string, map: Record<string, string>, marker: string) =>
  [...text].every((c) => map[c]) ? [...text].map((c) => map[c]).join('') : `${marker}${text}`;

/**
 * Plain-text approximation of a LaTeX math snippet, for places that cannot
 * hold markup (select options, aria labels): `|q_{0}\rangle` -> `|q₀⟩`.
 * Use <MathText> where markup is allowed.
 */
export function latexToText(latex: string): string {
  return parseMath(latex)
    .map((r) => (r.shift === 'sub' ? script(r.text, SUB, '_') : r.shift === 'super' ? script(r.text, SUP, '^') : r.text))
    .join('');
}

/** An angle expression for display, e.g. `-3pi/4` -> `-3π/4`, falling back to the raw text if it does not parse. */
export function prettyAngle(src: string): string {
  const r = parseExpr(src);
  return r.ok ? latexToText(toLatex(r.expr)) : src;
}
