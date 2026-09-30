import { evalAngle, freeSymbols, parseExpr } from './expr';
import { GATES, type GateName } from './gates';

export type Basis = 'Z' | 'X' | 'Y';

/** Classical control: the operation is applied only when classical bit `bit` holds `value`. */
export interface Condition {
  bit: number;
  value: 0 | 1;
}

export interface Operation {
  id: string;
  gate: GateName;
  /** Time step (grid column). Operations in the same column act on disjoint wires. */
  column: number;
  /** Target wires. SWAP/CSWAP have two; custom gates cover one or more. */
  targets: number[];
  controls: number[];
  /** Angle expressions, e.g. `pi/2` or `\theta`. */
  params: string[];
  /** Basis of a MEASURE operation (defaults to Z). */
  basis?: Basis;
  /** Classical bit a MEASURE operation stores its outcome in. */
  classicalTarget?: number;
  /** Classical control of a gate. */
  condition?: Condition;
  /** Custom gate definition used by a CUSTOM operation. */
  customId?: string;
}

export interface CustomGateDef {
  id: string;
  /** LaTeX shown inside the gate box, e.g. `U_f` or `QFT^\dagger`. */
  label: string;
}

export interface Circuit {
  numQubits: number;
  numColumns: number;
  /** LaTeX (math mode) label for each wire, e.g. `|q_{0}\rangle`. */
  qubitLabels: string[];
  operations: Operation[];
  customGates: CustomGateDef[];
}

export const MAX_QUBITS = 16;
export const MAX_CLBITS = 16;

export const isClbit = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < MAX_CLBITS;

export const defaultQubitLabel = (wire: number) => `|q_{${wire}}\\rangle`;

export function createCircuit(numQubits = 3, numColumns = 12): Circuit {
  return {
    numQubits,
    numColumns,
    qubitLabels: Array.from({ length: numQubits }, (_, i) => defaultQubitLabel(i)),
    operations: [],
    customGates: [],
  };
}

export const wiresOf = (op: Operation): number[] => [...op.controls, ...op.targets];

/** The inclusive range of wires an operation covers in its column (including the vertical line). */
export function spanOf(op: Operation): [number, number] {
  const wires = wiresOf(op);
  return [Math.min(...wires), Math.max(...wires)];
}

/** Operations in execution order: by column, then top to bottom. */
export function orderedOperations(circuit: Circuit): Operation[] {
  return [...circuit.operations].sort((a, b) => a.column - b.column || spanOf(a)[0] - spanOf(b)[0]);
}

/**
 * Circuit depth: the number of layers when every operation is pushed as early
 * as its wires allow. Empty columns do not count, and gates on disjoint wires
 * share a layer even if they were drawn in different columns. A classically
 * controlled gate comes after the measurement that writes its bit.
 */
export function circuitDepth(circuit: Circuit): number {
  const level = new Array<number>(circuit.numQubits).fill(0);
  const written = new Map<number, number>();
  for (const op of orderedOperations(circuit)) {
    const wires = wiresOf(op);
    const after = op.condition ? (written.get(op.condition.bit) ?? 0) : 0;
    const layer = Math.max(after, ...wires.map((w) => level[w] ?? 0)) + 1;
    for (const w of wires) level[w] = layer;
    if (op.gate === 'MEASURE' && op.classicalTarget !== undefined) written.set(op.classicalTarget, layer);
  }
  return Math.max(0, ...level);
}

/** Classical bits in use: one more than the highest bit a measurement writes or a gate reads. */
export function numClbits(circuit: Circuit): number {
  const used = Math.max(0, ...circuit.operations.map((op) => Math.max(op.classicalTarget ?? -1, op.condition?.bit ?? -1) + 1));
  return Math.min(MAX_CLBITS, used);
}

/** Readout basis per wire that ends in a measurement (the last operation on the wire is a MEASURE). */
export function measurementBases(circuit: Circuit): Map<number, Basis> {
  const bases = new Map<number, Basis>();
  for (const op of orderedOperations(circuit)) {
    if (op.gate === 'MEASURE') bases.set(op.targets[0], op.basis ?? 'Z');
    else for (const w of wiresOf(op)) bases.delete(w);
  }
  return bases;
}

/**
 * Measurements that have to collapse the state where they are placed: a later
 * operation acts on the wire, or a later gate is conditioned on the outcome.
 * All other measurements only read out their wire at the end of the circuit.
 */
export function midCircuitMeasurements(circuit: Circuit): Set<string> {
  const mid = new Set<string>();
  const usedLater = new Set<number>();
  const readLater = new Set<number>();
  for (const op of orderedOperations(circuit).reverse()) {
    if (op.gate === 'MEASURE') {
      const stored = op.classicalTarget !== undefined && readLater.delete(op.classicalTarget);
      if (stored || usedLater.has(op.targets[0])) mid.add(op.id);
    }
    if (op.condition) readLater.add(op.condition.bit);
    for (const w of wiresOf(op)) usedLater.add(w);
  }
  return mid;
}

