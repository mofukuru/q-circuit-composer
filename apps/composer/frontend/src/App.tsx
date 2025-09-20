import React from 'react';
import './App.css';
import CircuitComposer from './components/CircuitComposer';
import ThemeSwitcher from './components/ThemeSwitcher';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>Quantum Circuit Composer</h1>
          <p>Design and simulate quantum circuits with PennyLane</p>
        </div>
        <ThemeSwitcher />
      </header>
      <main>
        <CircuitComposer />
      </main>
    </div>
  );
}

export default App;
