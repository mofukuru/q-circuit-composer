import {
  type Basis,
  type Circuit,
  hasErrors,
  type Issue,
  measurementBases,
  measuredWires,
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
}

/** Runs the unitary part of the circuit (measurements are handled by `simulate`). */
export function runCircuit(circuit: Circuit): StateVector {
  const state = new StateVector(circuit.numQubits);
  for (const op of orderedOperations(circuit)) {
    const base = GATES[op.gate].base;
    if (!base) continue;
    if (base === 'SWAP') {
      state.swap(op.targets[0], op.targets[1], op.controls);
    } else {
      state.apply1(matrix(base, numericParams(op)[0]), op.targets[0], op.controls);
    }
  }
  return state;
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
 * Simulates the circuit. MEASURE operations select the readout basis of their
 * wire and are applied at the end of the circuit, like the original PennyLane
 * backend: X basis rotates with H, Y basis with S^dagger then H.
 */
export function simulate(circuit: Circuit, opts: SimulationOptions = {}): SimulationResult {
  const issues = validate(circuit, { numeric: true });
  if (hasErrors(issues)) throw new CircuitError(issues);

  const state = runCircuit(circuit);
  const bases = measurementBases(circuit);
  for (const [wire, basis] of bases) {
    if (basis === 'Y') state.apply1(S_DAG, wire);
    if (basis !== 'Z') state.apply1(matrix('H'), wire);
  }

  const wires = measuredWires(circuit);
  const full = state.probabilities();
  const marginal = new Float64Array(1 << wires.length);
  const masks = wires.map((w) => state.mask(w));
  for (let i = 0; i < full.length; i++) {
    if (full[i] === 0) continue;
    let k = 0;
    for (const m of masks) k = (k << 1) | (i & m ? 1 : 0);
    marginal[k] += full[i];
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
