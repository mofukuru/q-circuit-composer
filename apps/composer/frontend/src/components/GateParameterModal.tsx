import React, { useState } from 'react';
import './GateParameterModal.css';

interface GateParameterModalProps {
  gateName: string;
  currentParams: number[];
  onConfirm: (params: number[]) => void;
  onCancel: () => void;
}

const GateParameterModal: React.FC<GateParameterModalProps> = ({
  gateName,
  currentParams,
  onConfirm,
  onCancel,
}) => {
  const [angle, setAngle] = useState(currentParams[0] || Math.PI / 2);
  const [angleDegrees, setAngleDegrees] = useState(
    Math.round((currentParams[0] || Math.PI / 2) * (180 / Math.PI))
  );

  const handleRadianChange = (value: number) => {
    setAngle(value);
    setAngleDegrees(Math.round(value * (180 / Math.PI)));
  };

  const handleDegreeChange = (value: number) => {
    setAngleDegrees(value);
    setAngle((value * Math.PI) / 180);
  };

  const handleConfirm = () => {
    onConfirm([angle]);
  };

  const presetAngles = [
    { label: 'π/8', radians: Math.PI / 8, degrees: 22.5 },
    { label: 'π/4', radians: Math.PI / 4, degrees: 45 },
    { label: 'π/2', radians: Math.PI / 2, degrees: 90 },
    { label: 'π', radians: Math.PI, degrees: 180 },
    { label: '3π/2', radians: (3 * Math.PI) / 2, degrees: 270 },
    { label: '2π', radians: 2 * Math.PI, degrees: 360 },
  ];

  return (
    <div className="gate-parameter-modal-overlay" onClick={onCancel}>
      <div className="gate-parameter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Set {gateName} Rotation Angle</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="parameter-group">
            <label>Angle (radians):</label>
            <input
              type="number"
              step="0.1"
              value={angle.toFixed(3)}
              onChange={(e) => handleRadianChange(parseFloat(e.target.value) || 0)}
              className="parameter-input"
            />
          </div>
          
          <div className="parameter-group">
            <label>Angle (degrees):</label>
            <input
              type="number"
              step="1"
              value={angleDegrees}
              onChange={(e) => handleDegreeChange(parseInt(e.target.value) || 0)}
              className="parameter-input"
            />
          </div>
          
          <div className="preset-angles">
            <label>Common angles:</label>
            <div className="preset-buttons">
              {presetAngles.map((preset) => (
                <button
                  key={preset.label}
                  className={`preset-button ${Math.abs(angle - preset.radians) < 0.01 ? 'active' : ''}`}
                  onClick={() => handleRadianChange(preset.radians)}
                >
                  {preset.label}
                  <small>{preset.degrees}°</small>
                </button>
              ))}
            </div>
          </div>
          
          <div className="angle-slider">
            <label>Visual slider (0° - 360°):</label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={angleDegrees}
              onChange={(e) => handleDegreeChange(parseInt(e.target.value))}
              className="slider"
            />
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            Apply Angle
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateParameterModal;