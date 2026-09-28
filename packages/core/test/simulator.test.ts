import { describe, expect, it } from 'vitest';
import { type Circuit, CircuitError, simulate } from '../src';
import reference from './fixtures/reference.json';
import { circuitOf } from './helpers';

describe('simulate', () => {
  it('prepares a Bell state', () => {
    const r = simulate(circuitOf(2, [{ gate: 'H', targets: [0] }, { gate: 'CNOT', controls: [0], targets: [1] }]));
    expect(r.probabilities['00']).toBeCloseTo(0.5);
    expect(r.probabilities['11']).toBeCloseTo(0.5);
    expect(r.probabilities['01']).toBeCloseTo(0);
    expect(r.wires).toEqual([0, 1]);
  });

  it('orders bitstrings with wire 0 first', () => {
    const r = simulate(circuitOf(3, [{ gate: 'X', targets: [0] }]));
    expect(r.probabilities['100']).toBeCloseTo(1);
  });

  it('returns the marginal over measured wires', () => {
    const r = simulate(
      circuitOf(3, [
        { gate: 'X', targets: [2] },
        { gate: 'MEASURE', targets: [2] },
      ]),
    );
    expect(r.wires).toEqual([2]);
    expect(r.probabilities).toEqual({ '0': 0, '1': 1 });
    expect(r.expectations).toEqual({ 2: -1 });
  });

  it('samples reproducibly with a seed', () => {
    const c = circuitOf(1, [{ gate: 'H', targets: [0] }]);
    const a = simulate(c, { shots: 1000, seed: 42 });
    const b = simulate(c, { shots: 1000, seed: 42 });
    expect(a.counts).toEqual(b.counts);
    expect((a.counts?.['0'] ?? 0) + (a.counts?.['1'] ?? 0)).toBe(1000);
    expect(a.counts?.['0']).toBeGreaterThan(400);
  });

  it('rejects symbolic parameters and custom gates', () => {
    expect(() => simulate(circuitOf(1, [{ gate: 'RX', targets: [0], params: ['theta'] }]))).toThrow(CircuitError);
    const c = circuitOf(2, [{ gate: 'CUSTOM', targets: [0, 1], customId: 'u' }]);
    c.customGates = [{ id: 'u', label: 'U' }];
    expect(() => simulate(c)).toThrow(/LaTeX/);
  });

  it('rejects overlapping gates', () => {
    const c = circuitOf(3, [{ gate: 'CNOT', controls: [0], targets: [2] }]);
    c.operations.push({ id: 'x', gate: 'X', column: 0, targets: [1], controls: [], params: [] });
    expect(() => simulate(c)).toThrow(/overlaps/);
  });
});

describe('matches PennyLane', () => {
  for (const { name, circuit, wires, probabilities } of reference.cases) {
    it(name, () => {
      const r = simulate(circuit as Circuit);
      expect(r.wires).toEqual(wires);
      for (const [bits, p] of Object.entries(probabilities)) {
        expect(r.probabilities[bits], bits).toBeCloseTo(p, 10);
      }
    });
  }
});
