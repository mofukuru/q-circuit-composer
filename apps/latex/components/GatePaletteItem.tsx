'use client';

import { GateType, CustomGateDefinition } from '@/store/circuitStore';
import { useDraggable } from '@dnd-kit/core';
import { GATE_CONFIGS } from '@/lib/gateConfig';

interface GatePaletteItemProps {
  gateType: GateType;
  customGate?: CustomGateDefinition;
}

export function GatePaletteItem({ gateType, customGate }: GatePaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: customGate ? `palette-custom-${customGate.id}` : `palette-${gateType}`,
    data: { type: gateType, customGate },
  });

  const config = customGate
    ? { label: customGate.label, color: customGate.color, description: 'Custom Gate' }
    : GATE_CONFIGS[gateType];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        w-16 h-16 rounded-xl flex items-center justify-center
        text-white font-bold text-lg cursor-grab active:cursor-grabbing
        transition-all duration-300 hover:scale-110 hover:rotate-3 hover:shadow-2xl hover:shadow-purple-500/50
        shadow-lg backdrop-blur-sm border border-white/10
        ${config.color}
        ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
      `}
      title={config.description}
    >
      {config.label}
    </div>
  );
}
