import React from 'react';
import { Settings, Play, Trash2, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './ControlPanel.css';
import Tooltip from './Tooltip';

interface ControlPanelProps {
  qubits: number;
  shots: number;
  onQubitCountChange: (count: number) => void;
  onShotsChange: (shots: number) => void;
  onExecute: () => void;
  onClear: () => void;
  isLoading: boolean;
  resultMode: 'probs' | 'expval';
  onResultModeChange: (mode: 'probs' | 'expval') => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  qubits,
  shots,
  onQubitCountChange,
  onShotsChange,
  onExecute,
  onClear,
  isLoading,
  resultMode,
  onResultModeChange,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h3><Settings size={20} /> {t('controlPanel')}</h3>
      </div>
      
      <div className="control-group">
        <label htmlFor="qubit-count">{t('qubits')}</label>
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
        <small>{t('qubitRange')}</small>
      </div>

      <div className="control-group">
        <label htmlFor="shots">{t('shots')}</label>
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
        <small>{t('shotRange')}</small>
      </div>

        <div className="control-group">
          <label htmlFor="result-mode">
            {t('resultsMode')}
            {' '}
            <Tooltip
              position="right"
              trigger="click"
              maxWidth={380}
              content={<div dangerouslySetInnerHTML={{ __html: t('resultsModeTooltip') }} />}
            >
              <span aria-label="About results mode" style={{ marginLeft: 6, verticalAlign: 'middle', display: 'inline-flex' }}>
                <Info size={14} />
              </span>
            </Tooltip>
          </label>
          <select
            id="result-mode"
            className="number-input"
            value={resultMode}
            onChange={(e) => onResultModeChange((e.target.value as 'probs' | 'expval'))}
          >
            <option value="probs">{t('probabilities')}</option>
            <option value="expval">{t('expectationValues')}</option>
          </select>
        </div>

      <div className="control-actions">
        <button 
          onClick={onExecute}
          disabled={isLoading}
          className="action-btn primary"
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              {t('running')}
            </>
          ) : (
            <>
              <Play size={16} /> {t('runCircuit')}
            </>
          )}
        </button>
        
        <button 
          onClick={onClear}
          disabled={isLoading}
          className="action-btn secondary"
        >
          <Trash2 size={16} /> {t('clearCircuit')}
        </button>
      </div>


    </div>
  );
};

export default ControlPanel;