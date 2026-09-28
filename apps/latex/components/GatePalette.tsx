'use client';

import { GateType } from '@/store/circuitStore';
import { GatePaletteItem } from './GatePaletteItem';
import { CustomGateManager } from './CustomGateManager';

const GATE_TYPES: GateType[] = ['H', 'X', 'Y', 'Z', 'CNOT', 'SWAP', 'CCNOT', 'CSWAP', 'MEASURE', 'Rx', 'Ry', 'Rz'];

export function GatePalette() {
  return (
    <div className="w-64 h-full bg-gradient-to-b from-gray-900 to-gray-950 p-6 border-r border-purple-700/30 shadow-2xl overflow-y-auto">
      <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-xl font-bold mb-6">Gate Palette</h2>
      <div className="grid grid-cols-2 gap-4">
        {GATE_TYPES.map((gateType) => (
          <GatePaletteItem key={gateType} gateType={gateType} />
        ))}
      </div>
      <CustomGateManager />
    </div>
  );
}
