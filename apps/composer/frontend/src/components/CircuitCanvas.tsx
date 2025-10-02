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

  // Helpers for snapping and mapping
  const snapToGridX = useCallback((rawX: number) => {
    return Math.round((rawX - leftMargin) / gridSize) * gridSize + leftMargin;
  }, [leftMargin, gridSize]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const snapToQubitIndex = useCallback((rawY: number) => {
    const maxIdx = circuitStateRef.current.qubits - 1;
    return clamp(Math.round((rawY - topMargin) / qubitSpacing), 0, maxIdx);
  }, [topMargin, qubitSpacing]);

  const yForQubit = useCallback((index: number) => topMargin + index * qubitSpacing, [topMargin, qubitSpacing]);

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
    if (gate.qubits === 2) {
      const targetQubit = qubitIndex + 1 < currentState.qubits ? qubitIndex + 1 : qubitIndex - 1;
      if (targetQubit >= 0 && targetQubit < currentState.qubits) {
        wires = [qubitIndex, targetQubit];
      } else {
        return;
      }
    } else if (gate.qubits === 3) {
      // Toffoli (CCNOT) default placement: try [q, q+1, q+2], else [q-2, q-1, q], else [q-1, q, q+1]
      const N = currentState.qubits;
      const candidates: number[][] = [];
      if (qubitIndex + 2 < N) candidates.push([qubitIndex, qubitIndex + 1, qubitIndex + 2]);
      if (qubitIndex - 2 >= 0) candidates.push([qubitIndex - 2, qubitIndex - 1, qubitIndex]);
      if (qubitIndex - 1 >= 0 && qubitIndex + 1 < N) candidates.push([qubitIndex - 1, qubitIndex, qubitIndex + 1]);
      const chosen = candidates.find(arr => arr.every(w => w >= 0 && w < N));
      if (!chosen) return;
      wires = chosen;
    }

    // Use the shared collision detection function
    const checkCollision = (testX: number) => {
      for (const wire of wires) {
        if (isOccupied(testX, wire)) {
          return true; // Collision detected
        }
      }
      return false; // No collision
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
      targetX: gate.qubits > 1 ? finalX : undefined,
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

  const isOccupied = useCallback((x: number, wire: number, skipGateId?: string): boolean => {
    const currentState = circuitStateRef.current;
    for (const op of currentState.operations) {
      if (skipGateId && op.id === skipGateId) continue;

      // Check single-qubit gates and control part of multi-qubit gates
      if (op.wires.includes(wire) && Math.abs(op.position.x - x) < 40) {
        if (op.gate !== 'CNOT' || op.wires[0] === wire) {
          return true;
        }
      }

      // Check target part of CNOT
      if (op.gate === 'CNOT' && op.targetX !== undefined && op.wires[1] === wire && Math.abs(op.targetX - x) < 40) {
        return true;
      }
    }
    return false;
  }, []);

  const moveGate = useCallback((gateId: string, newX: number, newQubitIndex: number) => {
    const currentState = circuitStateRef.current;
    const gateToMove = currentState.operations.find(op => op.id === gateId);
    if (!gateToMove || gateToMove.gate === 'CNOT') return; // For non-CNOT gates

    if (newQubitIndex < 0 || newQubitIndex >= currentState.qubits) return;

    let newWires = [newQubitIndex];
    if (gateToMove.wires.length > 1) {
      const wireOffset = gateToMove.wires[1] - gateToMove.wires[0];
      const newTargetWire = newQubitIndex + wireOffset;
      if (newTargetWire < 0 || newTargetWire >= currentState.qubits) return;
      newWires = [newQubitIndex, newTargetWire];
    }

    for (const wire of newWires) {
      if (isOccupied(newX, wire, gateId)) {
        return;
      }
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

    onStateChange({ ...currentState, operations: updatedOperations });
  }, [onStateChange, topMargin, qubitSpacing, isOccupied]);

  const moveMultiQubitPart = useCallback((gateId: string, part: 'control' | 'target', newX: number, newQubitIndex: number) => {
    const currentState = circuitStateRef.current;
    const gateToMove = currentState.operations.find(op => op.id === gateId);
    if (!gateToMove || gateToMove.wires.length <= 1) return;

    const controlWire = part === 'control' ? newQubitIndex : gateToMove.wires[0];
    const targetWire = part === 'target' ? newQubitIndex : gateToMove.wires[1];

    if (controlWire === targetWire) return;
    if (controlWire < 0 || controlWire >= currentState.qubits || targetWire < 0 || targetWire >= currentState.qubits) return;

    // Determine the new X positions for both parts
    let finalControlX: number, finalTargetX: number;
    if (gateToMove.gate === 'CNOT') {
        finalControlX = (part === 'control') ? newX : gateToMove.position.x;
        finalTargetX = (part === 'target') ? newX : (gateToMove.targetX ?? gateToMove.position.x);
    } else { // CR gates
        finalControlX = newX;
        finalTargetX = newX;
    }

    // Check for collisions at BOTH new positions; if occupied, try shifting horizontally to nearest free column
    const hasCollision = (testCtrlX: number, testTgtX: number) =>
      isOccupied(testCtrlX, controlWire, gateId) || isOccupied(testTgtX, targetWire, gateId);

    if (hasCollision(finalControlX, finalTargetX)) {
      const prevControlX = gateToMove.position.x;
      const prevTargetX = gateToMove.targetX ?? gateToMove.position.x;
      const deltaForCnot = prevTargetX - prevControlX; // maintain relative delta for CNOT when shifting
      const step = gridSize; // align with grid
      let found = false;
      for (let i = 1; i <= 12; i++) {
        // try right
        let candCtrlX = finalControlX + i * step;
        let candTgtX = finalTargetX + (part === 'control' ? i * step : (part === 'target' ? i * step : 0));
        if (gateToMove.gate === 'CNOT') {
          if (part === 'control') candTgtX = prevTargetX + (candCtrlX - prevControlX);
          else if (part === 'target') candCtrlX = prevControlX + (candTgtX - prevTargetX);
        } else {
          // CR* keep same x for both ends
          candTgtX = candCtrlX;
        }
        if (candCtrlX >= leftMargin && !hasCollision(candCtrlX, candTgtX)) {
          finalControlX = candCtrlX;
          finalTargetX = candTgtX;
          found = true;
          break;
        }
        // try left
        candCtrlX = finalControlX - i * step;
        candTgtX = finalTargetX - i * step;
        if (gateToMove.gate === 'CNOT') {
          if (part === 'control') candTgtX = prevTargetX + (candCtrlX - prevControlX);
          else if (part === 'target') candCtrlX = prevControlX + (candTgtX - prevTargetX);
        } else {
          candTgtX = candCtrlX;
        }
        if (candCtrlX >= leftMargin && !hasCollision(candCtrlX, candTgtX)) {
          finalControlX = candCtrlX;
          finalTargetX = candTgtX;
          found = true;
          break;
        }
      }
      if (!found) return; // no available column, cancel move
    }

    const updatedOperations = currentState.operations.map(op => {
      if (op.id === gateId) {
        return {
            ...op,
            wires: [controlWire, targetWire],
            position: { ...op.position, x: finalControlX, y: topMargin + controlWire * qubitSpacing },
            targetX: finalTargetX,
        };
      }
      return op;
    });

    onStateChange({ ...currentState, operations: updatedOperations });
  }, [onStateChange, topMargin, qubitSpacing, isOccupied]);

  // Move entire multi-qubit gate (both control and target) using snapped X and control wire index
  const moveMultiQubitWhole = useCallback((gateId: string, newX: number, newControlWire: number) => {
    const currentState = circuitStateRef.current;
    const gateToMove = currentState.operations.find(op => op.id === gateId);
    if (!gateToMove || gateToMove.wires.length <= 1) return;

    // Preserve relative wire offset
    const wireOffset = gateToMove.wires[1] - gateToMove.wires[0];
    const newTargetWire = newControlWire + wireOffset;

    if (newTargetWire < 0 || newTargetWire >= currentState.qubits) return;

    // Compute X positions
    const newXClamped = Math.max(leftMargin, newX);
    const prevControlX = gateToMove.position.x;
    const prevTargetX = gateToMove.targetX ?? gateToMove.position.x;
    const deltaX = newXClamped - prevControlX;

    // Base desired positions
    let finalControlX = newXClamped;
    let finalTargetX = gateToMove.gate === 'CNOT' ? prevTargetX + deltaX : newXClamped; // CR* keeps same x

    // If occupied at desired column, try to find nearest available column
    const isColumnFree = (testX: number) => {
      const targetXForTest = gateToMove.gate === 'CNOT' ? (prevTargetX + (testX - prevControlX)) : testX;
      if (isOccupied(testX, newControlWire, gateId)) return false;
      if (isOccupied(targetXForTest, newTargetWire, gateId)) return false;
      return true;
    };

    if (!isColumnFree(finalControlX)) {
      const step = 60; // same as gridSize
      let found = false;
      // search right then left in increasing radius
      for (let i = 1; i <= 12; i++) {
        const rightX = newXClamped + i * step;
        const leftX = newXClamped - i * step;
        if (rightX >= leftMargin && isColumnFree(rightX)) {
          finalControlX = rightX;
          finalTargetX = gateToMove.gate === 'CNOT' ? (prevTargetX + (rightX - prevControlX)) : rightX;
          found = true;
          break;
        }
        if (leftX >= leftMargin && isColumnFree(leftX)) {
          finalControlX = leftX;
          finalTargetX = gateToMove.gate === 'CNOT' ? (prevTargetX + (leftX - prevControlX)) : leftX;
          found = true;
          break;
        }
      }
      if (!found) return; // give up if nowhere to place
    }

    const updatedOperations = currentState.operations.map(op => {
      if (op.id === gateId) {
        return {
          ...op,
          wires: [newControlWire, newTargetWire],
          position: { ...op.position, x: finalControlX, y: yForQubit(newControlWire) },
          targetX: finalTargetX,
        };
      }
      return op;
    });

    onStateChange({ ...currentState, operations: updatedOperations });
  }, [onStateChange, isOccupied, yForQubit]);

  // Move entire Toffoli gate (3-qubit) preserving relative offsets
  const moveToffoliWhole = useCallback((gateId: string, newX: number, newMinWire: number) => {
    const currentState = circuitStateRef.current;
    const gateToMove = currentState.operations.find(op => op.id === gateId);
    if (!gateToMove || gateToMove.wires.length !== 3) return;

    const offsets = gateToMove.wires.map(w => w - Math.min(...gateToMove.wires));
    const newWires = offsets.map(off => newMinWire + off);
    if (newWires.some(w => w < 0 || w >= currentState.qubits)) return;

    const newXClamped = Math.max(leftMargin, newX);
    const isColumnFree = (testX: number) => newWires.every(w => !isOccupied(testX, w, gateId));
    let finalX = newXClamped;
    if (!isColumnFree(finalX)) {
      const step = gridSize;
      let found = false;
      for (let i = 1; i <= 12; i++) {
        const rightX = newXClamped + i * step;
        const leftX = newXClamped - i * step;
        if (rightX >= leftMargin && isColumnFree(rightX)) { finalX = rightX; found = true; break; }
        if (leftX >= leftMargin && isColumnFree(leftX)) { finalX = leftX; found = true; break; }
      }
      if (!found) return;
    }

    const updatedOperations = currentState.operations.map(op => {
      if (op.id === gateId) {
        return {
          ...op,
          wires: newWires,
          position: { ...op.position, x: finalX, y: yForQubit(newWires[0]) },
          targetX: finalX,
        };
      }
      return op;
    });

    onStateChange({ ...currentState, operations: updatedOperations });
  }, [onStateChange, isOccupied, yForQubit]);

  // Move one part of a Toffoli (which: 'c1'|'c2'|'t') vertically; may shift x to avoid collisions
  const moveToffoliPart = useCallback((gateId: string, which: 'c1'|'c2'|'t', newWireIdx: number) => {
    const currentState = circuitStateRef.current;
    const op = currentState.operations.find(o => o.id === gateId);
    if (!op || op.wires.length !== 3) return;
    const maxIdx = currentState.qubits - 1;
    let [c1, c2, t] = op.wires;
    const others = which === 'c1' ? [c2, t] : which === 'c2' ? [c1, t] : [c1, c2];
    let idx = Math.max(0, Math.min(maxIdx, newWireIdx));
    // Keep distinct from others
    const avoid = (i: number) => others.includes(i);
    if (avoid(idx)) {
      if (idx < maxIdx && !avoid(idx + 1)) idx = idx + 1;
      else if (idx > 0 && !avoid(idx - 1)) idx = idx - 1;
      else return; // give up if no space
    }
    if (which === 'c1') c1 = idx; else if (which === 'c2') c2 = idx; else t = idx;

    const newWires = [c1, c2, t];
    // Ensure ordering is preserved by role, not sorted; just distinctness and bounds above
    const testX = op.position.x;
    const occupied = newWires.some(w => isOccupied(testX, w, gateId));
    let finalX = testX;
    if (occupied) {
      const step = gridSize;
      let found = false;
      for (let i = 1; i <= 12; i++) {
        const rightX = testX + i * step;
        const leftX = testX - i * step;
        if (rightX >= leftMargin && newWires.every(w => !isOccupied(rightX, w, gateId))) { finalX = rightX; found = true; break; }
        if (leftX >= leftMargin && newWires.every(w => !isOccupied(leftX, w, gateId))) { finalX = leftX; found = true; break; }
      }
      if (!found) return;
    }

    const updatedOperations = currentState.operations.map(o => {
      if (o.id === gateId) {
        return { ...o, wires: newWires, position: { ...o.position, x: finalX, y: yForQubit(newWires[0]) }, targetX: finalX };
      }
      return o;
    });
    onStateChange({ ...currentState, operations: updatedOperations });
  }, [onStateChange, isOccupied, yForQubit]);

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
        const snappedX = snapToGridX(e.target.x());
        const snappedIdx = snapToQubitIndex(e.target.y());
        if (snappedX >= leftMargin) {
          moveGate(operation.id, snappedX, snappedIdx);
        } else {
          e.target.position({ x: operation.position.x, y: operation.position.y });
        }
        // animate back to normal
        e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
      };

      // Right-click to delete
      const handleRightClick = (e: any) => {
        e.evt.preventDefault();
        removeGate(operation.id);
      };

      const colors = getThemeColors();

  if (operation.gate === 'CNOT') {
        const controlY = topMargin + operation.wires[0] * qubitSpacing;
        const targetY = topMargin + operation.wires[1] * qubitSpacing;
        const controlX = operation.position.x;
        const targetX = operation.targetX ?? controlX;

        const controlId = `ctrl-${operation.id}`;
        const targetId = `tgt-${operation.id}`;
        const lineId = `conn-${operation.id}`;
        elements.push(
          <Group key={`${operation.id}-group`} onContextMenu={handleRightClick}>
            {/* Connection Line */}
            <Line
              points={[controlX, controlY, targetX, targetY]}
              stroke={colors.cnotLine}
              strokeWidth={3}
              listening={false} // Prevent line from interfering with drag
              id={lineId}
            />

            {/* Invisible handle to drag the whole gate (snapped, discrete) */}
            <Rect
              x={Math.min(controlX, targetX) - 15}
              y={Math.min(controlY, targetY)}
              width={30}
              height={Math.max(1, Math.abs(targetY - controlY))}
              fill={'rgba(0,0,0,0.0001)'}
              draggable
              dragBoundFunc={(pos) => {
                const snappedX = Math.max(leftMargin, snapToGridX(pos.x));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                // use min-wire indexing for stable top-left anchoring
                const rawMinIdx = snapToQubitIndex(pos.y);
                const clampedMin = clamp(rawMinIdx, 0, maxIdx - absDelta);
                return { x: snappedX - 15, y: yForQubit(clampedMin) };
              }}
              onDragStart={(e) => e.target.to({ scaleX: 1.03, scaleY: 1.03, shadowBlur: 8, shadowColor: 'black', shadowOpacity: 0.2, duration: 0.08 })}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const ctrlDot = stage.findOne(`#ctrl-dot-${operation.id}`) as any;
                const tgtCircle = stage.findOne(`#tgt-circle-${operation.id}`) as any;
                const snappedX = Math.max(leftMargin, snapToGridX(e.target.x() + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta; // recover control index from min
                const ctrlY2 = yForQubit(ctrlIdx);
                const tgtY2 = yForQubit(ctrlIdx + delta);
                if (ctrlNode) ctrlNode.position({ x: snappedX, y: ctrlY2 });
                if (tgtNode) tgtNode.position({ x: snappedX, y: tgtY2 });
                if (lineNode) lineNode.points([snappedX, ctrlY2, snappedX, tgtY2]);
                // Resize/position the handle to always span the current segment
                e.target.position({ x: snappedX - 15, y: Math.min(ctrlY2, tgtY2) });
                e.target.size({ width: 30, height: Math.max(1, Math.abs(tgtY2 - ctrlY2)) });
                // Prevent visual overlap while dragging the whole gate
                const overlapThreshold = 18;
                const overlap = Math.abs(ctrlY2 - tgtY2) < overlapThreshold;
                if (ctrlDot) ctrlDot.x(overlap ? -8 : 0);
                if (tgtCircle) tgtCircle.x(overlap ? 8 : 0);
              }}
              onDragEnd={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const newControlWire = delta >= 0 ? minIdx : minIdx - delta;
                moveMultiQubitWhole(operation.id, snappedX, newControlWire);
                // Reset visual offsets
                const stage = e.target.getStage();
                const ctrlDot = stage?.findOne(`#ctrl-dot-${operation.id}`) as any;
                const tgtCircle = stage?.findOne(`#tgt-circle-${operation.id}`) as any;
                if (ctrlDot) ctrlDot.x(0);
                if (tgtCircle) tgtCircle.x(0);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            />
            
            {/* Control Part (Draggable) */}
            <Group
              id={controlId}
              x={controlX}
              y={controlY}
              draggable
              dragBoundFunc={(pos) => {
                // Do not allow overlap during drag: avoid snapping to same wire as target
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: controlX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const ctrlDot = stage.findOne(`#ctrl-dot-${operation.id}`) as any;
                const ctrlYCur = e.target.y();
                const tgtYCur = tgtNode ? tgtNode.y() : targetY;
                if (lineNode) {
                  lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
                }
                // If visually overlapping vertically (within threshold), nudge control dot left
                const overlapThreshold = 18; // px
                if (ctrlDot) ctrlDot.x(Math.abs(ctrlYCur - tgtYCur) < overlapThreshold ? -8 : 0);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'control', controlX, idx);
                // Reset visual offset
                const stage = e.target.getStage();
                const ctrlDot = stage?.findOne(`#ctrl-dot-${operation.id}`) as any;
                if (ctrlDot) ctrlDot.x(0);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle
                id={`ctrl-dot-${operation.id}`}
                radius={8}
                fill={colors.cnotControl}
                stroke={colors.cnotControl}
                strokeWidth={2}
              />
            </Group>
            
            {/* Target Part (Draggable) */}
            <Group
              id={targetId}
              x={targetX}
              y={targetY}
              draggable
              dragBoundFunc={(pos) => {
                // Do not allow overlap during drag: avoid snapping to same wire as control
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: targetX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtCircle = stage.findOne(`#tgt-circle-${operation.id}`) as any;
                const tgtYCur = e.target.y();
                const ctrlYCur = ctrlNode ? ctrlNode.y() : controlY;
                if (lineNode) {
                  lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
                }
                // If visually overlapping vertically (within threshold), nudge target circle right
                const overlapThreshold = 18; // px
                if (tgtCircle) tgtCircle.x(Math.abs(ctrlYCur - tgtYCur) < overlapThreshold ? 8 : 0);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'target', targetX, idx);
                // Reset visual offset
                const stage = e.target.getStage();
                const tgtCircle = stage?.findOne(`#tgt-circle-${operation.id}`) as any;
                if (tgtCircle) tgtCircle.x(0);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle
                id={`tgt-circle-${operation.id}`}
                radius={20}
                fill={colors.cnotTargetBg}
                stroke={colors.cnotTargetBorder}
                strokeWidth={3}
              />
              <Line
                points={[-12, 0, 12, 0]}
                stroke={colors.cnotTargetCross}
                strokeWidth={3}
              />
              <Line
                points={[0, -12, 0, 12]}
                stroke={colors.cnotTargetCross}
                strokeWidth={3}
              />
            </Group>
          </Group>
        );
  } else if (operation.gate === 'Controlled-Z' || operation.gate === 'CZ') {
        // CZ gate: two black dots connected by a line; both ends draggable like CNOT, but X stays the same for both
        const controlY = topMargin + operation.wires[0] * qubitSpacing;
        const targetY = topMargin + operation.wires[1] * qubitSpacing;
        const controlX = operation.position.x;
        const targetX = operation.targetX ?? controlX;

        const controlId = `ctrl-${operation.id}`;
        const targetId = `tgt-${operation.id}`;
        const lineId = `conn-${operation.id}`;

        elements.push(
          <Group key={`${operation.id}-group`} onContextMenu={handleRightClick}>
            {/* Connection Line */}
            <Line
              points={[controlX, controlY, targetX, targetY]}
              stroke={colors.cnotLine}
              strokeWidth={3}
              listening={false}
              id={lineId}
            />

            {/* Whole-gate handle */}
            <Rect
              x={Math.min(controlX, targetX) - 15}
              y={Math.min(controlY, targetY)}
              width={30}
              height={Math.max(1, Math.abs(targetY - controlY))}
              fill={'rgba(0,0,0,0.0001)'}
              draggable
              dragBoundFunc={(pos) => {
                const snappedX = Math.max(leftMargin, snapToGridX(pos.x));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(pos.y);
                const clampedMin = clamp(rawMinIdx, 0, maxIdx - absDelta);
                return { x: snappedX - 15, y: yForQubit(clampedMin) };
              }}
              onDragStart={(e) => e.target.to({ scaleX: 1.03, scaleY: 1.03, shadowBlur: 8, shadowColor: 'black', shadowOpacity: 0.2, duration: 0.08 })}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                const ctrlY2 = yForQubit(ctrlIdx);
                const tgtY2 = yForQubit(ctrlIdx + delta);
                if (ctrlNode) ctrlNode.position({ x: snappedX, y: ctrlY2 });
                if (tgtNode) tgtNode.position({ x: snappedX, y: tgtY2 });
                if (lineNode) lineNode.points([snappedX, ctrlY2, snappedX, tgtY2]);
                e.target.position({ x: snappedX - 15, y: Math.min(ctrlY2, tgtY2) });
                e.target.size({ width: 30, height: Math.max(1, Math.abs(tgtY2 - ctrlY2)) });
              }}
              onDragEnd={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                moveMultiQubitWhole(operation.id, snappedX, ctrlIdx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            />

            {/* Endpoint dots */}
            <Group
              id={controlId}
              x={controlX}
              y={controlY}
              draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: controlX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const ctrlYCur = e.target.y();
                const tgtYCur = tgtNode ? tgtNode.y() : targetY;
                if (lineNode) lineNode.points([controlX, ctrlYCur, controlX, tgtYCur]);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'control', controlX, idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle radius={8} fill={'#000'} stroke={'#000'} strokeWidth={2} />
            </Group>

            <Group
              id={targetId}
              x={targetX}
              y={targetY}
              draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: targetX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtYCur = e.target.y();
                const ctrlYCur = ctrlNode ? ctrlNode.y() : controlY;
                if (lineNode) lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'target', targetX, idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle radius={8} fill={'#000'} stroke={'#000'} strokeWidth={2} />
            </Group>
          </Group>
        );
      } else if (operation.gate === 'SWAP') {
        // SWAP gate: draw X marks at both ends, connected by a line; both ends draggable like CNOT
        const controlY = topMargin + operation.wires[0] * qubitSpacing;
        const targetY = topMargin + operation.wires[1] * qubitSpacing;
        const controlX = operation.position.x;
        const targetX = operation.targetX ?? controlX;

        const controlId = `ctrl-${operation.id}`;
        const targetId = `tgt-${operation.id}`;
        const lineId = `conn-${operation.id}`;

        const XMark = ({ idPrefix = '' }: { idPrefix?: string }) => (
          <Group>
            <Line points={[-12, -12, 12, 12]} stroke={colors.cnotTargetCross} strokeWidth={3} />
            <Line points={[-12, 12, 12, -12]} stroke={colors.cnotTargetCross} strokeWidth={3} />
          </Group>
        );

        elements.push(
          <Group key={`${operation.id}-group`} onContextMenu={handleRightClick}>
            <Line
              points={[controlX, controlY, targetX, targetY]}
              stroke={colors.cnotLine}
              strokeWidth={3}
              listening={false}
              id={lineId}
            />

            {/* Whole-gate handle */}
            <Rect
              x={Math.min(controlX, targetX) - 15}
              y={Math.min(controlY, targetY)}
              width={30}
              height={Math.max(1, Math.abs(targetY - controlY))}
              fill={'rgba(0,0,0,0.0001)'}
              draggable
              dragBoundFunc={(pos) => {
                const snappedX = Math.max(leftMargin, snapToGridX(pos.x));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(pos.y);
                const clampedMin = clamp(rawMinIdx, 0, maxIdx - absDelta);
                return { x: snappedX - 15, y: yForQubit(clampedMin) };
              }}
              onDragStart={(e) => e.target.to({ scaleX: 1.03, scaleY: 1.03, shadowBlur: 8, shadowColor: 'black', shadowOpacity: 0.2, duration: 0.08 })}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                const ctrlY2 = yForQubit(ctrlIdx);
                const tgtY2 = yForQubit(ctrlIdx + delta);
                if (ctrlNode) ctrlNode.position({ x: snappedX, y: ctrlY2 });
                if (tgtNode) tgtNode.position({ x: snappedX, y: tgtY2 });
                if (lineNode) lineNode.points([snappedX, ctrlY2, snappedX, tgtY2]);
                e.target.position({ x: snappedX - 15, y: Math.min(ctrlY2, tgtY2) });
                e.target.size({ width: 30, height: Math.max(1, Math.abs(tgtY2 - ctrlY2)) });
              }}
              onDragEnd={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                moveMultiQubitWhole(operation.id, snappedX, ctrlIdx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            />

            {/* Control X */}
            <Group
              id={controlId}
              x={controlX}
              y={controlY}
              draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: controlX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const ctrlYCur = e.target.y();
                const tgtYCur = tgtNode ? tgtNode.y() : targetY;
                if (lineNode) lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'control', controlX, idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <XMark />
            </Group>

            {/* Target X */}
            <Group
              id={targetId}
              x={targetX}
              y={targetY}
              draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: targetX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtYCur = e.target.y();
                const ctrlYCur = ctrlNode ? ctrlNode.y() : controlY;
                if (lineNode) lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'target', targetX, idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <XMark />
            </Group>
          </Group>
        );
  } else if (operation.gate === 'Toffoli' || operation.gate === 'CCNOT') {
        // Toffoli (CCNOT): two control dots and a target plus, same X for all
        // Assume wires are ordered as [control1, control2, target]
        const x = operation.position.x;
        const w1 = operation.wires[0];
        const w2 = operation.wires[1];
        const wt = operation.wires[2];
        const y1 = yForQubit(w1);
        const y2 = yForQubit(w2);
        const yt = yForQubit(wt);
        const minY = Math.min(y1, y2, yt);
        const maxY = Math.max(y1, y2, yt);
  const groupId = `${operation.id}-toffoli`;
  const lineId = `line-${groupId}`;
  const c1Id = `tof-c1-${operation.id}`;
  const c2Id = `tof-c2-${operation.id}`;
  const tId = `tof-t-${operation.id}`;

        elements.push(
          <Group key={`${operation.id}-group`} onContextMenu={handleRightClick}>
            {/* Vertical connection */}
            <Line id={lineId} points={[x, minY, x, maxY]} stroke={colors.cnotLine} strokeWidth={3} listening={false} />

            {/* Whole-gate drag handle */}
            <Rect
              x={x - 15}
              y={minY}
              width={30}
              height={Math.max(1, maxY - minY)}
              fill={'rgba(0,0,0,0.0001)'}
              draggable
              dragBoundFunc={(pos) => {
                const snappedX = Math.max(leftMargin, snapToGridX(pos.x));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const sorted = [...operation.wires].sort((a, b) => a - b);
                const span = sorted[sorted.length - 1] - sorted[0];
                const rawMin = snapToQubitIndex(pos.y);
                const clampedMin = clamp(rawMin, 0, maxIdx - span);
                return { x: snappedX - 15, y: yForQubit(clampedMin) };
              }}
              onDragStart={(e) => e.target.to({ scaleX: 1.03, scaleY: 1.03, shadowBlur: 8, shadowColor: 'black', shadowOpacity: 0.2, duration: 0.08 })}
              onDragMove={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const sorted = [...operation.wires].sort((a, b) => a - b);
                const span = sorted[sorted.length - 1] - sorted[0];
                const rawMin = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMin, 0, maxIdx - span);
                const ys = sorted.map((_, i) => yForQubit(minIdx + (sorted[i] - sorted[0])));
                // Update line and handle position, plus endpoints
                const stage = e.target.getStage();
                const lineNode = stage?.findOne(`#${lineId}`) as any;
                const c1Node = stage?.findOne(`#${c1Id}`) as any;
                const c2Node = stage?.findOne(`#${c2Id}`) as any;
                const tNode = stage?.findOne(`#${tId}`) as any;
                if (lineNode) lineNode.points([snappedX, Math.min(...ys), snappedX, Math.max(...ys)]);
                if (c1Node) c1Node.position({ x: snappedX, y: ys[operation.wires.indexOf(Math.min(...operation.wires))] });
                if (c2Node) c2Node.position({ x: snappedX, y: ys[operation.wires.indexOf(operation.wires.sort((a,b)=>a-b)[1])] });
                if (tNode) tNode.position({ x: snappedX, y: ys[operation.wires.indexOf(Math.max(...operation.wires))] });
                e.target.position({ x: snappedX - 15, y: Math.min(...ys) });
                e.target.size({ width: 30, height: Math.max(1, Math.max(...ys) - Math.min(...ys)) });
              }}
              onDragEnd={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const sorted = [...operation.wires].sort((a, b) => a - b);
                const span = sorted[sorted.length - 1] - sorted[0];
                const rawMin = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMin, 0, maxIdx - span);
                // Move whole Toffoli by min wire index
                moveToffoliWhole(operation.id, snappedX, minIdx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            />

            {/* Control dots (black) */}
            <Group id={c1Id} x={x} y={y1} draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                return { x, y: yForQubit(idx) };
              }}
              onDragMove={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                const stage = e.target.getStage();
                const lineNode = stage?.findOne(`#${lineId}`) as any;
                const c2Node = stage?.findOne(`#${c2Id}`) as any;
                const tNode = stage?.findOne(`#${tId}`) as any;
                const y1n = yForQubit(idx);
                const y2n = c2Node ? c2Node.y() : y2;
                const ytn = tNode ? tNode.y() : yt;
                if (lineNode) lineNode.points([x, Math.min(y1n, y2n, ytn), x, Math.max(y1n, y2n, ytn)]);
              }}
              onDragEnd={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                moveToffoliPart(operation.id, 'c1', idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle radius={8} fill={'#000'} stroke={'#000'} strokeWidth={2} />
            </Group>

            <Group id={c2Id} x={x} y={y2} draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                return { x, y: yForQubit(idx) };
              }}
              onDragMove={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                const stage = e.target.getStage();
                const lineNode = stage?.findOne(`#${lineId}`) as any;
                const c1Node = stage?.findOne(`#${c1Id}`) as any;
                const tNode = stage?.findOne(`#${tId}`) as any;
                const y2n = yForQubit(idx);
                const y1n = c1Node ? c1Node.y() : y1;
                const ytn = tNode ? tNode.y() : yt;
                if (lineNode) lineNode.points([x, Math.min(y1n, y2n, ytn), x, Math.max(y1n, y2n, ytn)]);
              }}
              onDragEnd={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                moveToffoliPart(operation.id, 'c2', idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle radius={8} fill={'#000'} stroke={'#000'} strokeWidth={2} />
            </Group>

            {/* Target plus circle */}
            <Group id={tId} x={x} y={yt} draggable
              dragBoundFunc={(pos) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                return { x, y: yForQubit(idx) };
              }}
              onDragMove={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                const stage = e.target.getStage();
                const lineNode = stage?.findOne(`#${lineId}`) as any;
                const c1Node = stage?.findOne(`#${c1Id}`) as any;
                const c2Node = stage?.findOne(`#${c2Id}`) as any;
                const ytn = yForQubit(idx);
                const y1n = c1Node ? c1Node.y() : y1;
                const y2n = c2Node ? c2Node.y() : y2;
                if (lineNode) lineNode.points([x, Math.min(y1n, y2n, ytn), x, Math.max(y1n, y2n, ytn)]);
              }}
              onDragEnd={(e) => {
                const idx = snapToQubitIndex(e.target.y());
                moveToffoliPart(operation.id, 't', idx);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle radius={20} fill={colors.cnotTargetBg} stroke={colors.cnotTargetBorder} strokeWidth={3} />
              <Line points={[-12, 0, 12, 0]} stroke={colors.cnotTargetCross} strokeWidth={3} />
              <Line points={[0, -12, 0, 12]} stroke={colors.cnotTargetCross} strokeWidth={3} />
            </Group>
          </Group>
        );
      } else if (isMultiQubit) { // For Controlled rotation gates (CRX/CRY/CRZ)
        const controlY = topMargin + operation.wires[0] * qubitSpacing;
        const targetY = topMargin + operation.wires[1] * qubitSpacing;
        const controlX = operation.position.x;
        const targetX = operation.targetX ?? controlX; // For CR gates, this will be same as controlX after move
        const gateSymbol = getGateSymbol(operation.gate);
        const hasParams = operation.params && operation.params.length > 0;

        const controlId = `ctrl-${operation.id}`;
        const targetId = `tgt-${operation.id}`;
        const lineId = `conn-${operation.id}`;

        elements.push(
          <Group key={`${operation.id}-group`} onContextMenu={handleRightClick}>
            {/* Connection Line */}
            <Line
              points={[controlX, controlY, targetX, targetY]}
              stroke={colors.cnotLine}
              strokeWidth={3}
              listening={false}
              id={lineId}
            />
            {/* Invisible handle to drag the whole gate (snapped, discrete) */}
            <Rect
              x={Math.min(controlX, targetX) - 15}
              y={Math.min(controlY, targetY)}
              width={36}
              height={Math.max(1, Math.abs(targetY - controlY))}
              fill={'rgba(0,0,0,0.0001)'}
              draggable
              dragBoundFunc={(pos) => {
                const snappedX = Math.max(leftMargin, snapToGridX(pos.x));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(pos.y);
                const clampedMin = clamp(rawMinIdx, 0, maxIdx - absDelta);
                return { x: snappedX - 15, y: yForQubit(clampedMin) };
              }}
              onDragStart={(e) => e.target.to({ scaleX: 1.03, scaleY: 1.03, shadowBlur: 8, shadowColor: 'black', shadowOpacity: 0.2, duration: 0.08 })}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                // Clamp control index so the lower endpoint stays within bounds
                const absDelta = Math.abs(delta);
                const minIdx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                const ctrlY2 = yForQubit(ctrlIdx);
                const tgtY2 = yForQubit(ctrlIdx + delta);
                if (ctrlNode) ctrlNode.position({ x: snappedX, y: ctrlY2 });
                if (tgtNode) tgtNode.position({ x: snappedX, y: tgtY2 });
                if (lineNode) lineNode.points([snappedX, ctrlY2, snappedX, tgtY2]);
                // Resize/position the handle to always span the current segment
                e.target.position({ x: snappedX - 15, y: Math.min(ctrlY2, tgtY2) });
                e.target.size({ width: 30, height: Math.max(1, Math.abs(tgtY2 - ctrlY2)) });
                // Prevent visual overlap while dragging the whole gate (CR)
                const stage2 = e.target.getStage();
                const tgtRect = stage2?.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage2?.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage2?.findOne(`#cr-tgt-param-${operation.id}`) as any;
                const ctrlDot = stage2?.findOne(`#ctrl-dot-${operation.id}`) as any;
                const threshold = 18;
                const dx = Math.abs(ctrlY2 - tgtY2) < threshold ? 8 : 0;
                if (tgtRect) tgtRect.x(-25 + dx);
                if (tgtText) tgtText.x(-25 + dx);
                if (tgtParam) tgtParam.x(-25 + dx);
                if (ctrlDot) ctrlDot.x(dx ? -8 : 0);
              }}
              onDragEnd={(e) => {
                const snappedX = Math.max(leftMargin, snapToGridX((e.target.x() ?? 0) + 15));
                const maxIdx = circuitStateRef.current.qubits - 1;
                const delta = operation.wires[1] - operation.wires[0];
                const absDelta = Math.abs(delta);
                const rawMinIdx = snapToQubitIndex(e.target.y());
                const minIdx = clamp(rawMinIdx, 0, maxIdx - absDelta);
                const ctrlIdx = delta >= 0 ? minIdx : minIdx - delta;
                moveMultiQubitWhole(operation.id, snappedX, ctrlIdx);
                // Reset visual offsets
                const stage2 = e.target.getStage();
                const tgtRect = stage2?.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage2?.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage2?.findOne(`#cr-tgt-param-${operation.id}`) as any;
                const ctrlDot = stage2?.findOne(`#ctrl-dot-${operation.id}`) as any;
                if (tgtRect) tgtRect.x(-25);
                if (tgtText) tgtText.x(-25);
                if (tgtParam) tgtParam.x(-25);
                if (ctrlDot) ctrlDot.x(0);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            />
            {/* Control Part (Draggable) */}
            <Group
              id={controlId}
              x={controlX}
              y={controlY}
              draggable
              dragBoundFunc={(pos) => {
                // Do not allow overlap during drag: avoid snapping to same wire as target
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: controlX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const tgtNode = stage.findOne(`#${targetId}`) as any;
                const tgtRect = stage.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage.findOne(`#cr-tgt-param-${operation.id}`) as any;
                const ctrlDot = stage.findOne(`#ctrl-dot-${operation.id}`) as any;
                const ctrlYCur = e.target.y();
                const tgtYCur = tgtNode ? tgtNode.y() : targetY;
                if (lineNode) {
                  lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
                }
                // Prevent visual overlap while dragging control (CR)
                const threshold = 18;
                const dx = Math.abs(ctrlYCur - tgtYCur) < threshold ? 8 : 0;
                if (tgtRect) tgtRect.x(-25 + dx);
                if (tgtText) tgtText.x(-25 + dx);
                if (tgtParam) tgtParam.x(-25 + dx);
                if (ctrlDot) ctrlDot.x(dx ? -8 : 0);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[1];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'control', controlX, idx);
                // Reset visual offsets
                const stage2 = e.target.getStage();
                const tgtRect = stage2?.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage2?.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage2?.findOne(`#cr-tgt-param-${operation.id}`) as any;
                const ctrlDot = stage2?.findOne(`#ctrl-dot-${operation.id}`) as any;
                if (tgtRect) tgtRect.x(-25);
                if (tgtText) tgtText.x(-25);
                if (tgtParam) tgtParam.x(-25);
                if (ctrlDot) ctrlDot.x(0);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              <Circle
                id={`ctrl-dot-${operation.id}`}
                radius={8}
                fill={colors.cnotControl}
                stroke={colors.cnotControl}
                strokeWidth={2}
              />
            </Group>
            
            {/* Target Part (Draggable) */}
            <Group
              id={targetId}
              x={targetX}
              y={targetY}
              draggable
              dragBoundFunc={(pos) => {
                // Do not allow overlap during drag: avoid snapping to same wire as control
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(pos.y), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = pos.y - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                return { x: targetX, y: yForQubit(idx) };
              }}
              onDragStart={(e) => {
                e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
                e.target.moveToTop();
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (!stage) return;
                const lineNode = stage.findOne(`#${lineId}`) as any;
                const ctrlNode = stage.findOne(`#${controlId}`) as any;
                const tgtRect = stage.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage.findOne(`#cr-tgt-param-${operation.id}`) as any;
                const tgtYCur = e.target.y();
                const ctrlYCur = ctrlNode ? ctrlNode.y() : controlY;
                if (lineNode) {
                  lineNode.points([controlX, ctrlYCur, targetX, tgtYCur]);
                }
                const threshold = 18;
                const dx = Math.abs(ctrlYCur - tgtYCur) < threshold ? 8 : 0;
                if (tgtRect) tgtRect.x(-25 + dx);
                if (tgtText) tgtText.x(-25 + dx);
                if (tgtParam) tgtParam.x(-25 + dx);
              }}
              onDragEnd={(e) => {
                const maxIdx = circuitStateRef.current.qubits - 1;
                let idx = clamp(snapToQubitIndex(e.target.y()), 0, maxIdx);
                const other = operation.wires[0];
                if (idx === other) {
                  const baseY = yForQubit(other);
                  const dy = e.target.y() - baseY;
                  if (dy >= 0 && other < maxIdx) idx = other + 1;
                  else if (dy < 0 && other > 0) idx = other - 1;
                  else if (other < maxIdx) idx = other + 1;
                  else if (other > 0) idx = other - 1;
                }
                moveMultiQubitPart(operation.id, 'target', targetX, idx);
                const stage = e.target.getStage();
                const tgtRect = stage?.findOne(`#cr-tgt-rect-${operation.id}`) as any;
                const tgtText = stage?.findOne(`#cr-tgt-text-${operation.id}`) as any;
                const tgtParam = stage?.findOne(`#cr-tgt-param-${operation.id}`) as any;
                if (tgtRect) tgtRect.x(-25);
                if (tgtText) tgtText.x(-25);
                if (tgtParam) tgtParam.x(-25);
                e.target.to({ scaleX: 1, scaleY: 1, shadowBlur: 0, shadowOpacity: 0, duration: 0.08 });
              }}
            >
              {/* Target Gate (Rectangle with symbol) */}
              <Rect
                id={`cr-tgt-rect-${operation.id}`}
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
                id={`cr-tgt-text-${operation.id}`}
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
                  id={`cr-tgt-param-${operation.id}`}
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
          </Group>
        );
      } else {
        // Single qubit gate - rectangle with symbol
        const gateSymbol = getGateSymbol(operation.gate);
        const hasParams = operation.params && operation.params.length > 0;

        elements.push(
          <Group
            key={`${operation.id}-group`}
            x={x}
            y={y}
            draggable
            dragBoundFunc={(pos) => {
              // snap to grid points (columns) and qubit lines (rows)
              const snappedX = snapToGridX(pos.x);
              const idx = snapToQubitIndex(pos.y);
              return { x: snappedX, y: yForQubit(idx) };
            }}
            onDragStart={(e) => {
              e.target.to({ scaleX: 1.08, scaleY: 1.08, shadowBlur: 12, shadowColor: 'black', shadowOpacity: 0.25, duration: 0.08 });
            }}
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
    // Read CSS variables from index.css; fall back to sensible defaults per theme
    const readVar = (name: string, fallback: string) => {
      try {
        const root = document.body || document.documentElement;
        const v = getComputedStyle(root).getPropertyValue(name).trim();
        return v || fallback;
      } catch {
        return fallback;
      }
    };

    const fallbacksLight = {
      gateBg: '#ffffff',
      gateBorder: '#2c3e50',
      gateText: '#2c3e50',
      gateParam: '#666666',
      cnotLine: '#2c3e50',
      cnotControl: '#2c3e50',
      cnotTargetBg: '#ffffff',
      cnotTargetBorder: '#2c3e50',
      cnotTargetCross: '#2c3e50',
    } as const;
    const fallbacksDark = {
      gateBg: '#2d3748',
      gateBorder: '#e2e8f0',
      gateText: '#f7fafc',
      gateParam: '#a0aec0',
      cnotLine: '#f7fafc',
      cnotControl: '#f7fafc',
      cnotTargetBg: '#2d3748',
      cnotTargetBorder: '#e2e8f0',
      cnotTargetCross: '#f7fafc',
    } as const;

    const fb = isDarkMode ? fallbacksDark : fallbacksLight;
    return {
      gateBg: readVar('--color-gate-bg', fb.gateBg),
      gateBorder: readVar('--color-gate-border', fb.gateBorder),
      gateText: readVar('--color-gate-text', fb.gateText),
      gateParam: readVar('--color-gate-param', fb.gateParam),
      cnotLine: readVar('--color-cnot-line', fb.cnotLine),
      cnotControl: readVar('--color-cnot-control', fb.cnotControl),
      cnotTargetBg: readVar('--color-cnot-target-bg', fb.cnotTargetBg),
      cnotTargetBorder: readVar('--color-cnot-target-border', fb.cnotTargetBorder),
      cnotTargetCross: readVar('--color-cnot-target-cross', fb.cnotTargetCross),
    };
  };

  const getGateSymbol = (gateName: string): string => {
    const symbolMap: { [key: string]: string } = {
      'Hadamard': 'H',
      'PauliX': 'X',
      'PauliY': 'Y',
      'PauliZ': 'Z',
      'Controlled-Y': 'Y',
      'Controlled-RX': 'RX',
      'Controlled-RY': 'RY',
      'Controlled-RZ': 'RZ',
      'CRX': 'RX',
      'CRY': 'RY',
      'CRZ': 'RZ',
      'RX': 'RX',
      'RY': 'RY',
      'RZ': 'RZ',
      'Phase': 'S',
      'T': 'T',
      'MeasureZ': 'MZ',
      'MeasureX': 'MX',
      'MeasureY': 'MY',
      'CZ': 'CZ',
      'SWAP': 'SWAP',
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