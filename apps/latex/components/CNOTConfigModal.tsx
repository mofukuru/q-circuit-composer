'use client';

import { useState } from 'react';
import { useCircuitStore, Gate } from '@/store/circuitStore';
import { Button } from './ui/button';

interface CNOTConfigModalProps {
  gate: Gate;
  onClose: () => void;
}

export function CNOTConfigModal({ gate, onClose }: CNOTConfigModalProps) {
  const { qubits, updateGate } = useCircuitStore();
  const [controlQubit, setControlQubit] = useState(gate.controlQubit ?? 0);

  const handleSave = () => {
    updateGate(gate.id, { controlQubit });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-96">
        <h3 className="text-white text-xl font-bold mb-4">Configure CNOT Gate</h3>

        <div className="mb-4">
          <label className="text-gray-300 block mb-2">Target Qubit:</label>
          <div className="text-white bg-gray-900 p-2 rounded">q{gate.targetQubit}</div>
        </div>

        <div className="mb-6">
          <label className="text-gray-300 block mb-2">Control Qubit:</label>
          <select
            value={controlQubit}
            onChange={(e) => setControlQubit(Number(e.target.value))}
            className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700"
          >
            {Array.from({ length: qubits }, (_, i) => (
              <option key={i} value={i} disabled={i === gate.targetQubit}>
                q{i}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
