'use client';

import { useState } from 'react';
import { useCircuitStore, CustomGateDefinition } from '@/store/circuitStore';
import { Button } from './ui/button';
import { GatePaletteItem } from './GatePaletteItem';

export function CustomGateManager() {
  const { customGates, addCustomGate, removeCustomGate } = useCircuitStore();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('bg-violet-600');
  const [latexCommand, setLatexCommand] = useState('');

  const handleAdd = () => {
    if (!label.trim()) return;

    const newGate: CustomGateDefinition = {
      id: `custom-${Date.now()}`,
      label: label.trim(),
      color,
      latexCommand: latexCommand.trim() || undefined,
    };

    addCustomGate(newGate);
    setLabel('');
    setLatexCommand('');
    setShowForm(false);
  };

  const colors = [
    'bg-violet-600',
    'bg-fuchsia-600',
    'bg-amber-600',
    'bg-lime-600',
    'bg-emerald-600',
    'bg-sky-600',
  ];

  return (
    <div className="mt-6 border-t border-purple-700/30 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 text-sm font-bold">
          Custom Gates
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          variant="outline"
          className="text-xs bg-purple-900/30 border-purple-600 hover:bg-purple-800"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-gray-900/50 p-3 rounded-lg mb-3 space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Gate Label (e.g., U, QFT)"
            className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-purple-600"
          />
          <input
            type="text"
            value={latexCommand}
            onChange={(e) => setLatexCommand(e.target.value)}
            placeholder="LaTeX Command (optional)"
            className="w-full bg-gray-800 text-white text-sm p-2 rounded border border-purple-600"
          />
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded ${c} ${
                  color === c ? 'ring-2 ring-white' : ''
                }`}
              />
            ))}
          </div>
          <Button onClick={handleAdd} className="w-full" size="sm">
            Create Gate
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {customGates.map((gate) => (
          <div key={gate.id} className="relative group">
            <GatePaletteItem gateType="CUSTOM" customGate={gate} />
            <button
              onClick={() => removeCustomGate(gate.id)}
              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
