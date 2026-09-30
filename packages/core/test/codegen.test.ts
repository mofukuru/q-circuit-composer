import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Circuit, generateCode, midCircuitMeasurements } from '../src';
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

  describe('dynamic circuits', () => {
    // Measure q0 in the X basis into c1, flip q1 when the outcome was 0, and keep using q0.
    const dynamic = () =>
      circuitOf(2, [
        { gate: 'H', targets: [0] },
        { gate: 'MEASURE', targets: [0], basis: 'X', classicalTarget: 1 },
        { gate: 'X', targets: [1], condition: { bit: 1, value: 0 } },
        { gate: 'Z', targets: [0] },
        { gate: 'MEASURE', targets: [1] },
      ]);
    const body = (code: string, from: string, to: string) => {
      const lines = code.split('\n');
      return lines.slice(lines.findIndex((l) => l.startsWith(from)) + 1, lines.findIndex((l) => l.startsWith(to)));
    };

    it('PennyLane uses qml.measure and qml.cond', () => {
      const code = generateCode(dynamic(), 'pennylane').code;
      expect(code).toContain('@qml.qnode(dev, mcm_method="tree-traversal")');
      expect(body(code, 'def circuit', '    return')).toEqual([
        '    qml.Hadamard(wires=0)',
        '    qml.Hadamard(wires=0)',
        '    c1 = qml.measure(0)',
        '    qml.Hadamard(wires=0)',
        '    qml.cond(c1 == 0, qml.PauliX)(wires=1)',
        '    qml.PauliZ(wires=0)',
        '',
      ]);
      expect(code).toContain('return qml.probs(wires=[1])');
    });

    it('PennyLane keeps classical bits clear of free parameters', () => {
      const c = dynamic();
      c.operations[0] = { ...c.operations[0], gate: 'RX', params: ['c1'] };
      expect(generateCode(c, 'pennylane').code).toContain('qml.cond(c1_ == 0, qml.PauliX)(wires=1)');
    });

    it('Qiskit uses if_test and drops the mid-circuit bits from the counts', () => {
      const code = generateCode(dynamic(), 'qiskit').code;
      expect(body(code, 'qc = ', 'counts = ')).toEqual([
        'qc.h(0)',
        'qc.h(0)',
        'qc.measure(0, 1)',
        'qc.h(0)',
        'with qc.if_test((qc.clbits[1], 0)):',
        '    qc.x(1)',
        'qc.z(0)',
        'qc.measure([1], [2])',
        '',
      ]);
      expect(code).toContain('qc = QuantumCircuit(2, 3)');
      expect(code).toContain('counts = marginal_counts(counts, indices=[2])');
    });

    it('OpenQASM gives each mid-circuit bit its own register', () => {
      expect(generateCode(dynamic(), 'qasm').code.split('\n').slice(3)).toEqual([
        'creg c[1];',
        '// One register per mid-circuit result; c is the final readout.',
        'creg c0[1];',
        'creg c1[1];',
        'h q[0];',
        'h q[0];',
        'measure q[0] -> c1[0];',
        'h q[0];',
        'if (c1==0) x q[1];',
        'z q[0];',
        'measure q[1] -> c[0];',
        '',
      ]);
    });

    it('OpenQASM defines gates used under a condition and gives unstored measurements a scratch bit', () => {
      const c = circuitOf(2, [
        { gate: 'MEASURE', targets: [0], classicalTarget: 0 },
        { gate: 'CRX', controls: [0], targets: [1], params: ['0.5'], condition: { bit: 0, value: 1 } },
        { gate: 'MEASURE', targets: [1] },
        { gate: 'H', targets: [1] },
      ]);
      const code = generateCode(c, 'qasm').code;
      expect(code).toContain('gate crx(theta) c, t');
      expect(code).toContain('if (c0==1) crx(0.5) q[0], q[1];');
      expect(code).toContain('measure q[1] -> c1[0];');
    });

    it('Qulacs follows every outcome as a branch', () => {
      const code = generateCode(dynamic(), 'qulacs').code;
      expect(code).toContain('from qulacs.gate import H, P0, P1, X, Z');
      expect(body(code, '    branches = outcomes', '# Qulacs stores')).toEqual([
        '',
        '',
        'apply(H(0))',
        'apply(H(0))',
        'measure(0, 1)',
        'apply(H(0))',
        'apply(X(1), 1, 0)',
        'apply(Z(0))',
        '',
      ]);
    });

    it('LaTeX draws classical bits as wires below the qubits', () => {
      expect(generateCode(dynamic(), 'latex').code.split('\n').slice(1, 5)).toEqual([
        '  \\lstick{$|q_{0}\\rangle$} & \\gate{H} & \\meter{X} \\vcw{3} & \\qw & \\gate{Z} & \\qw & \\qw \\\\',
        '  \\lstick{$|q_{1}\\rangle$} & \\qw & \\qw & \\gate{X} \\vcw{2} & \\qw & \\meter{} \\\\',
        '  \\lstick{$c_{0}$} \\setwiretype{c} & \\cw & \\cw & \\cw & \\cw & \\cw & \\cw \\\\',
        '  \\lstick{$c_{1}$} \\setwiretype{c} & \\cw & \\cw & \\ocontrol{} \\cw & \\cw & \\cw & \\cw',
      ]);
    });

    it('static circuits are unchanged by an unused classical target', () => {
      const plain = circuitOf(1, [{ gate: 'H', targets: [0] }, { gate: 'MEASURE', targets: [0] }]);
      const stored = circuitOf(1, [{ gate: 'H', targets: [0] }, { gate: 'MEASURE', targets: [0], classicalTarget: 0 }]);
      for (const format of ['pennylane', 'qiskit', 'qulacs', 'qasm'] as const) {
        expect(generateCode(stored, format).code, format).toBe(generateCode(plain, format).code);
      }
    });
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
      dynamic: midCircuitMeasurements(circuit as Circuit).size > 0,
      pennylane: generateCode(circuit as Circuit, 'pennylane').code,
      qiskit: generateCode(circuit as Circuit, 'qiskit', { shots: 20000 }).code,
      qulacs: generateCode(circuit as Circuit, 'qulacs').code,
      qasm: generateCode(circuit as Circuit, 'qasm').code,
    }));
    writeFileSync(exportPath!, JSON.stringify(cases, null, 1));
  });
});
