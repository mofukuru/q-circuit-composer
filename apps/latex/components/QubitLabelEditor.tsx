'use client';

import { useState } from 'react';
import { useCircuitStore } from '@/store/circuitStore';
import { Button } from './ui/button';

interface QubitLabelEditorProps {
  qubitIndex: number;
  currentLabel: string;
}

export function QubitLabelEditor({ qubitIndex, currentLabel }: QubitLabelEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(currentLabel);
  const setQubitLabel = useCircuitStore((state) => state.setQubitLabel);

  const handleSave = () => {
    setQubitLabel(qubitIndex, label);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLabel(currentLabel);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div
        className="w-20 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-mono text-sm flex items-center justify-center font-bold group-hover:scale-110 transition-transform cursor-pointer hover:opacity-70"
        onClick={() => setIsEditing(true)}
        title="Click to edit label"
      >
        {currentLabel}
      </div>
    );
  }

  return (
    <div className="w-20 flex flex-col items-center gap-1 p-1">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-purple-600 text-center"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
      />
      <div className="flex gap-1">
        <button
          onClick={handleSave}
          className="text-[10px] bg-green-600 text-white px-1 rounded hover:bg-green-700"
        >
          ✓
        </button>
        <button
          onClick={handleCancel}
          className="text-[10px] bg-red-600 text-white px-1 rounded hover:bg-red-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
