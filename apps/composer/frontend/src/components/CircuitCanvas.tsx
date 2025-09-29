import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Beaker, Move } from 'lucide-react';
import { useDrop, useDrag } from 'react-dnd';
import { Stage, Layer, Line, Text, Rect, Circle, Group } from 'react-konva';
import { CircuitState, GateOperation, Gate } from '../types';
import GateParameterModal from './GateParameterModal';
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

  // State for parameter modal
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [pendingGate, setPendingGate] = useState<{
    gate: Gate;
    qubitIndex: number;
    x: number;
  } | null>(null);
  
  // Theme detection
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.body.classList.contains('dark-theme'));
    };
    
    // Initial check
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

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
          // Check if gate requires parameters
          if (item.gate.params > 0) {
            setPendingGate({ gate: item.gate, qubitIndex, x: gridX });
            setShowParameterModal(true);
          } else {
            addGateToCircuit(item.gate, qubitIndex, gridX);
          }
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [circuitState]);

  const addGateToCircuit = useCallback((gate: Gate, qubitIndex: number, x: number, params?: number[]) => {
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

    // Use the shared collision detection function
    const checkCollision = (testX: number) => {
      return checkCollisionAtPosition(testX, wires);
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
      params: params || (gate.params > 0 ? [Math.PI / 2] : undefined),
      position: { x: finalX, y: topMargin + qubitIndex * qubitSpacing },
    };

    const newState = {
      ...currentState,
      operations: [...currentState.operations, newOperation],
    };

    onStateChange(newState);

  }, [onStateChange, gridSize, canvasWidth, leftMargin, topMargin]);

  const handleParameterConfirm = (params: number[]) => {
    if (pendingGate) {
      addGateToCircuit(pendingGate.gate, pendingGate.qubitIndex, pendingGate.x, params);
    }
    setShowParameterModal(false);
    setPendingGate(null);
  };

  const handleParameterCancel = () => {
    setShowParameterModal(false);
    setPendingGate(null);
  };

  const checkCollisionAtPosition = useCallback((testX: number, wires: number[], skipGateId?: string) => {
    const currentState = circuitStateRef.current;
    return currentState.operations.some((op: GateOperation) => {
      if (skipGateId && op.id === skipGateId) return false;
      
      const sameColumn = Math.abs(op.position.x - testX) < 40;
      const wiresOverlap = wires.some(wire => op.wires.includes(wire));
      
      return sameColumn && wiresOverlap;
    });
  }, []);

  const moveGate = useCallback((gateId: string, newX: number, newQubitIndex: number) => {
    const currentState = circuitStateRef.current;
    const gateToMove = currentState.operations.find(op => op.id === gateId);
    if (!gateToMove) return;

    // Check if the new position is valid
    if (newQubitIndex < 0 || newQubitIndex >= currentState.qubits) return;

    let newWires = [newQubitIndex];
    if (gateToMove.wires.length > 1) {
      // Multi-qubit gate
      const targetQubit = newQubitIndex + 1 < currentState.qubits ? newQubitIndex + 1 : newQubitIndex - 1;
      if (targetQubit >= 0 && targetQubit < currentState.qubits) {
        newWires = [newQubitIndex, targetQubit];
      } else {
        return; // Can't place multi-qubit gate here
      }
    }

    // Check for collision at new position
    if (checkCollisionAtPosition(newX, newWires, gateId)) {
      return; // Can't move to occupied position
    }

    const updatedOperations = currentState.operations.map(op => {
      if (op.id === gateId) {
        return {
          ...op,
          wires: newWires,
          position: { x: newX, y: topMargin + newQubitIndex * qubitSpacing }
        };
      }
      return op;
    });

    onStateChange({
      ...currentState,
      operations: updatedOperations
    });
  }, [onStateChange, topMargin, qubitSpacing, checkCollisionAtPosition]);

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

      // Make gates draggable by adding draggable property and onDragEnd
      const handleDragEnd = (e: any) => {
        const newX = Math.round((e.target.x() - leftMargin) / gridSize) * gridSize + leftMargin;
        const newY = e.target.y();
        const newQubitIndex = Math.round((newY - topMargin) / qubitSpacing);
        
        if (newQubitIndex >= 0 && newQubitIndex < circuitState.qubits && newX >= leftMargin) {
          moveGate(operation.id, newX, newQubitIndex);
        } else {
          // Reset position if invalid
          e.target.position({
            x: operation.position.x,
            y: operation.position.y
          });
        }
      };

      // Right-click to delete
      const handleRightClick = (e: any) => {
        e.evt.preventDefault();
        removeGate(operation.id);
      };

      if (isMultiQubit) {
        // Draw connection line for multi-qubit gates
        const controlY = topMargin + operation.wires[0] * qubitSpacing; // Control qubit
        const targetY = topMargin + operation.wires[1] * qubitSpacing;  // Target qubit
        const colors = getThemeColors();

        elements.push(
          <Group
            key={`${operation.id}-group`}
            draggable
            onDragEnd={handleDragEnd}
            onContextMenu={handleRightClick}
          >
            <Line
              points={[x, controlY, x, targetY]}
              stroke={colors.cnotLine}
              strokeWidth={3}
            />
            {/* Control qubit (filled dot) - first wire */}
            <Circle
              x={x}
              y={controlY}
              radius={8}
              fill={colors.cnotControl}
              stroke={colors.cnotControl}
              strokeWidth={2}
            />
            {/* Target qubit (cross in circle for CNOT) - second wire */}
            <Circle
              x={x}
              y={targetY}
              radius={20}
              fill={colors.cnotTargetBg}
              stroke={colors.cnotTargetBorder}
              strokeWidth={3}
            />
            <Line
              points={[x - 12, targetY, x + 12, targetY]}
              stroke={colors.cnotTargetCross}
              strokeWidth={3}
            />
            <Line
              points={[x, targetY - 12, x, targetY + 12]}
              stroke={colors.cnotTargetCross}
              strokeWidth={3}
            />
          </Group>
        );
      } else {
        // Single qubit gate - rectangle with symbol
        const gateSymbol = getGateSymbol(operation.gate);
        const hasParams = operation.params && operation.params.length > 0;

        const colors = getThemeColors();
        
        elements.push(
          <Group
            key={`${operation.id}-group`}
            x={x}
            y={y}
            draggable
            onDragEnd={handleDragEnd}
            onContextMenu={handleRightClick}
          >
            <Rect
              x={-25}
              y={-25}
              width={50}
              height={50}
              fill={colors.gateBg}
              stroke={colors.gateBorder}
              strokeWidth={2}
              cornerRadius={4}
            />
            <Text
              x={-25}
              y={hasParams ? -18 : -10}
              text={gateSymbol}
              fontSize={14}
              fontFamily="Arial, sans-serif"
              fontStyle="bold"
              fill={colors.gateText}
              align="center"
              verticalAlign="middle"
              width={50}
              height={20}
              listening={false}
            />
            {hasParams && (
              <Text
                x={-25}
                y={2}
                text={`(${formatAngle(operation.params![0])})`}
                fontSize={9}
                fontFamily="Arial, sans-serif"
                fill={colors.gateParam}
                align="center"
                verticalAlign="middle"
                width={50}
                height={16}
                listening={false}
              />
            )}
          </Group>
        );
      }

      return elements;
    });
  };

  const formatAngle = (angle: number): string => {
    const pi = Math.PI;
    const tolerance = 0.001;
    
    // Common angle values
    const commonAngles = [
      { value: 0, text: '0' },
      { value: pi / 8, text: 'π/8' },
      { value: pi / 4, text: 'π/4' },
      { value: pi / 2, text: 'π/2' },
      { value: pi, text: 'π' },
      { value: 3 * pi / 2, text: '3π/2' },
      { value: 2 * pi, text: '2π' },
    ];
    
    for (const common of commonAngles) {
      if (Math.abs(angle - common.value) < tolerance) {
        return common.text;
      }
    }
    
    return angle.toFixed(3);
  };

  const getThemeColors = () => {
    if (isDarkMode) {
      return {
        gateBg: '#2d3748',
        gateBorder: '#e2e8f0',
        gateText: '#f7fafc',
        gateParam: '#a0aec0',
        cnotLine: '#fc8181',
        cnotControl: '#f7fafc',
        cnotTargetBg: '#2d3748',
        cnotTargetBorder: '#e2e8f0',
        cnotTargetCross: '#f7fafc',
      };
    } else {
      return {
        gateBg: '#f8f9fa',
        gateBorder: '#2c3e50',
        gateText: '#2c3e50',
        gateParam: '#666',
        cnotLine: '#e74c3c',
        cnotControl: '#2c3e50',
        cnotTargetBg: 'white',
        cnotTargetBorder: '#2c3e50',
        cnotTargetCross: '#2c3e50',
      };
    }
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
      
      {/* Instructions */}
      <div className="circuit-instructions">
        <p>💡 Drag gates to move them • Right-click to delete</p>
      </div>
      
      {/* Parameter Modal */}
      {showParameterModal && pendingGate && (
        <GateParameterModal
          gateName={pendingGate.gate.name}
          currentParams={pendingGate.gate.params > 0 ? [Math.PI / 2] : []}
          onConfirm={handleParameterConfirm}
          onCancel={handleParameterCancel}
        />
      )}
    </div>
  );
};

export default CircuitCanvas;