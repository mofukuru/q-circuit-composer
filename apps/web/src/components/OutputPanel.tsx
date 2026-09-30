import { CircuitError, type CodeFormat, generateCode, hasErrors, type Issue, numClbits, simulate, validate } from '@qcc/core';
import { AlertTriangle, Check, Copy, Download, Info, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { latexToText } from '../pretty';
import CircuitPreview from './CircuitPreview';
import { type OutputTab, useStore } from '../store';

const MAX_BARS = 64;

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line-strong p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-sm ${value === o.value ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-surface-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IssueList({ issues, title }: { issues: Issue[]; title?: string }) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const unique = (list: Issue[]) => [...new Set(list.map((i) => i.message))];
  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} />
            {title ?? t('issues.errors')}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {unique(errors).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <Info size={14} />
            {t('issues.warnings')}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {unique(warnings).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Bars({ entries, format }: { entries: [string, number][]; format: (v: number) => string }) {
  return (
    <ul className="space-y-1">
      {entries.map(([state, value]) => (
        <li key={state} className="grid grid-cols-[auto_1fr_4.5rem] items-center gap-2 text-sm">
          <span className="font-mono text-ink">|{state}⟩</span>
          <div className="h-4 overflow-hidden rounded bg-surface-2">
            <div className="h-full rounded bg-accent transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
          </div>
          <span className="text-right font-mono text-xs tabular-nums text-muted">{format(value)}</span>
        </li>
      ))}
    </ul>
  );
}

function ExpectationBars({ values, labels }: { values: [number, number][]; labels: string[] }) {
  return (
    <ul className="space-y-1">
      {values.map(([wire, v]) => (
        <li key={wire} className="grid grid-cols-[4rem_1fr_4.5rem] items-center gap-2 text-sm">
          <span className="truncate font-serif">{latexToText(labels[wire])}</span>
          <div className="relative h-4 rounded bg-surface-2">
            <div className="absolute inset-y-0 left-1/2 w-px bg-wire" />
            <div
              className="absolute inset-y-0 rounded bg-accent"
              style={v >= 0 ? { left: '50%', width: `${v * 50}%` } : { right: '50%', width: `${-v * 50}%` }}
            />
          </div>
          <span className="text-right font-mono text-xs tabular-nums">{v.toFixed(4)}</span>
        </li>
      ))}
    </ul>
  );
}

function Results() {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const { shots, resultMode, sampled, seed, set, resample } = useStore(
    useShallow((s) => ({ shots: s.shots, resultMode: s.resultMode, sampled: s.sampled, seed: s.seed, set: s.set, resample: s.resample })),
  );

  const outcome = useMemo(() => {
    const issues = validate(circuit, { numeric: true });
    if (hasErrors(issues)) return { issues, result: null };
    try {
      return { issues, result: simulate(circuit, { shots: sampled ? shots : 0, seed }) };
    } catch (e) {
      // Too many mid-circuit measurement outcomes only shows up while simulating.
      if (e instanceof CircuitError) return { issues: e.issues, result: null };
      throw e;
    }
  }, [circuit, shots, sampled, seed]);

  const { result, issues } = outcome;
  const entries = useMemo(() => {
    if (!result) return [];
    // Objects list integer-like keys ("100") before others ("011"), so sort bitstrings explicitly.
    const states = Object.keys(result.probabilities).sort();
    const all: [string, number][] = states.map((k) => [k, sampled ? (result.counts?.[k] ?? 0) / shots : result.probabilities[k]]);
    if (all.length <= 16) return all;
    const nonzero = all.filter(([, p]) => p > 1e-12);
    return nonzero.length <= MAX_BARS ? nonzero : [...nonzero].sort((a, b) => b[1] - a[1]).slice(0, MAX_BARS).sort((a, b) => a[0].localeCompare(b[0]));
  }, [result, sampled, shots]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label={t('output.mode')}
          value={resultMode}
          onChange={(resultMode) => set({ resultMode })}
          options={[
            { value: 'probs', label: t('output.probs') },
            { value: 'expval', label: t('output.expval') },
          ]}
        />
        {resultMode === 'probs' && (
          <Segmented
            label={t('output.mode')}
            value={sampled ? 'sampled' : 'exact'}
            onChange={(v) => set({ sampled: v === 'sampled' })}
            options={[
              { value: 'exact', label: t('output.exact') },
              { value: 'sampled', label: t('output.sampled') },
            ]}
          />
        )}
        {resultMode === 'probs' && sampled && (
          <>
            <label className="flex items-center gap-1.5 text-sm">
              {t('output.shots')}
              <input
                type="number"
                min={1}
                max={1_000_000}
                value={shots}
                onChange={(e) => set({ shots: Math.max(1, Math.min(1_000_000, Math.round(Number(e.target.value) || 1))) })}
                className="w-24 rounded-md border border-line-strong bg-field px-2 py-1 font-mono text-sm"
              />
            </label>
            <button type="button" onClick={resample} className="flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
              <RefreshCw size={14} />
              {t('output.resample')}
            </button>
          </>
        )}
      </div>

      <IssueList issues={issues} title={t('output.cannotSimulate')} />

      {result && (
        <>
          <p className="text-xs text-muted">
            {Object.keys(result.bases).length > 0
              ? `${t('output.measuredOn', { wires: result.wires.map((w) => latexToText(circuit.qubitLabels[w])).join(', ') })} · ${t('output.basisNote')}`
              : t('output.allWires')}
          </p>
          {resultMode === 'expval' ? (
            <ExpectationBars values={result.wires.map((w) => [w, result.expectations[w]])} labels={circuit.qubitLabels} />
          ) : (
            <>
              <Bars entries={entries} format={(v) => (sampled ? `${Math.round(v * shots)}` : `${(v * 100).toFixed(2)}%`)} />
              {Object.keys(result.probabilities).length > entries.length && (
                <p className="text-xs text-muted">
                  {entries.length === MAX_BARS
                    ? t('output.topStates', { count: MAX_BARS })
                    : t('output.hiddenStates', { count: Object.keys(result.probabilities).length - entries.length })}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };
  const btn = 'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-code-ink/70 hover:bg-white/10 hover:text-code-ink';
  return (
    <div className="overflow-hidden rounded-lg border border-code-line bg-code">
      <div className="flex justify-end gap-1 border-b border-code-line px-2 py-1">
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('output.copied') : t('output.copy')}
        </button>
        <button type="button" onClick={download} className={btn}>
          <Download size={14} />
          {t('output.download')}
        </button>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 font-mono text-[13px] leading-relaxed text-code-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const FORMATS: { value: Exclude<CodeFormat, 'latex'>; label: string; file: string }[] = [
  { value: 'pennylane', label: 'PennyLane', file: 'circuit_pennylane.py' },
  { value: 'qiskit', label: 'Qiskit', file: 'circuit_qiskit.py' },
  { value: 'qulacs', label: 'Qulacs', file: 'circuit_qulacs.py' },
  { value: 'qasm', label: 'OpenQASM 2.0', file: 'circuit.qasm' },
];

function Code() {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const { codeFormat, shots, sampled, resultMode, set } = useStore(
    useShallow((s) => ({ codeFormat: s.codeFormat, shots: s.shots, sampled: s.sampled, resultMode: s.resultMode, set: s.set })),
  );
  const result = useMemo(
    () => generateCode(circuit, codeFormat, { shots: sampled ? shots : undefined, resultMode }),
    [circuit, codeFormat, shots, sampled, resultMode],
  );
  return (
    <div className="space-y-3">
      <Segmented label={t('output.code')} value={codeFormat} onChange={(codeFormat) => set({ codeFormat })} options={FORMATS} />
      <IssueList issues={result.issues} />
      {result.code && <CodeBlock code={result.code} filename={FORMATS.find((f) => f.value === codeFormat)!.file} />}
    </div>
  );
}

function Latex() {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const standalone = useStore((s) => s.latexStandalone);
  const set = useStore((s) => s.set);
  const result = useMemo(() => generateCode(circuit, 'latex', { standalone }), [circuit, standalone]);
  return (
    <div className="space-y-3">
      <CircuitPreview />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={standalone} onChange={(e) => set({ latexStandalone: e.target.checked })} className="size-4 " />
        {t('output.standalone')}
      </label>
      <IssueList issues={result.issues} />
      {result.code && <CodeBlock code={result.code} filename="circuit.tex" />}
      <p className="text-xs text-muted">
        {t('output.latexNote')}
        {numClbits(circuit) > 0 && ` ${t('output.latexClassicalNote')}`}
      </p>
    </div>
  );
}

export default function OutputPanel() {
  const { t } = useTranslation();
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  const tabs: OutputTab[] = ['results', 'code', 'latex'];

  return (
    <section className="panel">
      <div role="tablist" className="flex gap-1 border-b border-line px-2">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => set({ tab: id })}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === id
                ? 'border-accent text-accent-soft'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t(`output.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-4">
        {tab === 'results' && <Results />}
        {tab === 'code' && <Code />}
        {tab === 'latex' && <Latex />}
      </div>
    </section>
  );
}
