import { type Circuit, createCircuit, type Operation } from '../src';

let nextId = 0;
/** Builds a circuit with one operation per column. */
export function circuitOf(numQubits: number, ops: (Pick<Operation, 'gate' | 'targets'> & Partial<Operation>)[]): Circuit {
  const circuit = createCircuit(numQubits, Math.max(ops.length, 1));
  circuit.operations = ops.map((op, column) => ({
    id: `t${nextId++}`,
    column,
    controls: [],
    params: [],
    ...op,
  })) as Operation[];
  return circuit;
}
