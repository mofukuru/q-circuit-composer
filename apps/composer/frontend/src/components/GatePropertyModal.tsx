import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { GateOperation } from '../types';
import './GatePropertyModal.css';

interface GatePropertyModalProps {
  gate: GateOperation;
  classicalBits: number;
  onClose: () => void;
  onSave: (updatedGate: GateOperation) => void;
}

const GatePropertyModal: React.FC<GatePropertyModalProps> = ({
  gate,
  classicalBits,
  onClose,
  onSave,
}) => {
  const [classicalStore, setClassicalStore] = useState<number | undefined>(
    gate.classical_store
  );
  const [hasCondition, setHasCondition] = useState(!!gate.condition);
  const [conditionBit, setConditionBit] = useState(
    gate.condition?.classical_bit ?? 0
  );
  const [conditionValue, setConditionValue] = useState<0 | 1>(
    gate.condition?.value ?? 0
  );

  const isMeasurement = /^(measurez|mz|measurex|mx|measurey|my)$/i.test(
    gate.gate
  );

  console.log('GatePropertyModal rendered for gate:', gate);
  console.log('isMeasurement:', isMeasurement);
  console.log('classicalBits:', classicalBits);

  const handleSave = () => {
    const updatedGate: GateOperation = {
      ...gate,
      classical_store: isMeasurement ? classicalStore : undefined,
      condition: hasCondition
        ? {
            classical_bit: conditionBit,
            value: conditionValue,
          }
        : undefined,
    };
    console.log('Saving gate properties:', updatedGate);
    onSave(updatedGate);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Gate Properties: {gate.gate}</h3>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isMeasurement && (
            <div className="property-section">
              <h4>Mid-circuit Measurement</h4>
              <label>
                <input
                  type="checkbox"
                  checked={classicalStore !== undefined}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setClassicalStore(0);
                    } else {
                      setClassicalStore(undefined);
                    }
                  }}
                />
                Store result in classical bit
              </label>

              {classicalStore !== undefined && (
                <div className="property-field">
                  <label>Classical Bit:</label>
                  <select
                    value={classicalStore}
                    onChange={(e) => setClassicalStore(Number(e.target.value))}
                  >
                    {Array.from({ length: classicalBits }, (_, i) => (
                      <option key={i} value={i}>
                        c[{i}]
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="property-section">
            <h4>Conditional Execution</h4>
            <label>
              <input
                type="checkbox"
                checked={hasCondition}
                onChange={(e) => setHasCondition(e.target.checked)}
              />
              Apply gate conditionally
            </label>

            {hasCondition && (
              <>
                <div className="property-field">
                  <label>If classical bit:</label>
                  <select
                    value={conditionBit}
                    onChange={(e) => setConditionBit(Number(e.target.value))}
                  >
                    {Array.from({ length: classicalBits }, (_, i) => (
                      <option key={i} value={i}>
                        c[{i}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="property-field">
                  <label>Equals:</label>
                  <select
                    value={conditionValue}
                    onChange={(e) =>
                      setConditionValue(Number(e.target.value) as 0 | 1)
                    }
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="property-btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="property-btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default GatePropertyModal;
