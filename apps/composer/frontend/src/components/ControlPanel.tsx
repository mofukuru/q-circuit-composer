import React from 'react';
import './ControlPanel.css';

interface ControlPanelProps {
  qubits: number;
  shots: number;
  onQubitCountChange: (count: number) => void;
  onShotsChange: (shots: number) => void;
  onExecute: () => void;
  onClear: () => void;
  isLoading: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  qubits,
  shots,
  onQubitCountChange,
  onShotsChange,
  onExecute,
  onClear,
  isLoading,
}) => {
  return (
    <div className="control-panel">
      <div className="panel-header">
        <h3>⚙️ Control Panel</h3>
      </div>
      
      <div className="control-group">
        <label htmlFor="qubit-count">Number of Qubits:</label>
        <div className="input-with-buttons">
          <button 
            onClick={() => onQubitCountChange(qubits - 1)}
            disabled={qubits <= 1}
            className="adjust-btn"
          >
            −
          </button>
          <input
            id="qubit-count"
            type="number"
            min="1"
            max="10"
            value={qubits}
            onChange={(e) => onQubitCountChange(parseInt(e.target.value) || 1)}
            className="number-input"
          />
          <button 
            onClick={() => onQubitCountChange(qubits + 1)}
            disabled={qubits >= 10}
            className="adjust-btn"
          >
            +
          </button>
        </div>
        <small>Range: 1-10 qubits</small>
      </div>

      <div className="control-group">
        <label htmlFor="shots">Number of Shots:</label>
        <div className="input-with-buttons">
          <button 
            onClick={() => onShotsChange(Math.max(1, shots - 100))}
            disabled={shots <= 1}
            className="adjust-btn"
          >
            −100
          </button>
          <input
            id="shots"
            type="number"
            min="1"
            max="100000"
            value={shots}
            onChange={(e) => onShotsChange(parseInt(e.target.value) || 1)}
            className="number-input"
          />
          <button 
            onClick={() => onShotsChange(Math.min(100000, shots + 100))}
            disabled={shots >= 100000}
            className="adjust-btn"
          >
            +100
          </button>
        </div>
        <small>Range: 1-100,000 shots</small>
      </div>

      <div className="control-actions">
        <button 
          onClick={onExecute}
          disabled={isLoading}
          className="execute-btn primary"
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              Running...
            </>
          ) : (
            <>
              ▶️ Run Circuit
            </>
          )}
        </button>
        
        <button 
          onClick={onClear}
          disabled={isLoading}
          className="clear-btn secondary"
        >
          🗑️ Clear Circuit
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;