'use client';

import { useState } from 'react';
import { useCircuitStore, Gate } from '@/store/circuitStore';
import { Button } from './ui/button';
import { GATE_CONFIGS } from '@/lib/gateConfig';

interface GateConfigModalProps {
  gate: Gate;
  onClose: () => void;
}

export function GateConfigModal({ gate, onClose }: GateConfigModalProps) {
  const { qubits, updateGate, removeGate } = useCircuitStore();
  const [controlQubit, setControlQubit] = useState(gate.controlQubit ?? 0);
  const [controlQubit2, setControlQubit2] = useState(gate.controlQubit2 ?? 1);
  const [param, setParam] = useState(gate.param ?? '\\theta');

  const needsControlQubit = gate.type === 'CNOT' || gate.type === 'SWAP';
  const needsTwoControls = gate.type === 'CCNOT' || gate.type === 'CSWAP';
  const needsParam = gate.type === 'Rx' || gate.type === 'Ry' || gate.type === 'Rz';

  const handleSave = () => {
    const updates: Partial<Gate> = {};
    if (needsControlQubit) {
      updates.controlQubit = controlQubit;
    }
    if (needsTwoControls) {
      updates.controlQubit = controlQubit;
      updates.controlQubit2 = controlQubit2;
    }
    if (needsParam) {
      updates.param = param;
    }
    updateGate(gate.id, updates);
    onClose();
  };

  const handleDelete = () => {
    removeGate(gate.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-purple-700/50 w-96 shadow-2xl shadow-purple-900/50 animate-in zoom-in duration-300">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 text-xl font-bold mb-4">
          Configure {GATE_CONFIGS[gate.type].label} Gate
        </h3>

        <div className="mb-4">
          <label className="text-gray-300 block mb-2">Target Qubit:</label>
          <div className="text-white bg-gray-900 p-2 rounded">q{gate.targetQubit}</div>
        </div>

        {needsControlQubit && (
          <div className="mb-4">
            <label className="text-gray-300 block mb-2">
              {gate.type === 'CNOT' ? 'Control Qubit:' : 'Swap with Qubit:'}
            </label>
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
        )}

        {needsTwoControls && (
          <>
            <div className="mb-4">
              <label className="text-gray-300 block mb-2">Control Qubit 1:</label>
              <select
                value={controlQubit}
                onChange={(e) => setControlQubit(Number(e.target.value))}
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700"
              >
                {Array.from({ length: qubits }, (_, i) => (
                  <option key={i} value={i} disabled={i === gate.targetQubit || i === controlQubit2}>
                    q{i}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-gray-300 block mb-2">Control Qubit 2:</label>
              <select
                value={controlQubit2}
                onChange={(e) => setControlQubit2(Number(e.target.value))}
                className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700"
              >
                {Array.from({ length: qubits }, (_, i) => (
                  <option key={i} value={i} disabled={i === gate.targetQubit || i === controlQubit}>
                    q{i}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {needsParam && (
          <div className="mb-4">
            <label className="text-gray-300 block mb-2">Rotation Angle:</label>
            <input
              type="text"
              value={param}
              onChange={(e) => setParam(e.target.value)}
              placeholder="e.g., \\theta, \\pi/4, 0.5"
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-700"
            />
            <p className="text-gray-500 text-xs mt-1">
              Use LaTeX notation (e.g., \theta, \pi/2)
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
          <Button onClick={handleDelete} variant="destructive" className="flex-1">
            Delete
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
