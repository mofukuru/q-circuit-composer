import { type Circuit, defaultQubitLabel, MAX_QUBITS, type Operation, spanOf, wiresOf } from './circuit';
import { GATES, type GateName } from './gates';

/** Immutable editing operations used by the editor. Each returns a new circuit, or null if the edit is not possible. */

export const MIN_COLUMNS = 8;
export const MAX_COLUMNS = 64;

let counter = 0;
export const newId = (prefix = 'op') => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const DEFAULT_PARAM = 'pi/2';

/**
 * Wires for a gate dropped on `row`: the gate's wires are consecutive and start
 * at the dropped row (shifted up if they would run past the last wire).
 * Controls come first, then targets.
 */
export function defaultWires(gate: GateName, row: number, numQubits: number, size = 1) {
  const spec = GATES[gate];
  const total = spec.controls + (spec.targets ?? size);
  const start = Math.min(row, numQubits - total);
  if (start < 0) return null;
  const wires = Array.from({ length: total }, (_, i) => start + i);
  return { controls: wires.slice(0, spec.controls), targets: wires.slice(spec.controls) };
}

/** True when `op` fits in the circuit without overlapping another operation. */
export function canPlace(circuit: Circuit, op: Operation, ignoreId = op.id): boolean {
  const wires = wiresOf(op);
  if (wires.some((w) => w < 0 || w >= circuit.numQubits) || new Set(wires).size !== wires.length) return false;
  if (op.column < 0 || op.column >= MAX_COLUMNS) return false;
  const [lo, hi] = spanOf(op);
  return !circuit.operations.some((other) => {
    if (other.id === ignoreId || other.column !== op.column) return false;
    const [a, b] = spanOf(other);
    return a <= hi && lo <= b;
  });
}

/** Keeps a couple of empty columns after the last operation so there is always room to drop. */
function withColumns(circuit: Circuit): Circuit {
  const last = Math.max(-1, ...circuit.operations.map((o) => o.column));
  const numColumns = Math.min(MAX_COLUMNS, Math.max(circuit.numColumns, last + 3, MIN_COLUMNS));
  return numColumns === circuit.numColumns ? circuit : { ...circuit, numColumns };
}

export function createOperation(
  circuit: Circuit,
  gate: GateName,
  column: number,
  row: number,
  extra: { customId?: string; size?: number } = {},
): Operation | null {
  const wires = defaultWires(gate, row, circuit.numQubits, extra.size);
  if (!wires) return null;
  const spec = GATES[gate];
  return {
    id: newId(),
    gate,
    column,
    ...wires,
    params: Array.from({ length: spec.params }, () => DEFAULT_PARAM),
    ...(gate === 'MEASURE' ? { basis: 'Z' as const } : {}),
    ...(gate === 'CUSTOM' ? { customId: extra.customId } : {}),
  };
}

export function addOperation(circuit: Circuit, op: Operation): Circuit | null {
  if (!canPlace(circuit, op)) return null;
  return withColumns({ ...circuit, operations: [...circuit.operations, op] });
}

function replace(circuit: Circuit, next: Operation): Circuit | null {
  if (!canPlace(circuit, next)) return null;
  return withColumns({ ...circuit, operations: circuit.operations.map((o) => (o.id === next.id ? next : o)) });
}

const find = (circuit: Circuit, id: string) => circuit.operations.find((o) => o.id === id);

/** Moves an operation to `column`, shifting all its wires by `rowDelta`. */
export function moveOperation(circuit: Circuit, id: string, column: number, rowDelta: number): Circuit | null {
  const op = find(circuit, id);
  if (!op) return null;
  const shift = (ws: number[]) => ws.map((w) => w + rowDelta);
  return replace(circuit, { ...op, column, controls: shift(op.controls), targets: shift(op.targets) });
}

/**
 * Moves one wire of an operation, optionally moving the whole operation to
 * another column. Moving onto another wire of the same operation swaps the
 * two, which is how a control and target trade places.
 */
export function setWire(
  circuit: Circuit,
  id: string,
  role: 'controls' | 'targets',
  index: number,
  wire: number,
  column?: number,
): Circuit | null {
  const op = find(circuit, id);
  if (!op || op.gate === 'CUSTOM') return null;
  const controls = [...op.controls];
  const targets = [...op.targets];
  const lists = { controls, targets };
  const old = lists[role][index];
  if (old === undefined) return null;
  for (const list of [controls, targets]) {
    const j = list.indexOf(wire);
    if (j >= 0) list[j] = old;
  }
  lists[role][index] = wire;
  return replace(circuit, { ...op, column: column ?? op.column, controls, targets });
}

/** Changes how many consecutive wires a custom gate covers. */
export function resizeCustom(circuit: Circuit, id: string, size: number): Circuit | null {
  const op = find(circuit, id);
  if (!op || op.gate !== 'CUSTOM' || size < 1) return null;
  const top = Math.min(...op.targets);
  return replace(circuit, { ...op, targets: Array.from({ length: size }, (_, i) => top + i) });
}

export function updateOperation(circuit: Circuit, id: string, patch: Partial<Pick<Operation, 'params' | 'basis' | 'customId'>>): Circuit {
  return { ...circuit, operations: circuit.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

export function removeOperation(circuit: Circuit, id: string): Circuit {
  return { ...circuit, operations: circuit.operations.filter((o) => o.id !== id) };
}

/** Changes the number of wires; operations that no longer fit are removed. */
export function setNumQubits(circuit: Circuit, numQubits: number): Circuit {
  const n = Math.max(1, Math.min(MAX_QUBITS, Math.round(numQubits)));
  return {
    ...circuit,
    numQubits: n,
    qubitLabels: Array.from({ length: n }, (_, i) => circuit.qubitLabels[i] ?? defaultQubitLabel(i)),
    operations: circuit.operations.filter((o) => wiresOf(o).every((w) => w < n)),
  };
}

/** Changes the number of steps; operations in removed steps are dropped. */
export function setNumColumns(circuit: Circuit, numColumns: number): Circuit {
  const n = Math.max(1, Math.min(MAX_COLUMNS, Math.round(numColumns)));
  return { ...circuit, numColumns: n, operations: circuit.operations.filter((o) => o.column < n) };
}

export function setQubitLabel(circuit: Circuit, wire: number, label: string): Circuit {
  const qubitLabels = [...circuit.qubitLabels];
  qubitLabels[wire] = label;
  return { ...circuit, qubitLabels };
}

export function addCustomGate(circuit: Circuit, label: string): Circuit {
  return { ...circuit, customGates: [...circuit.customGates, { id: newId('gate'), label }] };
}

export function renameCustomGate(circuit: Circuit, id: string, label: string): Circuit {
  return { ...circuit, customGates: circuit.customGates.map((g) => (g.id === id ? { ...g, label } : g)) };
}

/** Removes a custom gate definition and every placed instance of it. */
export function removeCustomGate(circuit: Circuit, id: string): Circuit {
  return {
    ...circuit,
    customGates: circuit.customGates.filter((g) => g.id !== id),
    operations: circuit.operations.filter((o) => o.customId !== id),
  };
}

export function clearOperations(circuit: Circuit): Circuit {
  return { ...circuit, operations: [] };
}
