'use client';

import { useCircuitStore } from '@/store/circuitStore';
import { generateLatex } from '@/lib/latexGenerator';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useState } from 'react';

export function LatexExportPanel() {
  const { circuit, qubits, qubitLabels, customGates } = useCircuitStore();
  const [copied, setCopied] = useState(false);

  const latexCode = generateLatex(circuit, qubits, qubitLabels, customGates);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="m-4 p-6 bg-gradient-to-r from-gray-900 to-gray-800 border-purple-700/30 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 text-lg font-bold">LaTeX Code (quantikz)</h3>
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="bg-purple-900/50 hover:bg-purple-800 border-purple-600 text-purple-200 hover:text-white transition-all duration-300 hover:scale-105"
        >
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </Button>
      </div>
      <pre className="bg-gray-950/80 text-green-400 p-5 rounded-xl overflow-x-auto font-mono text-sm border border-green-900/30 shadow-inner">
        {latexCode}
      </pre>
    </Card>
  );
}
