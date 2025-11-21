import { create } from 'zustand';

export type GateType = 'H' | 'X' | 'Y' | 'Z' | 'CNOT' | 'SWAP' | 'MEASURE' | 'Rx' | 'Ry' | 'Rz' | 'CCNOT' | 'CSWAP' | 'CUSTOM';

export interface CustomGateDefinition {
  id: string;
  label: string;
  color: string;
  latexCommand?: string;
}

export interface Gate {
  id: string;
  type: GateType;
  targetQubit: number; // どのワイヤーにあるか
  controlQubit?: number; // CNOTなどの場合の制御ビット
  controlQubit2?: number; // CCNOTなどの場合の第2制御ビット
  param?: string; // 回転ゲートの角度など (例: "\\theta")
  customLabel?: string; // カスタムゲートのラベル
  customGateId?: string; // カスタムゲート定義のID
}

export interface CircuitStep {
  index: number; // タイムステップ (横軸)
  gates: Gate[]; // そのステップに存在するゲート
}

interface CircuitState {
  qubits: number; // 量子ビット数
  steps: number; // ステップ数
  circuit: CircuitStep[]; // 回路情報
  qubitLabels: string[]; // 各量子ビットのカスタムラベル
  customGates: CustomGateDefinition[]; // カスタムゲート定義

  // Actions
  setQubits: (qubits: number) => void;
  setSteps: (steps: number) => void;
  addGate: (gate: Gate, stepIndex: number) => void;
  removeGate: (gateId: string) => void;
  updateGate: (gateId: string, updates: Partial<Gate>) => void;
  clearCircuit: () => void;
  setQubitLabel: (qubitIndex: number, label: string) => void;
  addCustomGate: (gate: CustomGateDefinition) => void;
  removeCustomGate: (gateId: string) => void;
}

export const useCircuitStore = create<CircuitState>((set) => ({
  qubits: 5,
  steps: 10,
  circuit: Array.from({ length: 10 }, (_, i) => ({
    index: i,
    gates: [],
  })),
  qubitLabels: Array.from({ length: 5 }, (_, i) => `|q${i}⟩`),
  customGates: [],

  setQubits: (qubits) =>
    set((state) => {
      const newLabels = Array.from({ length: qubits }, (_, i) =>
        i < state.qubitLabels.length ? state.qubitLabels[i] : `|q${i}⟩`
      );
      return {
        qubits,
        qubitLabels: newLabels,
        circuit: state.circuit.map((step) => ({
          ...step,
          gates: step.gates.filter((gate) => gate.targetQubit < qubits),
        })),
      };
    }),

  setSteps: (steps) =>
    set((state) => {
      const newCircuit = Array.from({ length: steps }, (_, i) => {
        if (i < state.circuit.length) {
          return state.circuit[i];
        }
        return { index: i, gates: [] };
      });
      return { steps, circuit: newCircuit };
    }),

  addGate: (gate, stepIndex) =>
    set((state) => {
      const newCircuit = [...state.circuit];
      if (stepIndex >= 0 && stepIndex < newCircuit.length) {
        // 同じ位置に既にゲートがある場合は削除
        newCircuit[stepIndex] = {
          ...newCircuit[stepIndex],
          gates: [
            ...newCircuit[stepIndex].gates.filter(
              (g) => g.targetQubit !== gate.targetQubit
            ),
            gate,
          ],
        };
      }
      return { circuit: newCircuit };
    }),

  removeGate: (gateId) =>
    set((state) => ({
      circuit: state.circuit.map((step) => ({
        ...step,
        gates: step.gates.filter((gate) => gate.id !== gateId),
      })),
    })),

  updateGate: (gateId, updates) =>
    set((state) => ({
      circuit: state.circuit.map((step) => ({
        ...step,
        gates: step.gates.map((gate) =>
          gate.id === gateId ? { ...gate, ...updates } : gate
        ),
      })),
    })),

  clearCircuit: () =>
    set((state) => ({
      circuit: state.circuit.map((step) => ({
        ...step,
        gates: [],
      })),
    })),

  setQubitLabel: (qubitIndex, label) =>
    set((state) => {
      const newLabels = [...state.qubitLabels];
      newLabels[qubitIndex] = label;
      return { qubitLabels: newLabels };
    }),

  addCustomGate: (gate) =>
    set((state) => ({
      customGates: [...state.customGates, gate],
    })),

  removeCustomGate: (gateId) =>
    set((state) => ({
      customGates: state.customGates.filter((g) => g.id !== gateId),
    })),
}));
