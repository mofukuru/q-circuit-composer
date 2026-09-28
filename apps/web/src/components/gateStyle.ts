import { GATES, type GateName } from '@qcc/core';

const ROTATIONS = new Set<GateName>(['RX', 'RY', 'RZ', 'CRX', 'CRY', 'CRZ']);

/** Theme classes for a gate box, by kind of gate (colors come from the design tokens in index.css). */
export function gateTone(gate: GateName): string {
  const category = GATES[gate].category;
  if (category === 'measure') return 'gate gate-measure';
  if (category === 'custom') return 'gate gate-custom';
  if (ROTATIONS.has(gate)) return 'gate gate-rotation';
  if (category === 'multi') return 'gate gate-multi';
  return 'gate gate-single';
}

/** Text drawn in the box on a gate's target, e.g. `RX` for CRX. */
export function boxLabel(gate: GateName): string {
  switch (gate) {
    case 'CY':
      return 'Y';
    case 'CRX':
      return 'RX';
    case 'CRY':
      return 'RY';
    case 'CRZ':
      return 'RZ';
    default:
      return GATES[gate].label;
  }
}
