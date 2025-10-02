import React from 'react';
import { Gate } from '../types';
import { useDrag } from 'react-dnd';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
      title={`${gate.name}: ${gate.description}${gate.params > 0 ? ` (Params: ${gate.params})` : ''}`}
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
  const { t, i18n } = useTranslation();
  const singleQubitGates = gates.filter(gate => (gate.qubits === 1 && !gate.name.includes("Measure")));
  const multiQubitGates = gates.filter(gate => gate.qubits > 1);
  const measureQubits = gates.filter(gate => (gate.qubits === 1 && gate.name.includes("Measure")));

  return (
    <div className="gate-palette">
      <div className="palette-header">
        <h3><SlidersHorizontal size={20} /> {t('gatePalette')}</h3>
        <p>{t('dragDrop')}</p>
      </div>

      {singleQubitGates.length > 0 && (
      <div className="gate-category">
        <h4>{t('singleQubitGates')}</h4>
        <div className="gate-grid">
          {singleQubitGates.map((gate) => (
            <GateItem key={gate.name} gate={gate} />
          ))}
        </div>
      </div>
      )}

      {multiQubitGates.length > 0 && (
        <div className="gate-category">
          <h4>{t('multiQubitGates')}</h4>
          <div className="gate-grid">
            {multiQubitGates.map((gate) => (
              <GateItem key={gate.name} gate={gate} />
            ))}
          </div>
        </div>
      )}

      {measureQubits.length > 0 && (
      <div className="gate-category">
        <h4>{t('measurement')}</h4>
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
