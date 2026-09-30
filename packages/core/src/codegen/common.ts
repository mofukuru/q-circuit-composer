import {
  type Circuit,
  type Issue,
  type Operation,
  measurementBases,
  measuredWires,
  midCircuitMeasurements,
  numClbits,
  orderedOperations,
  validate,
} from '../circuit';
import { type Expr, freeSymbols, parseExpr, toPython } from '../expr';

export type CodeFormat = 'pennylane' | 'qiskit' | 'qulacs' | 'qasm' | 'latex';

export interface CodegenOptions {
  /** Shots for sampling-based outputs. */
  shots?: number;
  /** PennyLane return value: probabilities or per-wire <Z>. */
  resultMode?: 'probs' | 'expval';
  /** LaTeX: wrap in a compilable standalone document. */
  standalone?: boolean;
}

export interface CodegenResult {
  code: string;
  issues: Issue[];
}

export function parsed(p: string): Expr {
  const r = parseExpr(p);
  if (!r.ok) throw new Error(r.error);
  return r.expr;
}

const PY_KEYWORDS = new Set(['lambda', 'in', 'is', 'as', 'if', 'or', 'and', 'not', 'for', 'def', 'del', 'try']);

export const pySymbol = (name: string) => (PY_KEYWORDS.has(name) ? `${name}_` : name);

/** Python source for an angle; `pi` is spelled with the given constant. */
export function pyAngle(p: string, pi = 'np.pi'): string {
  return toPython(parsed(p), pi, pySymbol);
}

/** Common view of the circuit shared by the generators. */
export function prepare(circuit: Circuit) {
  const issues = validate(circuit);
  const ops = orderedOperations(circuit);
  const symbols = new Set<string>();
  let usesPi = false;
  for (const op of ops) {
    for (const p of op.params) {
      const r = parseExpr(p);
      if (!r.ok) continue;
      freeSymbols(r.expr, symbols);
      if (/pi|π/.test(p)) usesPi = true;
    }
  }
  // Frameworks need a classical bit for every mid-circuit measurement, so the
  // ones that store nothing get a scratch bit after the bits the circuit uses.
  const mid = midCircuitMeasurements(circuit);
  const clbit = new Map<string, number>();
  let clbits = mid.size > 0 ? numClbits(circuit) : 0;
  for (const op of ops) {
    if (mid.has(op.id)) clbit.set(op.id, op.classicalTarget ?? clbits++);
  }
  return {
    issues,
    ops,
    /** Readout basis of each wire that ends in a measurement. */
    bases: measurementBases(circuit),
    measured: measuredWires(circuit),
    /** Classical bit written by each mid-circuit measurement, by operation id. */
    clbit,
    /** Classical bits needed for mid-circuit measurements (0 for a static circuit). */
    clbits,
    symbols: [...symbols].sort(),
    usesPi,
  };
}

/**
 * Splits a measurement in `basis` into the gates before and after a Z
 * measurement, given the framework's spelling of S^dagger, H and S.
 */
export function inBasis(basis: Operation['basis'], sdg: string, h: string, s: string): { before: string[]; after: string[] } {
  if (basis === 'X') return { before: [h], after: [h] };
  if (basis === 'Y') return { before: [sdg, h], after: [h, s] };
  return { before: [], after: [] };
}

/** Warning for gates a simulation framework cannot express. */
export function skipped(op: Operation, format: string): Issue {
  return { level: 'warning', opId: op.id, message: `Custom gates are not exported to ${format}; skipped` };
}

export function symbolDeclarations(symbols: string[]): string[] {
  if (symbols.length === 0) return [];
  return [
    '# Free parameters: set their values here',
    ...symbols.map((s) => `${pySymbol(s)} = 0.0`),
    '',
  ];
}