/** Wires included in the result: the ones that end in a measurement, or all wires when none do. */
export function measuredWires(circuit: Circuit): number[] {
  const measured = [...measurementBases(circuit).keys()].sort((a, b) => a - b);
  return measured.length > 0 ? measured : Array.from({ length: circuit.numQubits }, (_, i) => i);
}

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  message: string;
  opId?: string;
}

/**
 * Structural checks that apply to every output (overlaps, wire ranges, arity).
 * Pass `numeric: true` to also require that every parameter evaluates to a number
 * and that no LaTeX-only gates are present, as simulation and code generation need.
 */
export function validate(circuit: Circuit, opts: { numeric?: boolean } = {}): Issue[] {
  const issues: Issue[] = [];
  const occupied = new Map<string, string>();

  for (const op of circuit.operations) {
    const spec = GATES[op.gate];
    const wires = wiresOf(op);
    const err = (message: string) => issues.push({ level: 'error', message, opId: op.id });

    if (!spec) {
      err(`Unknown gate "${op.gate}"`);
      continue;
    }
    if (op.controls.length !== spec.controls) err(`${spec.label} needs ${spec.controls} control wire(s)`);
    if (spec.targets !== null && op.targets.length !== spec.targets) err(`${spec.label} needs ${spec.targets} target wire(s)`);
    if (op.targets.length === 0) err(`${spec.label} has no target wire`);
    if (new Set(wires).size !== wires.length) err(`${spec.label} uses the same wire twice`);
    if (wires.some((w) => !Number.isInteger(w) || w < 0 || w >= circuit.numQubits)) {
      err(`${spec.label} is placed on a wire that does not exist`);
      continue;
    }
    if (op.column < 0 || op.column >= circuit.numColumns) err(`${spec.label} is outside the circuit`);

    const [lo, hi] = spanOf(op);
    for (let w = lo; w <= hi; w++) {
      const key = `${op.column}:${w}`;
      const other = occupied.get(key);
      if (other) err(`${spec.label} overlaps another gate in step ${op.column + 1}`);
      occupied.set(key, op.id);
      if (other) break;
    }

    if (op.params.length !== spec.params) err(`${spec.label} needs ${spec.params} parameter(s)`);
    for (const p of op.params) {
      const parsed = parseExpr(p);
      if (!parsed.ok) {
        err(`${spec.label}: invalid angle "${p}" (${parsed.error})`);
      } else if (opts.numeric) {
        const symbols = [...freeSymbols(parsed.expr)];
        if (symbols.length > 0) err(`${spec.label}: parameter ${symbols.join(', ')} needs a numeric value to simulate`);
        else if (!evalAngle(p).ok) err(`${spec.label}: angle "${p}" is not a finite number`);
      }
    }

    if (op.gate === 'CUSTOM') {
      if (!circuit.customGates.some((g) => g.id === op.customId)) err('Custom gate definition is missing');
      if (opts.numeric) err(`Custom gate "${customLabel(circuit, op)}" can only be exported to LaTeX`);
    }

    if (op.classicalTarget !== undefined) {
      if (op.gate !== 'MEASURE') err(`${spec.label} cannot store a result in a classical bit`);
      else if (!isClbit(op.classicalTarget)) err(`${spec.label} stores its result in a classical bit that does not exist`);
    }
    if (op.condition) {
      const { bit, value } = op.condition;
      if (op.gate === 'MEASURE') err('A measurement cannot be classically controlled');
      else if (!isClbit(bit) || (value !== 0 && value !== 1)) err(`${spec.label} has an invalid classical condition`);
      else {
        // Operations in one column are drawn as simultaneous, so the bit has to be written in an earlier one.
        const writers = circuit.operations.filter((o) => o.gate === 'MEASURE' && o.classicalTarget === bit);
        if (writers.some((o) => o.column === op.column)) {
          err(`${spec.label} is conditioned on c${bit}, which is measured in the same step; move the gate to a later step`);
        } else if (!writers.some((o) => o.column < op.column)) {
          err(`${spec.label} is conditioned on c${bit}, but no earlier measurement stores its result there`);
        }
      }
    }
  }

  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error');

export function customLabel(circuit: Circuit, op: Operation): string {
  return circuit.customGates.find((g) => g.id === op.customId)?.label ?? 'U';
}

/** Numeric parameter values of an operation. Call only on circuits that passed numeric validation. */
export function numericParams(op: Operation): number[] {
  return op.params.map((p) => {
    const r = evalAngle(p);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  });
}
