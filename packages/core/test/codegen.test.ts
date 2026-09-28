import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Circuit, generateCode } from '../src';
import reference from './fixtures/reference.json';
import { circuitOf } from './helpers';

const bell = () =>
  circuitOf(2, [
    { gate: 'H', targets: [0] },
    { gate: 'CNOT', controls: [0], targets: [1] },
  ]);

describe('generateCode', () => {
  it('PennyLane', () => {
    expect(generateCode(bell(), 'pennylane', { shots: 100 }).code).toBe(
      [
        'import pennylane as qml',
        'import numpy as np',
        '',
        'dev = qml.device("default.qubit", wires=2)',
        '',
        '@qml.set_shots(100)',
        '@qml.qnode(dev)',
        'def circuit():',
        '    qml.Hadamard(wires=0)',
        '    qml.CNOT(wires=[0, 1])',
        '',
        '    return qml.probs(wires=[0, 1])',
        '',
        '',
        'print(circuit())',
        '',
      ].join('\n'),
    );
  });

  it('OpenQASM', () => {
    const c = circuitOf(2, [
      { gate: 'RX', targets: [1], params: ['3pi/4'] },
      { gate: 'MEASURE', targets: [1], basis: 'Y' },
    ]);
    expect(generateCode(c, 'qasm').code).toBe(
      [
        'OPENQASM 2.0;',
        'include "qelib1.inc";',
        'qreg q[2];',
        'creg c[1];',
        'rx(3*pi/4) q[1];',
        'sdg q[1];',
        'h q[1];',
        'measure q[1] -> c[0];',
        '',
      ].join('\n'),
    );
  });

  it('OpenQASM rejects symbolic angles', () => {
    const r = generateCode(circuitOf(1, [{ gate: 'RZ', targets: [0], params: ['theta'] }]), 'qasm');
    expect(r.code).toBe('');
    expect(r.issues[0].message).toMatch(/theta/);
  });

  it('declares free parameters in Python outputs', () => {
    const c = circuitOf(1, [{ gate: 'RZ', targets: [0], params: ['2\\lambda'] }]);
    const code = generateCode(c, 'qiskit').code;
    expect(code).toContain('lambda_ = 0.0');
    expect(code).toContain('qc.rz(2*lambda_, 0)');
  });

  it('Qulacs builds controlled rotations from matrix gates', () => {
    const c = circuitOf(2, [{ gate: 'CRX', controls: [1], targets: [0], params: ['0.5'] }]);
    const code = generateCode(c, 'qulacs').code;
    expect(code).toContain('from qulacs.gate import RotX, to_matrix_gate');
    expect(code).toContain('circuit.add_gate(controlled(RotX(0, 0.5), 1))');
  });

  it('LaTeX draws the circuit as placed', () => {
    const c: Circuit = {
      ...circuitOf(3, []),
      numColumns: 6,
      customGates: [{ id: 'u', label: 'U_f' }],
      operations: [
        { id: 'a', gate: 'H', column: 0, targets: [0], controls: [], params: [] },
        { id: 'b', gate: 'CNOT', column: 2, targets: [2], controls: [0], params: [] },
        { id: 'c', gate: 'SWAP', column: 3, targets: [1, 2], controls: [], params: [] },
        { id: 'd', gate: 'CUSTOM', column: 4, targets: [0, 1], controls: [], params: [], customId: 'u' },
        { id: 'e', gate: 'RY', column: 4, targets: [2], controls: [], params: ['\\theta/2'] },
        { id: 'f', gate: 'MEASURE', column: 5, targets: [0], controls: [], params: [], basis: 'X' },
      ],
    };
    expect(generateCode(c, 'latex').code).toBe(
      [
        '\\begin{quantikz}',
        '  \\lstick{$|q_{0}\\rangle$} & \\gate{H} & \\ctrl{2} & \\qw & \\gate[2]{U_f} & \\meter{X} \\\\',
        '  \\lstick{$|q_{1}\\rangle$} & \\qw & \\qw & \\swap{1} & \\qw & \\qw & \\qw \\\\',
        '  \\lstick{$|q_{2}\\rangle$} & \\qw & \\targ{} & \\targX{} & \\gate{R_y(\\theta/2)} & \\qw & \\qw',
        '\\end{quantikz}',
        '',
      ].join('\n'),
    );
    expect(generateCode(c, 'pennylane').issues.some((i) => /Custom/.test(i.message))).toBe(true);
  });

  it('LaTeX pads wires on the right and ends measured wires at the meter', () => {
    const c = circuitOf(2, [
      { gate: 'MEASURE', targets: [0] },
      { gate: 'X', targets: [1] },
    ]);
    const lines = generateCode(c, 'latex').code.split('\n');
    expect(lines[1]).toBe('  \\lstick{$|q_{0}\\rangle$} & \\meter{} \\\\');
    expect(lines[2]).toBe('  \\lstick{$|q_{1}\\rangle$} & \\qw & \\gate{X} & \\qw');
  });

  it('LaTeX standalone document compiles as a unit', () => {
    const code = generateCode(bell(), 'latex', { standalone: true }).code;
    expect(code.startsWith('\\documentclass[border=2pt]{standalone}\n\\usepackage{quantikz}')).toBe(true);
    expect(code.trimEnd().endsWith('\\end{document}')).toBe(true);
  });
});

// Writes generated code for every reference case so tools/reference/verify_codegen.py
// can run it with the real frameworks: QCC_EXPORT=path npx vitest run test/codegen.test.ts
const exportPath = process.env.QCC_EXPORT;
describe.runIf(exportPath)('export generated code', () => {
  it('writes cases', () => {
    const cases = reference.cases.map(({ name, circuit, wires, probabilities }) => ({
      name,
      wires,
      probabilities,
      pennylane: generateCode(circuit as Circuit, 'pennylane').code,
      qiskit: generateCode(circuit as Circuit, 'qiskit', { shots: 20000 }).code,
      qulacs: generateCode(circuit as Circuit, 'qulacs').code,
      qasm: generateCode(circuit as Circuit, 'qasm').code,
    }));
    writeFileSync(exportPath!, JSON.stringify(cases, null, 1));
  });
});
