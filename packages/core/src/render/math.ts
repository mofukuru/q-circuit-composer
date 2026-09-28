/**
 * A tiny reader for the LaTeX math used in qubit labels, gate labels and
 * angles (`|q_{0}\rangle`, `R_x(\pi/2)`, `U_f^\dagger`). It turns the
 * snippet into runs of plain, subscript and superscript text, with common
 * commands replaced by Unicode. It is not a TeX engine; unknown commands are
 * shown by name.
 */

export const LATEX_SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ',
  Psi: 'Ψ', Omega: 'Ω', rangle: '⟩', langle: '⟨', dagger: '†', cdot: '·', otimes: '⊗', oplus: '⊕',
  times: '×', pm: '±', infty: '∞', prime: '′', ',': ' ', ';': ' ', quad: ' ',
};

export interface MathRun {
  text: string;
  shift: 'sub' | 'super' | null;
}

export function parseMath(latex: string): MathRun[] {
  const runs: MathRun[] = [];
  const push = (text: string, shift: MathRun['shift']) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last && last.shift === shift) last.text += text;
    else runs.push({ text, shift });
  };

  let i = 0;
  /** Reads one argument: a {group} or a single token. */
  const readArg = (): string => {
    if (latex[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < latex.length; i++) {
        if (latex[i] === '{') depth++;
        if (latex[i] === '}' && --depth === 0) break;
      }
      i++;
      return latex.slice(start + 1, i - 1);
    }
    if (latex[i] === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(latex.slice(i));
      i += m ? m[0].length : 1;
      return m ? m[0] : '';
    }
    return latex[i++] ?? '';
  };
  const plain = (s: string) => parseMath(s).map((r) => r.text).join('');

  while (i < latex.length) {
    const c = latex[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(latex.slice(i))!;
      i += m[0].length;
      const name = m[1];
      if (name === 'ket' || name === 'bra') {
        const inner = parseMath(readArg());
        push(name === 'ket' ? '|' : '⟨', null);
        inner.forEach((r) => push(r.text, r.shift));
        push(name === 'ket' ? '⟩' : '|', null);
      } else if (name === 'mathrm' || name === 'text' || name === 'mathit' || name === 'operatorname') {
        parseMath(readArg()).forEach((r) => push(r.text, r.shift));
      } else {
        push(LATEX_SYMBOLS[name] ?? name, null);
      }
      while (latex[i] === ' ') i++;
    } else if (c === '_' || c === '^') {
      i++;
      push(plain(readArg()), c === '_' ? 'sub' : 'super');
    } else if (c === '{' || c === '}' || c === '$') {
      i++;
    } else {
      push(c, null);
      i++;
    }
  }
  return runs;
}
