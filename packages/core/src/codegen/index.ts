import type { Circuit } from '../circuit';
import type { CodeFormat, CodegenOptions, CodegenResult } from './common';
import { generateLatex } from './latex';
import { generatePennyLane } from './pennylane';
import { generateQasm } from './qasm';
import { generateQiskit } from './qiskit';
import { generateQulacs } from './qulacs';

export type { CodeFormat, CodegenOptions, CodegenResult } from './common';

const GENERATORS: Record<CodeFormat, (c: Circuit, o?: CodegenOptions) => CodegenResult> = {
  pennylane: generatePennyLane,
  qiskit: generateQiskit,
  qulacs: generateQulacs,
  qasm: generateQasm,
  latex: generateLatex,
};

export const CODE_FORMATS = Object.keys(GENERATORS) as CodeFormat[];

/**
 * Generates source code for the circuit. Structural errors (overlapping gates,
 * invalid angles) are returned as issues with empty code.
 */
export function generateCode(circuit: Circuit, format: CodeFormat, opts: CodegenOptions = {}): CodegenResult {
  const result = GENERATORS[format](circuit, opts);
  return result.issues.some((i) => i.level === 'error') ? { code: '', issues: result.issues } : result;
}
