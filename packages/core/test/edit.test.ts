import { describe, expect, it } from 'vitest';
import {
  addCustomGate,
  addOperation,
  type Circuit,
  createCircuit,
  createOperation,
  decodeCircuit,
  encodeCircuit,
  moveOperation,
  parseCircuit,
  removeCustomGate,
  resizeCustom,
  setNumQubits,
  setQubitLabel,
  setWire,
} from '../src';

function place(circuit: Circuit, gate: Parameters<typeof createOperation>[1], column: number, row: number, extra = {}) {
  const op = createOperation(circuit, gate, column, row, extra);
  if (!op) throw new Error('cannot create');
  const next = addOperation(circuit, op);
  if (!next) throw new Error('cannot place');
  return { circuit: next, op };
}

describe('editing', () => {
  it('places multi-qubit gates on consecutive wires from the dropped row', () => {
    const c = createCircuit(3);
    expect(place(c, 'CNOT', 0, 0).op).toMatchObject({ controls: [0], targets: [1] });
    // shifted up so it fits
    expect(place(c, 'CCX', 0, 2).op).toMatchObject({ controls: [0, 1], targets: [2] });
    expect(createOperation(createCircuit(2), 'CCX', 0, 0)).toBeNull();
  });

  it('gives rotation gates a default angle and measurements a Z basis', () => {
    const c = createCircuit(1);
    expect(place(c, 'RX', 0, 0).op.params).toEqual(['pi/2']);
    expect(place(c, 'MEASURE', 0, 0).op.basis).toBe('Z');
  });

  it('refuses overlapping placements, including the vertical line of a gate', () => {
    const { circuit } = place(createCircuit(3), 'CNOT', 0, 0);
    const moved = setWire(circuit, circuit.operations[0].id, 'targets', 0, 2)!;
    const x = createOperation(moved, 'X', 0, 1)!;
    expect(addOperation(moved, x)).toBeNull();
    expect(addOperation(moved, { ...x, column: 1 })).not.toBeNull();
  });

  it('keeps empty columns after the last gate', () => {
    const c = createCircuit(1, 8);
    expect(place(c, 'H', 7, 0).circuit.numColumns).toBe(10);
  });

  it('moves a gate with all its wires', () => {
    const { circuit, op } = place(createCircuit(4), 'CNOT', 0, 0);
    expect(moveOperation(circuit, op.id, 3, 2)!.operations[0]).toMatchObject({ column: 3, controls: [2], targets: [3] });
    expect(moveOperation(circuit, op.id, 3, 3)).toBeNull();
  });

  it('swaps control and target when one is dragged onto the other', () => {
    const { circuit, op } = place(createCircuit(2), 'CNOT', 0, 0);
    expect(setWire(circuit, op.id, 'controls', 0, 1)!.operations[0]).toMatchObject({ controls: [1], targets: [0] });
  });

  it('resizes custom gates and removes them with their definition', () => {
    let c = addCustomGate(createCircuit(3), 'U');
    const id = c.customGates[0].id;
    const placed = place(c, 'CUSTOM', 0, 0, { customId: id });
    c = resizeCustom(placed.circuit, placed.op.id, 3)!;
    expect(c.operations[0].targets).toEqual([0, 1, 2]);
    expect(resizeCustom(c, placed.op.id, 4)).toBeNull();
    expect(removeCustomGate(c, id).operations).toEqual([]);
  });

  it('drops gates that no longer fit when wires are removed', () => {
    const { circuit } = place(createCircuit(3), 'CNOT', 0, 1);
    const smaller = setNumQubits(circuit, 2);
    expect(smaller.operations).toEqual([]);
    expect(smaller.qubitLabels).toHaveLength(2);
  });
});

describe('serialization', () => {
  it('round-trips through share links, including non-ASCII labels', () => {
    let c = place(createCircuit(2), 'RX', 1, 0).circuit;
    c = setQubitLabel(c, 0, '|ψ⟩');
    expect(decodeCircuit(encodeCircuit(c))).toEqual(c);
  });

  it('rejects data that is not a circuit', () => {
    expect(() => parseCircuit('nope')).toThrow(/JSON/);
    expect(() => parseCircuit('{"a":1}')).toThrow(/not a circuit/);
    expect(() => parseCircuit('{"numQubits":1,"operations":[{"gate":"FOO"}]}')).toThrow(/unknown gate/);
  });
});
