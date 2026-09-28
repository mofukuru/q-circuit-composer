import { GATES, type GateName } from '@qcc/core';

const ROTATIONS = new Set<GateName>(['RX', 'RY', 'RZ', 'CRX', 'CRY', 'CRZ']);

/** Background/border/text classes for a gate box, by kind of gate. */
export function gateTone(gate: GateName): string {
  const category = GATES[gate].category;
  if (category === 'measure') return 'bg-slate-600 border-slate-700 text-white dark:bg-slate-500 dark:border-slate-400';
  if (category === 'custom') return 'bg-violet-600 border-violet-700 text-white dark:bg-violet-500 dark:border-violet-400';
  if (ROTATIONS.has(gate)) return 'bg-teal-600 border-teal-700 text-white dark:bg-teal-500 dark:border-teal-400';
  if (category === 'multi') return 'bg-indigo-600 border-indigo-700 text-white dark:bg-indigo-500 dark:border-indigo-400';
  return 'bg-sky-600 border-sky-700 text-white dark:bg-sky-500 dark:border-sky-400';
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
