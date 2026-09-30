import { describe, expect, it } from 'vitest';
import { parseMath, renderCircuitSvg } from '../src';
import { circuitOf } from './helpers';

const count = (svg: string, tag: string) => svg.split(`<${tag} `).length - 1;

describe('renderCircuitSvg', () => {
  it('draws wires, boxes, controls and targets', () => {
    const svg = renderCircuitSvg(
      circuitOf(2, [
        { gate: 'H', targets: [0] },
        { gate: 'CNOT', controls: [0], targets: [1] },
      ]),
    );
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('<tspan>H</tspan></text>');
    // two wires, the vertical CNOT line and the two strokes of the plus
    expect(count(svg, 'line')).toBe(5);
    expect(count(svg, 'circle')).toBe(2); // control dot and target circle
  });

  it('typesets subscripts and symbols', () => {
    const c = circuitOf(1, [{ gate: 'RX', targets: [0], params: ['pi/2'] }]);
    const svg = renderCircuitSvg(c);
    expect(svg).toContain('<tspan>R</tspan><tspan dy="5.1" font-size="11.9">x</tspan><tspan dy="-5.1">(π/2)</tspan>');
    expect(svg).toContain('<tspan>|q</tspan><tspan dy="5.1" font-size="11.9">0</tspan><tspan dy="-5.1">⟩</tspan>');
  });

  it('escapes text', () => {
    const c = circuitOf(1, [{ gate: 'CUSTOM', targets: [0], customId: 'u' }]);
    c.customGates = [{ id: 'u', label: 'A<B&"C"' }];
    const svg = renderCircuitSvg(c);
    expect(svg).toContain('A&lt;B&amp;&quot;C&quot;');
    expect(svg).not.toContain('A<B');
  });

  it('ends a measured wire at its meter and labels non-Z bases', () => {
    const svg = renderCircuitSvg(circuitOf(2, [{ gate: 'H', targets: [1] }, { gate: 'MEASURE', targets: [0], basis: 'X' }]));
    const wires = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="\2" \/>/g)].map((m) => Number(m[3]));
    expect(wires[0]).toBeLessThan(wires[1]);
    expect(svg).toContain('<tspan>X</tspan></text>');
  });

  it('runs a wire on after a mid-circuit measurement and draws classical bits', () => {
    const svg = renderCircuitSvg(
      circuitOf(2, [
        { gate: 'MEASURE', targets: [0], classicalTarget: 0 },
        { gate: 'X', targets: [1], condition: { bit: 0, value: 0 } },
        { gate: 'H', targets: [0] },
      ]),
    );
    const wires = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="\2" \/>/g)].map((m) => Number(m[3]));
    // two qubit wires and the double classical wire all reach the right edge
    expect(new Set(wires.slice(0, 4)).size).toBe(1);
    expect(svg).toContain('<tspan>c</tspan><tspan dy="5.1" font-size="11.9">0</tspan></text>');
    expect(svg).toContain('r="4.5" fill="#fff" />'); // open control: condition on 0
  });

  it('draws only wires for an invalid circuit', () => {
    const c = circuitOf(2, [{ gate: 'CNOT', controls: [0], targets: [1] }]);
    c.operations.push({ id: 'x', gate: 'X', column: 0, controls: [], targets: [1], params: [] });
    expect(count(renderCircuitSvg(c), 'line')).toBe(2);
  });
});

describe('parseMath', () => {
  it.each([
    ['|q_{0}\\rangle', [{ text: '|q', shift: null }, { text: '0', shift: 'sub' }, { text: '⟩', shift: null }]],
    ['\\ket{\\psi}', [{ text: '|ψ⟩', shift: null }]],
    ['U_f^\\dagger', [{ text: 'U', shift: null }, { text: 'f', shift: 'sub' }, { text: '†', shift: 'super' }]],
    ['R_{zz}(2\\theta)', [{ text: 'R', shift: null }, { text: 'zz', shift: 'sub' }, { text: '(2θ)', shift: null }]],
    ['\\mathrm{QFT}', [{ text: 'QFT', shift: null }]],
  ])('%s', (latex, runs) => {
    expect(parseMath(latex)).toEqual(runs);
  });
});
