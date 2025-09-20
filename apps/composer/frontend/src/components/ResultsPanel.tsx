import React from 'react';
import { CircuitResponse } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './ResultsPanel.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ResultsPanelProps {
  results: CircuitResponse | null;
  isLoading: boolean;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3>📊 Results</h3>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Running quantum circuit...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3>📊 Results</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon">⚡</div>
          <p>Build a circuit and click "Run Circuit" to see the results!</p>
        </div>
      </div>
    );
  }

  if (!results.success) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3>📊 Results</h3>
        </div>
        <div className="error-state">
          <div className="error-icon">❌</div>
          <p>{results.message || 'An error occurred during execution'}</p>
        </div>
      </div>
    );
  }

  const probabilities = results.probabilities;
  const states = Object.keys(probabilities).sort();
  const values = states.map(state => probabilities[state]);

  const chartData = {
    labels: states.map(state => `|${state}⟩`),
    datasets: [
      {
        label: 'Probability',
        data: values,
        backgroundColor: states.map((_, i) => 
          `hsla(${(i * 137.5) % 360}, 70%, 60%, 0.8)`
        ),
        borderColor: states.map((_, i) => 
          `hsla(${(i * 137.5) % 360}, 70%, 50%, 1)`
        ),
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Measurement Probabilities',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Probability: ${(context.raw * 100).toFixed(2)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          callback: function(value: any) {
            return `${(value * 100).toFixed(0)}%`;
          },
        },
        title: {
          display: true,
          text: 'Probability',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Quantum States',
        },
      },
    },
  };

  const maxProbState = states[values.indexOf(Math.max(...values))];
  const maxProb = Math.max(...values);

  return (
    <div className="results-panel">
      <div className="panel-header">
        <h3>📊 Results</h3>
        <div className="success-indicator">✅ Success</div>
      </div>
      
      <div className="chart-container">
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <div className="results-summary">
        <div className="summary-item">
          <span className="label">Most Likely State:</span>
          <span className="value">|{maxProbState}⟩</span>
        </div>
        <div className="summary-item">
          <span className="label">Probability:</span>
          <span className="value">{(maxProb * 100).toFixed(2)}%</span>
        </div>
      </div>
      
      <div className="probability-table">
        <h4>All Probabilities</h4>
        <div className="table-container">
          {states.map((state, i) => (
            <div key={state} className="table-row">
              <span className="state">|{state}⟩</span>
              <span className="probability">
                {(probabilities[state] * 100).toFixed(3)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsPanel;