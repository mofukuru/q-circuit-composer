import { describe, expect, it } from 'vitest';
import { evalAngle, parseExpr, toLatex, toPython, toQasm } from '../src';

const expr = (src: string) => {
  const r = parseExpr(src);
  if (!r.ok) throw new Error(r.error);
  return r.expr;
};

describe('angle expressions', () => {
  it.each([
    ['pi/2', Math.PI / 2],
    ['-3*pi/4', (-3 * Math.PI) / 4],
    ['2pi', 2 * Math.PI],
    ['π/8', Math.PI / 8],
    ['0.25', 0.25],
    ['1e-3', 0.001],
    ['(1 + 2) * 3', 9],
    ['2^3', 8],
    ['1 - 2 - 3', -4],
  ])('evaluates %s', (src, value) => {
    const r = evalAngle(src);
    expect(r.ok && r.value).toBeCloseTo(value);
  });

  it('reports errors', () => {
    expect(parseExpr('').ok).toBe(false);
    expect(parseExpr('pi/').ok).toBe(false);
    expect(parseExpr('(1').ok).toBe(false);
    expect(parseExpr('1 $ 2').ok).toBe(false);
    expect(evalAngle('theta').ok).toBe(false);
  });

  it('renders LaTeX', () => {
    expect(toLatex(expr('pi/2'))).toBe('\\pi/2');
    expect(toLatex(expr('2\\theta'))).toBe('2\\theta');
    expect(toLatex(expr('-3pi/4'))).toBe('-3\\pi/4');
    expect(toLatex(expr('phi^2'))).toBe('\\phi^{2}');
  });

  it('renders Python and QASM', () => {
    expect(toPython(expr('-pi/2'))).toBe('-np.pi/2');
    expect(toPython(expr('2(theta + 1)'))).toBe('2*(theta + 1)');
    expect(toPython(expr('1 - (2 - 3)'))).toBe('1 - (2 - 3)');
    expect(toQasm(expr('3pi/4'))).toBe('3*pi/4');
  });
});
