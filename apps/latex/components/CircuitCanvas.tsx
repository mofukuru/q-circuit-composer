'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { CircuitGridCell } from './CircuitGridCell';
import { QubitLabelEditor } from './QubitLabelEditor';

export function CircuitCanvas() {
  const { qubits, steps, circuit, qubitLabels } = useCircuitStore();

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900 p-8">
      <div className="inline-block bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-purple-700/20">
        <div className="flex flex-col gap-0">
          {Array.from({ length: qubits }, (_, qubitIndex) => (
            <div key={qubitIndex} className="flex items-center gap-0 group">
              <QubitLabelEditor
                qubitIndex={qubitIndex}
                currentLabel={qubitLabels[qubitIndex]}
              />
              <div className="flex gap-0">
                {Array.from({ length: steps }, (_, stepIndex) => {
                  const gate = circuit[stepIndex]?.gates.find(
                    (g) => g.targetQubit === qubitIndex
                  );
                  return (
                    <CircuitGridCell
                      key={`${qubitIndex}-${stepIndex}`}
                      qubitIndex={qubitIndex}
                      stepIndex={stepIndex}
                      gate={gate}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
