import {
  type Basis,
  evalAngle,
  freeSymbols,
  GATES,
  type Operation,
  parseExpr,
  removeOperation,
  resizeCustom,
  setWire,
  updateOperation,
} from '@qcc/core';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { latexToText } from '../pretty';
import { useStore } from '../store';

const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900';

function AngleInput({ op, index }: { op: Operation; index: number }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(op.params[index]);
  const parsed = parseExpr(draft);
  const value = evalAngle(draft);
  const symbolic = parsed.ok && freeSymbols(parsed.expr).size > 0;

  const apply = () => {
    const { circuit, commit } = useStore.getState();
    if (!parsed.ok || draft === op.params[index]) return;
    const params = [...op.params];
    params[index] = draft.trim();
    commit(updateOperation(circuit, op.id, { params }));
  };

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('inspector.angle')}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === 'Enter' && apply()}
        aria-invalid={!parsed.ok}
        className={`${field} w-full font-mono ${parsed.ok ? '' : 'border-rose-500 dark:border-rose-500'}`}
      />
      <span className={`block text-xs ${parsed.ok ? 'text-slate-500 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {!parsed.ok ? parsed.error : symbolic ? t('inspector.symbolic') : value.ok ? `= ${value.value.toFixed(6)} rad` : value.error}
      </span>
      <span className="block text-[11px] text-slate-400">{t('inspector.angleHelp')}</span>
    </label>
  );
}

function WireSelect({ op, role, index }: { op: Operation; role: 'controls' | 'targets'; index: number }) {
  const { t } = useTranslation();
  const numQubits = useStore((s) => s.circuit.numQubits);
  const labels = useStore((s) => s.circuit.qubitLabels);
  const onChange = (wire: number) => {
    const { circuit, commit, notify } = useStore.getState();
    if (!commit(setWire(circuit, op.id, role, index, wire))) notify(t('editor.cannotPlace'));
  };
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {t(`inspector.${role}`)}
        {GATES[op.gate][role === 'controls' ? 'controls' : 'targets']! > 1 ? ` ${index + 1}` : ''}
      </span>
      <select value={op[role][index]} onChange={(e) => onChange(Number(e.target.value))} className={field}>
        {Array.from({ length: numQubits }, (_, w) => (
          <option key={w} value={w}>
            {latexToText(labels[w])}
          </option>
        ))}
      </select>
    </label>
  );
}

function BasisPicker({ op }: { op: Operation }) {
  const { t } = useTranslation();
  const setBasis = (basis: Basis) => {
    const { circuit, commit } = useStore.getState();
    commit(updateOperation(circuit, op.id, { basis }));
  };
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('inspector.basis')}</span>
      <div className="flex gap-1" role="radiogroup">
        {(['Z', 'X', 'Y'] as const).map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={(op.basis ?? 'Z') === b}
            onClick={() => setBasis(b)}
            className={`flex-1 rounded-md border px-2 py-1 font-mono text-sm ${
              (op.basis ?? 'Z') === b
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomFields({ op }: { op: Operation }) {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const commit = useStore((s) => s.commit);
  const notify = useStore((s) => s.notify);
  return (
    <>
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('inspector.customGate')}</span>
        <select value={op.customId} onChange={(e) => commit(updateOperation(circuit, op.id, { customId: e.target.value }))} className={field}>
          {circuit.customGates.map((g) => (
            <option key={g.id} value={g.id}>
              {latexToText(g.label)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('inspector.size')}</span>
        <input
          type="number"
          min={1}
          max={circuit.numQubits}
          value={op.targets.length}
          onChange={(e) => {
            if (!commit(resizeCustom(circuit, op.id, Number(e.target.value)))) notify(t('editor.cannotPlace'));
          }}
          className={`${field} w-20`}
        />
      </label>
    </>
  );
}

export default function Inspector() {
  const { t } = useTranslation();
  const op = useStore((s) => s.circuit.operations.find((o) => o.id === s.selectedId));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{t('inspector.title')}</h2>
      {!op ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('inspector.none')}</p>
      ) : (
        <div className="space-y-3" key={op.id}>
          <div className="flex items-baseline justify-between">
            <span className="font-mono font-semibold">{GATES[op.gate].label}</span>
            <span className="text-xs text-slate-500">{t('inspector.step', { n: op.column + 1 })}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{GATES[op.gate].description}</p>
          {op.params.map((p, i) => (
            <AngleInput key={`${i}:${p}`} op={op} index={i} />
          ))}
          {op.gate === 'MEASURE' && <BasisPicker op={op} />}
          {op.gate === 'CUSTOM' ? (
            <CustomFields op={op} />
          ) : (
            op.targets.length + op.controls.length > 1 && (
              <div className="space-y-1.5">
                {op.controls.map((_, i) => (
                  <WireSelect key={`c${i}`} op={op} role="controls" index={i} />
                ))}
                {op.targets.map((_, i) => (
                  <WireSelect key={`t${i}`} op={op} role="targets" index={i} />
                ))}
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => {
              const { circuit, commit } = useStore.getState();
              commit(removeOperation(circuit, op.id));
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-300 px-2 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/50"
          >
            <Trash2 size={14} />
            {t('inspector.delete')}
          </button>
        </div>
      )}
    </section>
  );
}
