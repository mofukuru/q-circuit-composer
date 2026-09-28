/**
 * Angle expressions such as `pi/2`, `-3*pi/4`, `0.25` or `2\theta`.
 *
 * Expressions are kept as source text in the circuit so that symbolic
 * parameters survive for LaTeX output; they are evaluated to numbers for
 * simulation and translated for each code generator.
 */

export type Expr =
  | { kind: 'num'; value: number; text: string }
  | { kind: 'pi' }
  | { kind: 'sym'; name: string }
  | { kind: 'neg'; arg: Expr }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Expr; right: Expr };

export type ParseResult = { ok: true; expr: Expr } | { ok: false; error: string };

const GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'upsilon', 'phi',
  'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Sigma',
  'Upsilon', 'Phi', 'Psi', 'Omega',
]);

type Token =
  | { t: 'num'; value: number; text: string }
  | { t: 'id'; name: string }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^' }
  | { t: '(' }
  | { t: ')' };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Invalid number at position ${i + 1}`);
      tokens.push({ t: 'num', value: Number(m[0]), text: m[0] });
      i += m[0].length;
    } else if (c === 'π') {
      tokens.push({ t: 'id', name: 'pi' });
      i++;
    } else if (/[A-Za-z_\\]/.test(c)) {
      const m = /^\\?[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i));
      if (!m) throw new Error(`Unexpected "${c}" at position ${i + 1}`);
      tokens.push({ t: 'id', name: m[0].replace(/^\\/, '') });
      i += m[0].length;
    } else if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      tokens.push({ t: 'op', op: c });
      i++;
    } else if (c === '(' || c === ')') {
      tokens.push({ t: c });
      i++;
    } else {
      throw new Error(`Unexpected "${c}" at position ${i + 1}`);
    }
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Expr {
    if (this.tokens.length === 0) throw new Error('Empty expression');
    const e = this.expr();
    if (this.pos < this.tokens.length) throw new Error('Unexpected trailing input');
    return e;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expr(): Expr {
    let left = this.term();
    for (let tok = this.peek(); tok?.t === 'op' && (tok.op === '+' || tok.op === '-'); tok = this.peek()) {
      this.pos++;
      left = { kind: 'bin', op: tok.op, left, right: this.term() };
    }
    return left;
  }

  private term(): Expr {
    let left = this.unary();
    for (;;) {
      const tok = this.peek();
      if (tok?.t === 'op' && (tok.op === '*' || tok.op === '/')) {
        this.pos++;
        left = { kind: 'bin', op: tok.op, left, right: this.unary() };
      } else if (tok && (tok.t === 'id' || tok.t === '(' || tok.t === 'num')) {
        // implicit multiplication: 2pi, 3(theta+1)
        left = { kind: 'bin', op: '*', left, right: this.power() };
      } else {
        return left;
      }
    }
  }

  private unary(): Expr {
    const tok = this.peek();
    if (tok?.t === 'op' && tok.op === '-') {
      this.pos++;
      return { kind: 'neg', arg: this.unary() };
    }
    if (tok?.t === 'op' && tok.op === '+') {
      this.pos++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.atom();
    const tok = this.peek();
    if (tok?.t === 'op' && tok.op === '^') {
      this.pos++;
      return { kind: 'bin', op: '^', left: base, right: this.unary() };
    }
    return base;
  }

  private atom(): Expr {
    const tok = this.tokens[this.pos++];
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.t === 'num') return { kind: 'num', value: tok.value, text: tok.text };
    if (tok.t === 'id') return tok.name === 'pi' ? { kind: 'pi' } : { kind: 'sym', name: tok.name };
    if (tok.t === '(') {
      const e = this.expr();
      if (this.tokens[this.pos++]?.t !== ')') throw new Error('Missing ")"');
      return e;
    }
    throw new Error('Unexpected token');
  }
}

export function parseExpr(src: string): ParseResult {
  try {
    return { ok: true, expr: new Parser(tokenize(src)).parse() };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function freeSymbols(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.kind) {
    case 'sym':
      out.add(e.name);
      break;
    case 'neg':
      freeSymbols(e.arg, out);
      break;
    case 'bin':
      freeSymbols(e.left, out);
      freeSymbols(e.right, out);
      break;
  }
  return out;
}

export function evaluate(e: Expr): number {
  switch (e.kind) {
    case 'num':
      return e.value;
    case 'pi':
      return Math.PI;
    case 'sym':
      throw new Error(`Parameter "${e.name}" has no numeric value`);
    case 'neg':
      return -evaluate(e.arg);
    case 'bin': {
      const a = evaluate(e.left);
      const b = evaluate(e.right);
      switch (e.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return a ** b;
      }
    }
  }
}

/** Evaluates an expression string, returning an error message instead of throwing. */
export function evalAngle(src: string): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = parseExpr(src);
  if (!parsed.ok) return parsed;
  try {
    const value = evaluate(parsed.expr);
    if (!Number.isFinite(value)) return { ok: false, error: 'Value is not finite' };
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function prec(e: Expr): number {
  if (e.kind === 'bin') return e.op === '+' || e.op === '-' ? 1 : e.op === '^' ? 4 : 2;
  if (e.kind === 'neg') return 3;
  return 5;
}

interface Style {
  pi: string;
  sym: (name: string) => string;
  mul: (left: Expr, right: Expr, l: string, r: string) => string;
  div: (l: string, r: string) => string;
  pow: (l: string, r: string) => string;
}

function print(e: Expr, s: Style): string {
  const wrap = (child: Expr, minPrec: number) => {
    const text = print(child, s);
    return prec(child) < minPrec ? `(${text})` : text;
  };
  switch (e.kind) {
    case 'num':
      return e.text;
    case 'pi':
      return s.pi;
    case 'sym':
      return s.sym(e.name);
    case 'neg':
      return `-${wrap(e.arg, 3)}`;
    case 'bin': {
      const p = prec(e);
      switch (e.op) {
        case '+':
          return `${wrap(e.left, p)} + ${wrap(e.right, p)}`;
        case '-':
          return `${wrap(e.left, p)} - ${wrap(e.right, p + 1)}`;
        case '*':
          return s.mul(e.left, e.right, wrap(e.left, p), wrap(e.right, p));
        case '/':
          return s.div(wrap(e.left, p), wrap(e.right, p + 1));
        case '^':
          return s.pow(wrap(e.left, 5), wrap(e.right, 4));
      }
    }
  }
}

const pythonStyle = (pi: string, sym = (name: string) => name): Style => ({
  pi,
  sym,
  mul: (_a, _b, l, r) => `${l}*${r}`,
  div: (l, r) => `${l}/${r}`,
  pow: (l, r) => `${l}**${r}`,
});

export const toPython = (e: Expr, pi = 'np.pi', sym?: (name: string) => string): string =>
  print(e, pythonStyle(pi, sym));

export const toQasm = (e: Expr): string =>
  print(e, { ...pythonStyle('pi'), pow: (l, r) => `${l}^${r}` });

export const toLatex = (e: Expr): string =>
  print(e, {
    pi: '\\pi',
    sym: (name) => (GREEK.has(name) ? `\\${name}` : name),
    // 2\pi and 3\theta read better without a multiplication sign
    mul: (a, b, l, r) => {
      const coefficient = a.kind === 'num' || (a.kind === 'neg' && a.arg.kind === 'num');
      return coefficient && (b.kind === 'pi' || b.kind === 'sym') ? `${l}${r}` : `${l} \\cdot ${r}`;
    },
    div: (l, r) => `${l}/${r}`,
    pow: (l, r) => `${l}^{${r}}`,
  });
