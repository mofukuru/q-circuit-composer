import { CircuitStep, Gate, GateType, CustomGateDefinition } from '@/store/circuitStore';

export function generateLatex(
  circuit: CircuitStep[],
  qubits: number,
  qubitLabels: string[],
  customGates: CustomGateDefinition[]
): string {
  const lines: string[] = [];

  lines.push('\\begin{quantikz}');

  for (let q = 0; q < qubits; q++) {
    const rowElements: string[] = [];

    // 最初の要素としてカスタムラベルを追加
    const label = qubitLabels[q] || `|q${q}⟩`;
    rowElements.push(`\\lstick{${label}}`);

    for (let s = 0; s < circuit.length; s++) {
      const step = circuit[s];
      const gate = step.gates.find((g) => g.targetQubit === q);

      if (!gate) {
        rowElements.push('\\qw');
      } else {
        rowElements.push(getLatexForGate(gate, circuit, q, s, customGates));
      }
    }

    lines.push('& ' + rowElements.join(' & ') + (q < qubits - 1 ? ' \\\\' : ''));
  }

  lines.push('\\end{quantikz}');

  return lines.join('\n');
}

function getLatexForGate(
  gate: Gate,
  circuit: CircuitStep[],
  qubit: number,
  stepIndex: number,
  customGates: CustomGateDefinition[]
): string {
  switch (gate.type) {
    case 'H':
      return '\\gate{H}';
    case 'X':
      return '\\gate{X}';
    case 'Y':
      return '\\gate{Y}';
    case 'Z':
      return '\\gate{Z}';
    case 'MEASURE':
      return '\\meter{}';
    case 'Rx':
      return `\\gate{R_x${gate.param ? `(${gate.param})` : ''}}`;
    case 'Ry':
      return `\\gate{R_y${gate.param ? `(${gate.param})` : ''}}`;
    case 'Rz':
      return `\\gate{R_z${gate.param ? `(${gate.param})` : ''}}`;
    case 'CNOT':
      if (gate.controlQubit !== undefined) {
        const isControl = gate.controlQubit === qubit;
        if (isControl) {
          const offset = gate.targetQubit - gate.controlQubit;
          return `\\ctrl{${offset}}`;
        } else {
          return '\\targ{}';
        }
      }
      return '\\targ{}';
    case 'SWAP':
      if (gate.controlQubit !== undefined) {
        const offset = gate.controlQubit - qubit;
        return `\\swap{${offset}}`;
      }
      return '\\qw';
    case 'CCNOT':
      // Toffoliゲート (2つの制御ビット)
      if (gate.controlQubit !== undefined && gate.controlQubit2 !== undefined) {
        if (qubit === gate.controlQubit) {
          const offset = gate.targetQubit - qubit;
          return `\\ctrl{${offset}}`;
        } else if (qubit === gate.controlQubit2) {
          const offset = gate.targetQubit - qubit;
          return `\\ctrl{${offset}}`;
        } else if (qubit === gate.targetQubit) {
          return '\\targ{}';
        }
      }
      return '\\qw';
    case 'CSWAP':
      // Fredkinゲート (制御されたSWAP)
      if (gate.controlQubit !== undefined && gate.controlQubit2 !== undefined) {
        if (qubit === gate.controlQubit) {
          const offset = gate.targetQubit - qubit;
          return `\\ctrl{${offset}}`;
        } else if (qubit === gate.controlQubit2) {
          const offset = gate.targetQubit - qubit;
          return `\\swap{${offset}}`;
        } else if (qubit === gate.targetQubit) {
          const offset = gate.controlQubit2 - qubit;
          return `\\swap{${offset}}`;
        }
      }
      return '\\qw';
    case 'CUSTOM':
      // カスタムゲート
      if (gate.customGateId) {
        const customGate = customGates.find(g => g.id === gate.customGateId);
        if (customGate) {
          if (customGate.latexCommand) {
            return customGate.latexCommand;
          }
          return `\\gate{${customGate.label}}`;
        }
      }
      if (gate.customLabel) {
        return `\\gate{${gate.customLabel}}`;
      }
      return '\\gate{U}';
    default:
      return '\\qw';
  }
}
