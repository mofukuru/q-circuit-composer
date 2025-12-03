import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { BarChart3, Zap, CheckCircle, Code, Copy, Check, Cpu, Layers, Box, FileCode, FileText } from 'lucide-react';
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
  measuredWires?: number[]; // indices of wires that have explicit measurement gates
  measuredBases?: Record<number, 'Z' | 'X' | 'Y'>; // wire -> basis
  resultMode?: 'probs' | 'expval';
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  results,
  isLoading,
  measuredWires = [],
  measuredBases = {},
  resultMode = 'probs'
}) => {

  const  { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'results' | 'code'>('results');
  const [copied, setCopied] = useState(false);
  const [codeLang, setCodeLang] = useState<'pennylane' | 'qiskit' | 'qulacs' | 'qasm' | 'latex'>('pennylane');

  const handleCopyCode = () => {
    let codeText = '';
    if (codeLang === 'pennylane') {
      codeText = results?.pennylane_code || '';
    } else if (codeLang === 'qiskit') {
      codeText = results?.qiskit_code || '';
    } else if (codeLang === 'qulacs') {
      codeText = results?.qulacs_code || '';
    } else if (codeLang === 'qasm') {
      codeText = results?.qasm_code || '';
    } else if (codeLang === 'latex') {
      codeText = results?.latex_code || '';
    }
    
    if (codeText) {
      navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3><BarChart3 size={20} /> {t('results')}</h3>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t('resultLoader')}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3><BarChart3 size={20} /> {t('results')}</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon"><Zap size={48} /></div>
          <p>{t('resultInstruction')}</p>
        </div>
      </div>
    );
  }

  if (!results.success) {
    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3><BarChart3 size={20} /> {t('results')}</h3>
        </div>
        <div className="error-state">
          <div className="error-icon">❌</div>
          <p>{results.message || 'An error occurred during execution'}</p>
        </div>
      </div>
    );
  }

  // Prefer server-provided measured metadata; fall back to props
  const serverMeasuredWires = (results as any).measured_wires as number[] | undefined;
  const serverMeasuredBases = (results as any).measured_bases as Record<number, 'Z' | 'X' | 'Y'> | undefined;
  const effMeasuredWires = (serverMeasuredWires && serverMeasuredWires.length > 0)
    ? serverMeasuredWires
    : (measuredWires || []);
  const effMeasuredBases: Record<number, 'Z' | 'X' | 'Y'> = serverMeasuredBases && Object.keys(serverMeasuredBases).length > 0
    ? serverMeasuredBases
    : (measuredBases || {});
  const hasMeasured = (effMeasuredWires?.length ?? 0) > 0;

  // Expectations mode branch
  const expectations = results.expectations || undefined;
  const isExpval = resultMode === 'expval' || (!!expectations && Object.keys(expectations).length > 0);
  if (isExpval) {
    const wires = (expectations ? Object.keys(expectations).map(k => parseInt(k, 10)) : effMeasuredWires).sort((a, b) => a - b);
    const labels = wires.map(w => `q${w}${effMeasuredBases[w] ? ` (${effMeasuredBases[w]})` : ''}`);
    const values = wires.map(w => expectations ? expectations[w] ?? 0 : 0);

    const chartDataExp = {
      labels,
      datasets: [
        {
          label: 'Expectation Value',
          data: values,
          backgroundColor: labels.map((_, i) => `hsla(${(i * 137.5) % 360}, 70%, 60%, 0.8)`),
          borderColor: labels.map((_, i) => `hsla(${(i * 137.5) % 360}, 70%, 50%, 1)`),
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    } as any;

    const chartOptionsExp = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Per-wire Expectation Values', font: { size: 14, weight: 'bold' as const } },
        tooltip: {
          callbacks: {
            label: function (context: any) {
              return `${Number(context.raw).toFixed(4)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          min: -1,
          max: 1,
          ticks: {
            callback: function (value: any) {
              return (typeof value === 'number') ? value.toFixed(1) : value;
            },
          },
          title: { display: true, text: 'Expectation Value' },
        },
        x: { title: { display: true, text: 'Wires' } },
      },
    } as any;

    return (
      <div className="results-panel">
        <div className="panel-header">
          <h3><BarChart3 size={20} /> {t('results')}</h3>
          <div className="header-actions">
            <button 
              className={`view-mode-btn ${viewMode === 'results' ? 'active' : ''}`}
              onClick={() => setViewMode('results')}
              title={t('results')}
              aria-label={t('results')}
            >
              <BarChart3 size={16} />
            </button>
            <button 
              className={`view-mode-btn ${viewMode === 'code' ? 'active' : ''}`}
              onClick={() => setViewMode('code')}
              title={t('pennylaneCode')}
              aria-label={t('pennylaneCode')}
            >
              <Code size={16} />
            </button>
            <div className="success-indicator"><CheckCircle size={16} /> {t('status')}</div>
          </div>
        </div>

        {viewMode === 'code' && results.pennylane_code ? (
          <div className="code-view">
            <div className="code-header">
              <span>{t('pennylaneCode')}</span>
              <button 
                className="copy-btn"
                onClick={handleCopyCode}
                title={copied ? t('codeCopied') : t('copyCode')}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('codeCopied') : t('copyCode')}
              </button>
            </div>
            <pre className="code-block">
              <code>{results.pennylane_code}</code>
            </pre>
          </div>
        ) : (
          <>
            {hasMeasured && wires.length > 0 && (
              <div className="panel-subtitle">Wires: {wires.map(w => `${w}:${effMeasuredBases[w] ?? 'Z'}`).join(', ')}</div>
            )}
            <div className="chart-container">
              <Bar data={chartDataExp} options={chartOptionsExp} />
            </div>
            <div className="probability-table">
              <h4>{t('expValue')}</h4>
              <div className="table-container">
                {wires.map((w, idx) => (
                  <div key={w} className="table-row">
                    <span className="state">q{w}</span>
                    <span className="probability">{values[idx].toFixed(6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Probabilities mode branch (default)
  const probabilities = results.probabilities || {};
  const states = Object.keys(probabilities).sort();
  const nBits = states[0]?.length ?? 0;
  const sortedMeasured = hasMeasured ? [...effMeasuredWires].sort((a, b) => a - b) : [];
  const bitOrderLabel = nBits > 0
    ? hasMeasured && sortedMeasured.length === nBits
      ? `Bit order: |${sortedMeasured.map((w) => `q${w}`).join(' ')}⟩`
      : `Bit order: |${Array.from({ length: nBits }, (_, i) => `q${i}`).join(' ')}⟩`
    : '';
  const values = states.map(state => probabilities[state]);
  const chartTitle = 'Measurement Probabilities';
  const subtitle = hasMeasured && sortedMeasured.length > 0
    ? `Wires: ${sortedMeasured.map(w => `${w}:${effMeasuredBases[w] ?? 'Z'}`).join(', ')}`
    : null;

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
        text: chartTitle,
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

  const maxProb = Math.max(...values);
  const maxProbState = states[values.indexOf(maxProb)] ?? '';

  return (
    <div className="results-panel">
      <div className="panel-header">
        <h3><BarChart3 size={20} /> {t('results')}</h3>
        <div className="header-actions">
          <button 
            className={`view-mode-btn ${viewMode === 'results' ? 'active' : ''}`}
            onClick={() => setViewMode('results')}
            title={t('results')}
            aria-label={t('results')}
          >
            <BarChart3 size={16} />
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'code' ? 'active' : ''}`}
            onClick={() => setViewMode('code')}
            title={t('pennylaneCode')}
            aria-label={t('pennylaneCode')}
          >
            <Code size={16} />
          </button>
          <div className="success-indicator"><CheckCircle size={16} /> {t('status')}</div>
        </div>
      </div>

      {viewMode === 'code' ? (
        <div className="code-view">
          <div className="code-lang-select code-lang-select--top">
            <button 
              className={`lang-btn ${codeLang==='pennylane'?'active':''}`} 
              onClick={()=>setCodeLang('pennylane')} 
              title="PennyLane"
              aria-label="PennyLane"
            >
              <Zap size={16} />
            </button>
            <button 
              className={`lang-btn ${codeLang==='qiskit'?'active':''}`} 
              onClick={()=>setCodeLang('qiskit')} 
              title="Qiskit"
              aria-label="Qiskit"
            >
              <Cpu size={16} />
            </button>
            <button 
              className={`lang-btn ${codeLang==='qulacs'?'active':''}`} 
              onClick={()=>setCodeLang('qulacs')} 
              title="Qulacs"
              aria-label="Qulacs"
            >
              <Layers size={16} />
            </button>
            <button 
              className={`lang-btn ${codeLang==='qasm'?'active':''}`} 
              onClick={()=>setCodeLang('qasm')} 
              title="OpenQASM"
              aria-label="OpenQASM"
            >
              <FileCode size={16} />
            </button>
            <button 
              className={`lang-btn ${codeLang==='latex'?'active':''}`} 
              onClick={()=>setCodeLang('latex')} 
              title="LaTeX"
              aria-label="LaTeX"
            >
              <FileText size={16} />
            </button>
          </div>
          <div className="code-header">
            <span>
              {codeLang === 'pennylane' && 'PennyLane Code'}
              {codeLang === 'qiskit' && 'Qiskit Code'}
              {codeLang === 'qulacs' && 'Qulacs Code'}
              {codeLang === 'qasm' && 'OpenQASM Code'}
              {codeLang === 'latex' && 'LaTeX Code'}
            </span>
            <button 
              className="copy-btn"
              onClick={handleCopyCode}
              title={copied ? t('codeCopied') : t('copyCode')}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('codeCopied') : t('copyCode')}
            </button>
          </div>
          <pre className="code-block">
            <code>{
              codeLang==='pennylane' ? (results.pennylane_code || '') :
              codeLang==='qiskit' ? (results.qiskit_code || '') :
              codeLang==='qulacs' ? (results.qulacs_code || '') :
              codeLang==='qasm' ? (results.qasm_code || '') :
              (results.latex_code || '')
            }</code>
          </pre>
        </div>
      ) : (
        <>
          {subtitle && (
            <div className="panel-subtitle">{subtitle}</div>
          )}
          {bitOrderLabel && (
            <div className="panel-subtitle">{bitOrderLabel}</div>
          )}

          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div className="results-summary">
            <div className="summary-item">
              <span className="label">{t('mlsState')}</span>
              <span className="value">|{maxProbState}⟩</span>
            </div>
            <div className="summary-item">
              <span className="label">{t('probValue')}</span>
              <span className="value">{(maxProb * 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="probability-table">
            <h4>{t('allProb')}</h4>
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
        </>
      )}
    </div>
  );
};

export default ResultsPanel;
