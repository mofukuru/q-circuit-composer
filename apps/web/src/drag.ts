import { createContext } from 'react';
import { addOperation, type Circuit, createOperation, type GateName, moveOperation, setWire } from '@qcc/core';

/** Size of one grid cell and of the wire-label column, in pixels. */
export const CELL = 52;
export const LABEL_WIDTH = 96;

/** What is being dragged. */
export type DragItem =
  | { kind: 'palette'; gate: GateName; customId?: string }
  | { kind: 'op'; id: string; grabWire: number }
  | { kind: 'wire'; id: string; role: 'controls' | 'targets'; index: number };

export interface Cell {
  row: number;
  col: number;
}

export const cellId = ({ row, col }: Cell) => `cell:${row}:${col}`;

/** The circuit after dropping `item` on `cell`, or null if it does not fit. */
export function applyDrop(circuit: Circuit, item: DragItem, { row, col }: Cell): Circuit | null {
  switch (item.kind) {
    case 'palette': {
      const op = createOperation(circuit, item.gate, col, row, { customId: item.customId });
      return op && addOperation(circuit, op);
    }
    case 'op':
      return moveOperation(circuit, item.id, col, row - item.grabWire);
    case 'wire':
      return setWire(circuit, item.id, item.role, item.index, row, col);
  }
}

/** The cell under the pointer during a drag and whether the drop would succeed. */
export const DropPreview = createContext<(Cell & { ok: boolean }) | null>(null);
