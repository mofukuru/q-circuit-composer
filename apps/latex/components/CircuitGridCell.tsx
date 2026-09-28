'use client';

import { useState } from 'react';
import { Gate, useCircuitStore } from '@/store/circuitStore';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GATE_CONFIGS } from '@/lib/gateConfig';
import { GateConfigModal } from './GateConfigModal';

interface CircuitGridCellProps {
  qubitIndex: number;
  stepIndex: number;
  gate?: Gate;
}

export function CircuitGridCell({ qubitIndex, stepIndex, gate }: CircuitGridCellProps) {
  const customGates = useCircuitStore((state) => state.customGates);
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `cell-${qubitIndex}-${stepIndex}`,
    data: { qubitIndex, stepIndex },
  });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: gate ? `gate-${gate.id}` : `empty-${qubitIndex}-${stepIndex}`,
    data: { gate, qubitIndex, stepIndex },
    disabled: !gate,
  });

  const [showConfig, setShowConfig] = useState(false);

  const handleDoubleClick = () => {
    if (gate) {
      setShowConfig(true);
    }
  };

  // カスタムゲートの場合の表示情報を取得
  const getGateDisplay = () => {
    if (gate?.type === 'CUSTOM' && gate.customGateId) {
      const customGate = customGates.find(g => g.id === gate.customGateId);
      if (customGate) {
        return {
          label: customGate.label,
          color: customGate.color,
        };
      }
    }
    return {
      label: gate?.customLabel || GATE_CONFIGS[gate?.type || 'H'].label,
      color: GATE_CONFIGS[gate?.type || 'H'].color,
    };
  };

  const display = gate ? getGateDisplay() : null;

  return (
    <>
      <div
        ref={setDropRef}
        className={`
          w-20 h-20 border flex items-center justify-center
          transition-all duration-300
          ${isOver ? 'bg-purple-900/50 border-purple-500 shadow-lg shadow-purple-500/50' : 'bg-gray-800/50 border-gray-600/30 hover:border-purple-700/50'}
        `}
      >
        {gate && (
          <div
            ref={setDragRef}
            {...listeners}
            {...attributes}
            className={`
              w-14 h-14 rounded-xl flex items-center justify-center
              text-white font-bold cursor-grab active:cursor-grabbing
              ${display?.color}
              hover:scale-110 hover:shadow-2xl transition-all duration-300 relative
              border border-white/20 backdrop-blur-sm
              ${isDragging ? 'opacity-50 scale-95 rotate-6' : 'opacity-100'}
            `}
            onDoubleClick={handleDoubleClick}
            title="Double-click to configure, drag to move or delete"
          >
            <div className="flex flex-col items-center justify-center">
              <span className="text-sm">{display?.label}</span>
              {gate.param && (
                <span className="text-xs mt-0.5 font-normal">
                  ({gate.param})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {showConfig && gate && (
        <GateConfigModal gate={gate} onClose={() => setShowConfig(false)} />
      )}
    </>
  );
}
