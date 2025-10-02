import React from 'react';
import './App.css';
import CircuitComposer from './components/CircuitComposer';
import ThemeSwitcher from './components/ThemeSwitcher';
import LanguageSwitcher from './components/LanguageSwitcher';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>Quantum Circuit Composer</h1>
          <p>Design and simulate quantum circuits with PennyLane</p>
        </div>
        <div className="header-controls">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <main>
        <CircuitComposer />
      </main>
    </div>
  );
}

export default App;
