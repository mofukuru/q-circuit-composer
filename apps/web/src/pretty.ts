import { parseExpr, toLatex } from '@qcc/core';

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ',
  Psi: 'Ψ', Omega: 'Ω', rangle: '⟩', langle: '⟨', dagger: '†', cdot: '·', otimes: '⊗', ket: '', bra: '',
};

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '†': '†',
};

const script = (text: string, map: Record<string, string>, fallback: string) =>
  [...text].every((c) => map[c]) ? [...text].map((c) => map[c]).join('') : `${fallback}${text}`;

/**
 * Approximates a LaTeX math snippet with Unicode for display in the editor,
 * e.g. `|q_{0}\rangle` -> `|q₀⟩`, `R_x(\pi/2)` -> `Rₓ(π/2)`.
 */
export function latexToText(latex: string): string {
  let s = latex.replace(/\\ket\{([^}]*)\}/g, '|$1\\rangle').replace(/\\([A-Za-z]+)\s*/g, (m, name: string) => SYMBOLS[name] ?? m);
  s = s.replace(/_\{([^}]*)\}|_(.)/g, (_, a: string | undefined, b: string | undefined) => script(a ?? b ?? '', SUB, '_'));
  s = s.replace(/\^\{([^}]*)\}|\^(.)/g, (_, a: string | undefined, b: string | undefined) => script(a ?? b ?? '', SUP, '^'));
  return s.replace(/[{}$]/g, '');
}

/** An angle expression for display, e.g. `-3pi/4` -> `-3π/4`, falling back to the raw text if it does not parse. */
export function prettyAngle(src: string): string {
  const r = parseExpr(src);
  return r.ok ? latexToText(toLatex(r.expr)) : src;
}
