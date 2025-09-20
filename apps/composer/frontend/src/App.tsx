import React from 'react';
import './App.css';
import CircuitComposer from './components/CircuitComposer';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🔬 Quantum Circuit Composer</h1>
        <p>Design and simulate quantum circuits with PennyLane</p>
      </header>
      <main>
        <CircuitComposer />
      </main>
    </div>
  );
}

export default App;