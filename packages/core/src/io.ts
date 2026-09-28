import { type Circuit, defaultQubitLabel, MAX_QUBITS, type Operation } from './circuit';
import { GATES, type GateName } from './gates';

export const FORMAT_VERSION = 1;

interface SavedCircuit extends Circuit {
  version: number;
}

export function serializeCircuit(circuit: Circuit): string {
  const saved: SavedCircuit = { version: FORMAT_VERSION, ...circuit };
  return JSON.stringify(saved);
}

const isIntArray = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => Number.isInteger(x));

/**
 * Parses a circuit from JSON (a saved file or share link). Throws with a
 * readable message when the data is not a circuit.
 */
export function parseCircuit(json: string): Circuit {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON');
  }
  const d = data as Partial<SavedCircuit>;
  if (typeof d !== 'object' || d === null || !Number.isInteger(d.numQubits) || !Array.isArray(d.operations)) {
    throw new Error('The data is not a circuit');
  }
  const numQubits = Math.min(MAX_QUBITS, Math.max(1, d.numQubits!));
  const customGates = Array.isArray(d.customGates)
    ? d.customGates.filter((g) => typeof g?.id === 'string' && typeof g?.label === 'string').map((g) => ({ id: g.id, label: g.label }))
    : [];

  const operations: Operation[] = d.operations.map((raw, i) => {
    const o = raw as Partial<Operation>;
    if (typeof o.gate !== 'string' || !(o.gate in GATES)) throw new Error(`Operation ${i + 1} has an unknown gate`);
    if (!Number.isInteger(o.column) || !isIntArray(o.targets) || !isIntArray(o.controls ?? [])) {
      throw new Error(`Operation ${i + 1} is malformed`);
    }
    const op: Operation = {
      id: typeof o.id === 'string' ? o.id : `op-${i}`,
      gate: o.gate as GateName,
      column: o.column!,
      targets: o.targets,
      controls: o.controls ?? [],
      params: Array.isArray(o.params) ? o.params.map(String) : [],
    };
    if (o.basis === 'X' || o.basis === 'Y' || o.basis === 'Z') op.basis = o.basis;
    if (typeof o.customId === 'string') op.customId = o.customId;
    return op;
  });

  const numColumns = Math.max(Number.isInteger(d.numColumns) ? d.numColumns! : 1, ...operations.map((o) => o.column + 1));
  const labels = Array.isArray(d.qubitLabels) ? d.qubitLabels : [];
  return {
    numQubits,
    numColumns,
    qubitLabels: Array.from({ length: numQubits }, (_, i) => (typeof labels[i] === 'string' ? labels[i] : defaultQubitLabel(i))),
    operations,
    customGates,
  };
}

/** URL-safe base64 of the UTF-8 JSON, for share links. */
export function encodeCircuit(circuit: Circuit): string {
  const bytes = new TextEncoder().encode(serializeCircuit(circuit));
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCircuit(encoded: string): Circuit {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return parseCircuit(new TextDecoder().decode(bytes));
}
