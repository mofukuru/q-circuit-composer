import {
  type Basis,
  type Circuit,
  hasErrors,
  type Issue,
  measurementBases,
  measuredWires,
  midCircuitMeasurements,
  numericParams,
  orderedOperations,
  validate,
} from './circuit';
import { GATES, type BaseGate } from './gates';

/** 2x2 complex matrix as [re00, im00, re01, im01, re10, im10, re11, im11]. */
type Mat2 = [number, number, number, number, number, number, number, number];

const SQRT1_2 = Math.SQRT1_2;

function matrix(gate: Exclude<BaseGate, 'SWAP'>, theta = 0): Mat2 {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  switch (gate) {
    case 'H':
      return [SQRT1_2, 0, SQRT1_2, 0, SQRT1_2, 0, -SQRT1_2, 0];
    case 'X':
      return [0, 0, 1, 0, 1, 0, 0, 0];
    case 'Y':
      return [0, 0, 0, -1, 0, 1, 0, 0];
    case 'Z':
      return [1, 0, 0, 0, 0, 0, -1, 0];
    case 'S':
      return [1, 0, 0, 0, 0, 0, 0, 1];
    case 'T':
      return [1, 0, 0, 0, 0, 0, SQRT1_2, SQRT1_2];
    case 'RX':
      return [c, 0, 0, -s, 0, -s, c, 0];
    case 'RY':
      return [c, 0, -s, 0, s, 0, c, 0];
    case 'RZ':
      return [c, -s, 0, 0, 0, 0, c, s];
  }
}

const S_DAG: Mat2 = [1, 0, 0, 0, 0, 0, 0, -1];

/** Rotates `wire` so that a Z measurement reads it in `basis`: H for X, S^dagger then H for Y. */
function toBasis(state: StateVector, wire: number, basis: Basis) {
  if (basis === 'Y') state.apply1(S_DAG, wire);
  if (basis !== 'Z') state.apply1(matrix('H'), wire);
}

function fromBasis(state: StateVector, wire: number, basis: Basis) {
  if (basis !== 'Z') state.apply1(matrix('H'), wire);
  if (basis === 'Y') state.apply1(matrix('S'), wire);
}

/**
 * Dense state vector. Wire 0 is the most significant bit of the basis-state
 * index, matching PennyLane's ordering (|q0 q1 ... q(n-1)>).
 */
export class StateVector {
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(readonly numQubits: number) {
    this.re = new Float64Array(1 << numQubits);
    this.im = new Float64Array(1 << numQubits);
    this.re[0] = 1;
  }

  mask(wire: number): number {
    return 1 << (this.numQubits - 1 - wire);
  }

  controlMask(controls: number[]): number {
    return controls.reduce((m, w) => m | this.mask(w), 0);
  }

  apply1(m: Mat2, target: number, controls: number[] = []) {
    const t = this.mask(target);
    const cm = this.controlMask(controls);
    const { re, im } = this;
    for (let i = 0; i < re.length; i++) {
      if (i & t || (i & cm) !== cm) continue;
      const j = i | t;
      const ar = re[i], ai = im[i], br = re[j], bi = im[j];
      re[i] = m[0] * ar - m[1] * ai + m[2] * br - m[3] * bi;
      im[i] = m[0] * ai + m[1] * ar + m[2] * bi + m[3] * br;
      re[j] = m[4] * ar - m[5] * ai + m[6] * br - m[7] * bi;
      im[j] = m[4] * ai + m[5] * ar + m[6] * bi + m[7] * br;
    }
  }

