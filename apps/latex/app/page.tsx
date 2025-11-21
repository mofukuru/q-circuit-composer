'use client';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { GatePalette } from '@/components/GatePalette';
import { CircuitCanvas } from '@/components/CircuitCanvas';
import { LatexExportPanel } from '@/components/LatexExportPanel';
import { TrashZone } from '@/components/TrashZone';
import { useCircuitStore, GateType } from '@/store/circuitStore';

export default function Home() {
  const { addGate, removeGate } = useCircuitStore();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // ゴミ箱にドロップした場合
    if (over.id === 'trash-zone') {
      const gate = active.data.current?.gate;
      if (gate) {
        removeGate(gate.id);
      }
      return;
    }

    const gateType = active.data.current?.type as GateType;
    const customGate = active.data.current?.customGate;
    const existingGate = active.data.current?.gate;
    const { qubitIndex, stepIndex } = over.data.current as {
      qubitIndex: number;
      stepIndex: number;
    };

    // 既存のゲートを移動する場合
    if (existingGate) {
      removeGate(existingGate.id);
      const movedGate = {
        ...existingGate,
        id: `${existingGate.type}-${qubitIndex}-${stepIndex}-${Date.now()}`,
        targetQubit: qubitIndex,
      };
      addGate(movedGate, stepIndex);
    }
    // パレットから新しいゲートを配置する場合
    else if (gateType && qubitIndex !== undefined && stepIndex !== undefined) {
      const gate = {
        id: `${gateType}-${qubitIndex}-${stepIndex}-${Date.now()}`,
        type: gateType,
        targetQubit: qubitIndex,
        ...(customGate && {
          customGateId: customGate.id,
          customLabel: customGate.label,
        }),
      };
      addGate(gate, stepIndex);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 border-b border-purple-700/50 p-6 shadow-2xl">
          <h1 className="text-white text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">qcircuit2latex</h1>
          <p className="text-purple-300 text-sm mt-1">Visual Quantum Circuit to LaTeX Generator</p>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <GatePalette />
          <CircuitCanvas />
        </div>
        <LatexExportPanel />
        <TrashZone />
      </div>
    </DndContext>
  );
}
