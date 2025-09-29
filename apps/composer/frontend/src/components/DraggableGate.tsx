import React from 'react';
import { useDrag } from 'react-dnd';
import { GateOperation } from '../types';

interface DraggableGateProps {
  gate: GateOperation;
  children: React.ReactNode;
  onMove: (gateId: string, newX: number, newQubitIndex: number) => void;
}

const DraggableGate: React.FC<DraggableGateProps> = ({ gate, children, onMove }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'placed-gate',
    item: { gate },
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult();
      if (!dropResult) {
        // Handle movement within circuit canvas
        const offset = monitor.getClientOffset();
        const canvasRect = document.querySelector('.canvas-container')?.getBoundingClientRect();
        const canvasContainer = document.querySelector('.canvas-container');

        if (offset && canvasRect && canvasContainer) {
          const scrollY = canvasContainer.scrollTop;
          const rawX = offset.x - canvasRect.left;
          const rawY = offset.y - canvasRect.top + scrollY;

          const qubitSpacing = 80;
          const leftMargin = 100;
          const topMargin = 50;
          const gridSize = 60;

          const qubitIndex = Math.floor((rawY - topMargin + qubitSpacing / 2) / qubitSpacing);
          const gridX = Math.round((rawX - leftMargin) / gridSize) * gridSize + leftMargin;

          onMove(gate.id, gridX, qubitIndex);
        }
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <g ref={drag} style={{ cursor: 'move', opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </g>
  );
};

export default DraggableGate;