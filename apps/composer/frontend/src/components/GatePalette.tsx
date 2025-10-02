import React from 'react';
import { Gate } from '../types';
import { useDrag } from 'react-dnd';
import { SlidersHorizontal } from 'lucide-react';
import './GatePalette.css';

interface GateItemProps {
  gate: Gate;
}

const GateItem: React.FC<GateItemProps> = ({ gate }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'gate',
    item: { gate },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`gate-item ${isDragging ? 'dragging' : ''}`}
      title={gate.description}
    >
      <div className="gate-symbol">{gate.symbol}</div>
      <div className="gate-name">{gate.name}</div>
      {gate.params > 0 && (
        <div className="gate-params">
          {gate.params} param{gate.params > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

interface GatePaletteProps {
  gates: Gate[];
}

const GatePalette: React.FC<GatePaletteProps> = ({ gates }) => {
  const singleQubitGates = gates.filter(gate => (gate.qubits === 1 && !gate.name.includes("Measure")));
  const multiQubitGates = gates.filter(gate => gate.qubits > 1);
  const measureQubits = gates.filter(gate => (gate.qubits === 1 && gate.name.includes("Measure")));

  return (
    <div className="gate-palette">
      <div className="palette-header">
        <h3><SlidersHorizontal size={20} /> Gate Palette</h3>
        <p>Drag gates onto the circuit</p>
      </div>
      
      {singleQubitGates.length > 0 && (
      <div className="gate-category">
        <h4>Single-Qubit Gates</h4>
        <div className="gate-grid">
          {singleQubitGates.map((gate) => (
            <GateItem key={gate.name} gate={gate} />
          ))}
        </div>
      </div>
      )}
      
      {multiQubitGates.length > 0 && (
        <div className="gate-category">
          <h4>Multi-Qubit Gates</h4>
          <div className="gate-grid">
            {multiQubitGates.map((gate) => (
              <GateItem key={gate.name} gate={gate} />
            ))}
          </div>
        </div>
      )}
      
      {measureQubits.length > 0 && (
      <div className="gate-category">
        <h4>Measurement</h4>
        <div className="gate-grid">
          {measureQubits.map((gate) => (
            <GateItem key={gate.name} gate={gate} />
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default GatePalette;