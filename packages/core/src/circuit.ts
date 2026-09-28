import { evalAngle, freeSymbols, parseExpr } from './expr';
import { GATES, type GateName } from './gates';

export type Basis = 'Z' | 'X' | 'Y';

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
  /** Readout basis of a MEASURE operation (defaults to Z). */
  basis?: Basis;
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
 * share a layer even if they were drawn in different columns.
 */
export function circuitDepth(circuit: Circuit): number {
  const level = new Array<number>(circuit.numQubits).fill(0);
  for (const op of orderedOperations(circuit)) {
    const wires = wiresOf(op);
    const layer = Math.max(...wires.map((w) => level[w] ?? 0)) + 1;
    for (const w of wires) level[w] = layer;
  }
  return Math.max(0, ...level);
}

/** Readout basis per explicitly measured wire; the last measurement on a wire wins. */
export function measurementBases(circuit: Circuit): Map<number, Basis> {
  const bases = new Map<number, Basis>();
  for (const op of orderedOperations(circuit)) {
    if (op.gate === 'MEASURE') bases.set(op.targets[0], op.basis ?? 'Z');
  }
  return bases;
}

/** Wires included in the result: explicitly measured ones, or all wires when none are. */
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
  }

  // Readout markers are applied at the end of the circuit, so gates after them are misleading.
  const bases = measurementBases(circuit);
  const lastMeasureColumn = new Map<number, number>();
  for (const op of circuit.operations) {
    if (op.gate === 'MEASURE') {
      const w = op.targets[0];
      lastMeasureColumn.set(w, Math.max(op.column, lastMeasureColumn.get(w) ?? -1));
    }
  }
  for (const op of circuit.operations) {
    if (op.gate === 'MEASURE') continue;
    const late = wiresOf(op).find((w) => bases.has(w) && op.column > (lastMeasureColumn.get(w) ?? Infinity));
    if (late !== undefined) {
      issues.push({
        level: 'warning',
        opId: op.id,
        message: `${GATES[op.gate].label} comes after the measurement on q${late}. Measurements are applied at the end of the circuit (mid-circuit measurement is not supported yet).`,
      });
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
