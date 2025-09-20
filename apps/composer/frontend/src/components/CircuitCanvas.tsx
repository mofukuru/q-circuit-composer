import React, { useCallback, useEffect, useRef } from 'react';
import { Beaker, Move } from 'lucide-react';
import { useDrop } from 'react-dnd';
import { Stage, Layer, Line, Text, Rect, Circle } from 'react-konva';
import { CircuitState, GateOperation, Gate } from '../types';
import './CircuitCanvas.css';

interface CircuitCanvasProps {
  circuitState: CircuitState;
  onStateChange: (state: CircuitState) => void;
}

const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  circuitState,
  onStateChange
}) => {
  // Use ref to always get the latest state
  const circuitStateRef = useRef(circuitState);
  circuitStateRef.current = circuitState;

  const qubitSpacing = 80;
  const leftMargin = 100;
  const topMargin = 50;
  const canvasHeight = Math.max(300, circuitState.qubits * qubitSpacing + topMargin + qubitSpacing);
  const gateWidth = 60; // Width of gate including spacing
  const gridSize = 60; // Grid size for gate positioning

  // Calculate the maximum X position of any gate
  const maxGateX = circuitState.operations.reduce(
    (max, op) => (op.position.x > max ? op.position.x : max),
    0
  );

  // Determine canvas width based on gate positions, with padding
  const canvasWidth = Math.max(800, maxGateX + 150);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'gate',
    drop: (item: { gate: Gate }, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = document.querySelector('.canvas-container')?.getBoundingClientRect();
      const canvasContainer = document.querySelector('.canvas-container'); // Added this line

      if (offset && canvasRect && canvasContainer) { // Added canvasContainer to condition
        const scrollY = canvasContainer.scrollTop; // Added this line
        const rawX = offset.x - canvasRect.left;
        const rawY = offset.y - canvasRect.top + scrollY; // Modified this line

        // Adjusted qubitIndex calculation for better accuracy
        const qubitIndex = Math.floor((rawY - topMargin + qubitSpacing / 2) / qubitSpacing);
        const gridX = Math.round((rawX - leftMargin) / gridSize) * gridSize + leftMargin;

        const currentQubits = circuitStateRef.current.qubits;
        if (qubitIndex >= 0 && qubitIndex < currentQubits && gridX >= leftMargin) {
          addGateToCircuit(item.gate, qubitIndex, gridX);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [circuitState]);

  const addGateToCircuit = useCallback((gate: Gate, qubitIndex: number, x: number) => {
    const currentState = circuitStateRef.current;

    let wires: number[] = [qubitIndex];

    // For multi-qubit gates like CNOT, we need to specify target qubit
    if (gate.qubits > 1) {
      const targetQubit = qubitIndex + 1 < currentState.qubits ? qubitIndex + 1 : qubitIndex - 1;
      if (targetQubit >= 0 && targetQubit < currentState.qubits) {
        wires = [qubitIndex, targetQubit];
      } else {
        return;
      }
    }

    // Simplified collision detection - only check exact same position and wire
    const checkCollision = (testX: number) => {
      const collision = currentState.operations.some((op: GateOperation) => {
        const sameColumn = Math.abs(op.position.x - testX) < 30; // Smaller tolerance
        const sameWires = op.wires.length === wires.length &&
                          op.wires.every((wire: number, index: number) => wire === wires[index]);
        const result = sameColumn && sameWires;
        return result;
      });
      return collision;
    };

    // Find available position
    let finalX = x;

    // If there's a collision, try to find next available spot
    if (checkCollision(finalX)) {
      let found = false;

      // Try moving right
      for (let i = 1; i <= 10; i++) {
        const testX = x + (i * gridSize);
        if (!checkCollision(testX) && testX < canvasWidth - 100) {
          finalX = testX;
          found = true;
          break;
        }
      }

      // If right didn't work, try moving left
      if (!found) {
        for (let i = 1; i <= 10; i++) {
          const testX = x - (i * gridSize);
          if (!checkCollision(testX) && testX >= leftMargin) {
            finalX = testX;
            found = true;
            break;
          }
        }
      }

      if (!found) {
      }
    }

    const newOperation: GateOperation = {
      id: `gate_${Date.now()}_${Math.random()}`,
      gate: gate.name,
      wires: wires,
      params: gate.params > 0 ? [Math.PI / 2] : undefined,
      position: { x: finalX, y: topMargin + qubitIndex * qubitSpacing },
    };

    const newState = {
      ...currentState,
      operations: [...currentState.operations, newOperation],
    };

    onStateChange(newState);

  }, [onStateChange, gridSize, canvasWidth, leftMargin, topMargin]);

  const removeGate = useCallback((gateId: string) => {
    onStateChange({
      ...circuitState,
      operations: circuitState.operations.filter(op => op.id !== gateId),
    });
  }, [circuitState, onStateChange]);

  const renderQubitLines = () => {
    const lines = [];

    // Draw qubit lines
    for (let i = 0; i < circuitState.qubits; i++) {
      const y = topMargin + i * qubitSpacing;
      lines.push(
        <Line
          key={`qubit-line-${i}`}
          points={[leftMargin, y, canvasWidth - 50, y]}
          stroke="#333"
          strokeWidth={2}
        />
      );
      lines.push(
        <Text
          key={`qubit-label-${i}`}
          x={20}
          y={y - 10}
          text={`|q${i}⟩`}
          fontSize={16}
          fontFamily="monospace"
          fill="#333"
        />
      );
    }

    // Draw vertical grid lines for gate positioning
    for (let x = leftMargin; x < canvasWidth - 50; x += gridSize) {
      lines.push(
        <Line
          key={`grid-line-${x}`}
          points={[x, topMargin - 20, x, topMargin + (circuitState.qubits - 1) * qubitSpacing + 20]}
          stroke="var(--color-grid-line)" // CSS変数を使用
          strokeWidth={1}
          dash={[2, 4]}
          opacity={0.8} // 視認性向上のため少し上げる
        />
      );
    }

    return lines;
  };

  const renderGates = () => {
    return circuitState.operations.map((operation) => {
      const isMultiQubit = operation.wires.length > 1;
      const primaryWire = operation.wires[0];
      const x = operation.position.x;
      const y = topMargin + primaryWire * qubitSpacing;

      const elements = [];

      if (isMultiQubit) {
        // Draw connection line for multi-qubit gates
        const wire1Y = topMargin + operation.wires[0] * qubitSpacing;
        const wire2Y = topMargin + operation.wires[1] * qubitSpacing;

        elements.push(
          <Line
            key={`${operation.id}-connection`}
            points={[x, wire1Y, x, wire2Y]}
            stroke="#e74c3c"
            strokeWidth={3}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );

        // Control qubit (circle)
        elements.push(
          <Circle
            key={`${operation.id}-control`}
            x={x}
            y={wire1Y}
            radius={8}
            fill="#2c3e50"
            stroke="#2c3e50"
            strokeWidth={2}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );

        // Target qubit (cross in circle for CNOT)
        elements.push(
          <Circle
            key={`${operation.id}-target-circle`} 
            x={x}
            y={wire2Y}
            radius={20}
            fill="white"
            stroke="#2c3e50"
            strokeWidth={3}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );

        elements.push(
          <Line
            key={`${operation.id}-target-cross-1`}
            points={[x - 12, wire2Y, x + 12, wire2Y]}
            stroke="#2c3e50"
            strokeWidth={3}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );

        elements.push(
          <Line
            key={`${operation.id}-target-cross-2`}
            points={[x, wire2Y - 12, x, wire2Y + 12]}
            stroke="#2c3e50"
            strokeWidth={3}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );
      } else {
        // Single qubit gate - rectangle with symbol
        const gateSymbol = getGateSymbol(operation.gate);

        elements.push(
          <Rect
            key={`${operation.id}-rect`}
            x={x - 20}
            y={y - 20}
            width={40}
            height={40}
            fill="#f8f9fa"
            stroke="#2c3e50"
            strokeWidth={2}
            cornerRadius={4}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );

        elements.push(
          <Text
            key={`${operation.id}-text`}
            x={x}
            y={y}
            text={gateSymbol}
            fontSize={14}
            fontFamily="Arial, sans-serif"
            fontStyle="bold"
            fill="#2c3e50"
            align="center"
            verticalAlign="middle"
            offsetX={gateSymbol.length * 3.5}
            offsetY={7}
            onClick={() => removeGate(operation.id)}
            onTap={() => removeGate(operation.id)}
          />
        );
      }

      return elements;
    });
  };

  const getGateSymbol = (gateName: string): string => {
    const symbolMap: { [key: string]: string } = {
      'Hadamard': 'H',
      'PauliX': 'X',
      'PauliY': 'Y',
      'PauliZ': 'Z',
      'RX': 'RX',
      'RY': 'RY',
      'RZ': 'RZ',
      'Phase': 'S',
      'T': 'T',
    };
    return symbolMap[gateName] || gateName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="circuit-canvas">
      <div className="canvas-header">
        <h3><Beaker size={20} /> Quantum Circuit</h3>
        <div className="canvas-info">
          <span>{circuitState.operations.length} gates</span>
          <span>•</span>
          <span>{circuitState.qubits} qubits</span>
        </div>
      </div>

      <div
        ref={drop}
        className={`canvas-container ${isOver ? 'drag-over' : ''}`}
      >
        <Stage width={canvasWidth} height={canvasHeight}>
          <Layer>
            {renderQubitLines()}
            {renderGates()}
          </Layer>
        </Stage>

        {circuitState.operations.length === 0 && (
          <div className="empty-canvas-message">
            <p><Move size={16} /> Drag quantum gates from the palette to build your circuit</p>
            <p className="hint">Click on gates to remove them</p>
          </div>
        )}


      </div>
    </div>
  );
};

export default CircuitCanvas;