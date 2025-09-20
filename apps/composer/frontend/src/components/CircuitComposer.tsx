import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import GatePalette from './GatePalette';
import CircuitCanvas from './CircuitCanvas';
import ResultsPanel from './ResultsPanel';
import ControlPanel from './ControlPanel';
import { CircuitState, Gate, CircuitResponse } from '../types';
import { apiService } from '../api';
import './CircuitComposer.css';

const CircuitComposer: React.FC = () => {
  const [circuitState, setCircuitState] = useState<CircuitState>({
    qubits: 3,
    operations: [],
    shots: 1024,
  });

  // Add logging for state changes
  useEffect(() => {
    console.log('CircuitState changed:', {
      qubits: circuitState.qubits,
      operationsCount: circuitState.operations.length,
      operations: circuitState.operations
    });
  }, [circuitState]);
  
  const [availableGates, setAvailableGates] = useState<Gate[]>([]);
  const [results, setResults] = useState<CircuitResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load available gates from backend
    loadGates();
  }, []);

  const loadGates = async () => {
    try {
      const gates = await apiService.getAvailableGates();
      setAvailableGates(gates);
    } catch (err) {
      setError('Failed to load quantum gates');
      console.error('Error loading gates:', err);
    }
  };

  const executeCircuit = async () => {
    if (circuitState.operations.length === 0) {
      setError('Please add some gates to the circuit first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const circuitRequest = {
        qubits: circuitState.qubits,
        shots: circuitState.shots,
        circuit: circuitState.operations.map(op => ({
          gate: op.gate,
          wires: op.wires,
          params: op.params,
        })),
      };

      const response = await apiService.executeCircuit(circuitRequest);
      setResults(response);
    } catch (err: any) {
      setError(err.message || 'Failed to execute circuit');
    } finally {
      setIsLoading(false);
    }
  };

  const clearCircuit = () => {
    setCircuitState(prev => ({
      ...prev,
      operations: [],
    }));
    setResults(null);
    setError(null);
  };

  const updateQubitCount = (newCount: number) => {
    setCircuitState(prev => ({
      ...prev,
      qubits: Math.max(1, Math.min(10, newCount)),
      operations: prev.operations.filter(op => 
        op.wires.every(wire => wire < newCount)
      ),
    }));
  };

  const updateShots = (newShots: number) => {
    setCircuitState(prev => ({
      ...prev,
      shots: Math.max(1, Math.min(100000, newShots)),
    }));
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="circuit-composer">
        <div className="composer-layout">
          <div className="left-panel">
            <ControlPanel
              qubits={circuitState.qubits}
              shots={circuitState.shots}
              onQubitCountChange={updateQubitCount}
              onShotsChange={updateShots}
              onExecute={executeCircuit}
              onClear={clearCircuit}
              isLoading={isLoading}
            />
            <GatePalette gates={availableGates} />
          </div>
          
          <div className="main-content">
            <CircuitCanvas
              circuitState={circuitState}
              onStateChange={setCircuitState}
            />
            {error && (
              <div className="error-message">
                <span>⚠️ {error}</span>
                <button 
                  onClick={() => setError(null)}
                  className="error-close"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          
          <div className="right-panel">
            <ResultsPanel results={results} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default CircuitComposer;