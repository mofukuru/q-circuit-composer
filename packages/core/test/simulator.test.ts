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

describe('dynamic circuits', () => {
  it('collapses the state at a mid-circuit measurement', () => {
    // H, H is the identity, but a measurement in between leaves the qubit in |0> or |1>.
    const r = simulate(circuitOf(1, [{ gate: 'H', targets: [0] }, { gate: 'MEASURE', targets: [0] }, { gate: 'H', targets: [0] }]));
    expect(r.wires).toEqual([0]);
    expect(r.bases).toEqual({});
    expect(r.probabilities['0']).toBeCloseTo(0.5);
    expect(r.probabilities['1']).toBeCloseTo(0.5);
  });

  it('applies classically controlled gates only on the matching outcome', () => {
    const copy = (value: 0 | 1) =>
      simulate(
        circuitOf(2, [
          { gate: 'H', targets: [0] },
          { gate: 'MEASURE', targets: [0], classicalTarget: 0 },
          { gate: 'X', targets: [1], condition: { bit: 0, value } },
          { gate: 'MEASURE', targets: [1] },
        ]),
      ).probabilities;
    expect(copy(1)['00']).toBeCloseTo(0.5);
    expect(copy(1)['11']).toBeCloseTo(0.5);
    expect(copy(0)['01']).toBeCloseTo(0.5);
    expect(copy(0)['10']).toBeCloseTo(0.5);
  });

  it('resets a qubit with a measurement and a conditional X', () => {
    const r = simulate(
      circuitOf(1, [
        { gate: 'RX', targets: [0], params: ['1.2'] },
        { gate: 'MEASURE', targets: [0], classicalTarget: 0 },
        { gate: 'X', targets: [0], condition: { bit: 0, value: 1 } },
      ]),
    );
    expect(r.probabilities['0']).toBeCloseTo(1);
  });

  it('reads out only the wires that end in a measurement', () => {
    const r = simulate(
      circuitOf(2, [
        { gate: 'MEASURE', targets: [0] },
        { gate: 'X', targets: [0] },
        { gate: 'MEASURE', targets: [1], basis: 'X' },
      ]),
    );
    expect(r.wires).toEqual([1]);
    expect(r.bases).toEqual({ 1: 'X' });
  });

  it('rejects conditions on a bit that is not measured earlier', () => {
    const x = (): Parameters<typeof circuitOf>[1][number] => ({ gate: 'X', targets: [1], condition: { bit: 0, value: 1 } });
    expect(() => simulate(circuitOf(2, [x()]))).toThrow(/no earlier measurement/);
    expect(() => simulate(circuitOf(2, [x(), { gate: 'MEASURE', targets: [0], classicalTarget: 0 }]))).toThrow(/no earlier measurement/);
    const sameStep = circuitOf(2, [{ gate: 'MEASURE', targets: [0], classicalTarget: 0 }, x()]);
    sameStep.operations[1].column = 0;
    expect(() => simulate(sameStep)).toThrow(/same step/);
  });

  it('rejects classical bits on the wrong kind of operation', () => {
    expect(() => simulate(circuitOf(1, [{ gate: 'H', targets: [0], classicalTarget: 0 }]))).toThrow(/cannot store/);
    expect(() =>
      simulate(circuitOf(2, [{ gate: 'MEASURE', targets: [0], classicalTarget: 0 }, { gate: 'MEASURE', targets: [1], condition: { bit: 0, value: 1 } }])),
    ).toThrow(/cannot be classically controlled/);
  });

  it('gives up when there are too many outcomes to follow', () => {
    // Each round leaves 16 qubits in a fresh superposition and measures one of them again.
    const c = circuitOf(16, []);
    c.operations = Array.from({ length: 16 }, (_, w) => ({ id: `h${w}`, gate: 'H' as const, column: 0, targets: [w], controls: [], params: [] }));
    for (let w = 0; w < 8; w++) {
      c.operations.push({ id: `m${w}`, gate: 'MEASURE', column: 1, targets: [w], controls: [], params: [] });
      c.operations.push({ id: `g${w}`, gate: 'H', column: 2, targets: [w], controls: [], params: [] });
    }
    c.numColumns = 3;
    expect(() => simulate(c)).toThrow(/Too many mid-circuit measurement outcomes/);
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