  swap(a: number, b: number, controls: number[] = []) {
    const ma = this.mask(a);
    const mb = this.mask(b);
    const cm = this.controlMask(controls);
    const { re, im } = this;
    for (let i = 0; i < re.length; i++) {
      if (!(i & ma) || i & mb || (i & cm) !== cm) continue;
      const j = (i & ~ma) | mb;
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  probabilities(): Float64Array {
    const p = new Float64Array(this.re.length);
    for (let i = 0; i < p.length; i++) p[i] = this.re[i] ** 2 + this.im[i] ** 2;
    return p;
  }

  clone(): StateVector {
    const copy = new StateVector(this.numQubits);
    copy.re.set(this.re);
    copy.im.set(this.im);
    return copy;
  }

  /** Squared norm of the part of the state where `wire` reads `outcome`. */
  weight(wire: number, outcome: 0 | 1): number {
    const m = this.mask(wire);
    let total = 0;
    for (let i = 0; i < this.re.length; i++) {
      if (!(i & m) === !outcome) total += this.re[i] ** 2 + this.im[i] ** 2;
    }
    return total;
  }

  /** Projects onto `wire` reading `outcome`, without renormalizing. */
  project(wire: number, outcome: 0 | 1) {
    const m = this.mask(wire);
    for (let i = 0; i < this.re.length; i++) {
      if (!(i & m) !== !outcome) this.re[i] = this.im[i] = 0;
    }
  }
}

/**
 * One sequence of mid-circuit measurement outcomes. The state is not
 * renormalized after a measurement, so its squared norm is the probability of
 * the branch.
 */
export interface Branch {
  state: StateVector;
  /** Classical bits as a bit mask (bit k of the number is classical bit k). */
  bits: number;
}

/** Amplitudes kept across all branches before exact simulation gives up. */
const MAX_BRANCH_AMPLITUDES = 1 << 21;
/** Outcomes less likely than this are not followed. */
const NEGLIGIBLE = 1e-14;

/**
 * Runs the circuit, following every outcome of each mid-circuit measurement
 * as its own branch. Measurements that end their wire are left to `simulate`.
 */
export function runBranches(circuit: Circuit): Branch[] {
  const mid = midCircuitMeasurements(circuit);
  let branches: Branch[] = [{ state: new StateVector(circuit.numQubits), bits: 0 }];

  for (const op of orderedOperations(circuit)) {
    if (op.gate === 'MEASURE') {
      if (!mid.has(op.id)) continue;
      const wire = op.targets[0];
      const basis = op.basis ?? 'Z';
      const next: Branch[] = [];
      for (const { state, bits } of branches) {
        toBasis(state, wire, basis);
        const outcomes = ([0, 1] as const).filter((outcome) => state.weight(wire, outcome) > NEGLIGIBLE);
        outcomes.forEach((outcome, i) => {
          const projected = i < outcomes.length - 1 ? state.clone() : state;
          projected.project(wire, outcome);
          fromBasis(projected, wire, basis);
          const stored = op.classicalTarget === undefined ? bits : (bits & ~(1 << op.classicalTarget)) | (outcome << op.classicalTarget);
          next.push({ state: projected, bits: stored });
        });
      }
      if (next.length << circuit.numQubits > MAX_BRANCH_AMPLITUDES) {
        throw new CircuitError([
          {
            level: 'error',
            opId: op.id,
            message: `Too many mid-circuit measurement outcomes to simulate exactly (${next.length} branches of ${circuit.numQubits} qubits)`,
          },
        ]);
      }
      branches = next;
      continue;
    }

    const base = GATES[op.gate].base;
    if (!base) continue;
    const m = base === 'SWAP' ? null : matrix(base, numericParams(op)[0]);
    for (const { state, bits } of branches) {
      if (op.condition && ((bits >> op.condition.bit) & 1) !== op.condition.value) continue;
      if (m) state.apply1(m, op.targets[0], op.controls);
      else state.swap(op.targets[0], op.targets[1], op.controls);
    }
  }
  return branches;
}

export interface SimulationOptions {
  /** Number of samples to draw. Omit or 0 for exact probabilities only. */
  shots?: number;
  /** Seed for reproducible sampling. */
  seed?: number;
}

export interface SimulationResult {
  /** Wires in the result, in bitstring order (left to right). */
  wires: number[];
  bases: Record<number, Basis>;
  /** Exact probabilities keyed by bitstring over `wires`, e.g. `{ "00": 0.5, "11": 0.5 }`. */
  probabilities: Record<string, number>;
  /** Sampled counts keyed by bitstring, when `shots` was given. */
  counts?: Record<string, number>;
  /** <Z> per wire after rotating into its readout basis. */
  expectations: Record<number, number>;
  issues: Issue[];
}

export class CircuitError extends Error {
  constructor(readonly issues: Issue[]) {
    super(issues.filter((i) => i.level === 'error').map((i) => i.message).join('\n'));
  }
}

/**
 * Simulates the circuit. The result is the readout of the wires that end in a
 * measurement, each in the basis of that measurement (X rotates with H, Y with
 * S^dagger then H), or of all wires in the Z basis when none do. Measurements
 * in the middle of the circuit collapse the state, and the probabilities are
 * summed over their outcomes.
 */
export function simulate(circuit: Circuit, opts: SimulationOptions = {}): SimulationResult {
  const issues = validate(circuit, { numeric: true });
  if (hasErrors(issues)) throw new CircuitError(issues);

  const bases = measurementBases(circuit);
  const wires = measuredWires(circuit);
  const marginal = new Float64Array(1 << wires.length);
  for (const { state } of runBranches(circuit)) {
    for (const [wire, basis] of bases) toBasis(state, wire, basis);
    const full = state.probabilities();
    const masks = wires.map((w) => state.mask(w));
    for (let i = 0; i < full.length; i++) {
      if (full[i] === 0) continue;
      let k = 0;
      for (const m of masks) k = (k << 1) | (i & m ? 1 : 0);
      marginal[k] += full[i];
    }
  }

  const label = (k: number) => k.toString(2).padStart(wires.length, '0');
  const probabilities: Record<string, number> = {};
  marginal.forEach((p, k) => (probabilities[label(k)] = p));

  const expectations: Record<number, number> = {};
  wires.forEach((w, idx) => {
    const bit = 1 << (wires.length - 1 - idx);
    let e = 0;
    marginal.forEach((p, k) => (e += k & bit ? -p : p));
    expectations[w] = e;
  });

  let counts: Record<string, number> | undefined;
  if (opts.shots && opts.shots > 0) {
    counts = sample(marginal, opts.shots, opts.seed).reduce<Record<string, number>>((acc, n, k) => {
      if (n > 0) acc[label(k)] = n;
      return acc;
    }, {});
  }

  return { wires, bases: Object.fromEntries(bases), probabilities, counts, expectations, issues };
}

/** mulberry32: small, fast seeded PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(probs: Float64Array, shots: number, seed?: number): number[] {
  const random = seed === undefined ? Math.random : rng(seed);
  const cumulative: number[] = [];
  let total = 0;
  for (const p of probs) cumulative.push((total += p));
  const counts = new Array<number>(probs.length).fill(0);
  for (let s = 0; s < shots; s++) {
    const r = random() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    counts[lo]++;
  }
  return counts;
}
