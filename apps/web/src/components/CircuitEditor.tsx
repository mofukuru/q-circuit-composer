import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  addOperation,
  circuitDepth,
  createOperation,
  customLabel,
  numClbits,
  type Operation,
  removeOperation,
  setNumColumns,
  setNumQubits,
  setQubitLabel,
  spanOf,
  MAX_QUBITS,
  MAX_COLUMNS,
} from '@qcc/core';
import { Gauge, Minus, Plus } from 'lucide-react';
import { type MouseEvent, type ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CELL, cellId, type Cell, type DragItem, DropPreview, LABEL_WIDTH } from '../drag';
import { prettyAngle } from '../pretty';
import MathText from './MathText';
import { useStore } from '../store';
import { boxLabel, gateTone } from './gateStyle';

const HEADER = 22;
/** Height of a classical bit's row below the qubit wires. */
const CLASSICAL_ROW = 28;

const classicalY = (numQubits: number, bit: number) => HEADER + numQubits * CELL + bit * CLASSICAL_ROW + CLASSICAL_ROW / 2;

const cellStyle = (row: number, col: number) => ({
  left: LABEL_WIDTH + col * CELL,
  top: HEADER + row * CELL,
  width: CELL,
  height: CELL,
});

function GridCell({ row, col }: Cell) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: cellId({ row, col }), data: { row, col } });
  const preview = useContext(DropPreview);
  const tool = useStore((s) => s.tool);
  const hovered = preview?.row === row && preview.col === col;

  const onClick = (e: MouseEvent) => {
    // The grid container deselects on click; a placement must keep the new gate selected.
    e.stopPropagation();
    const { circuit, commit, select, notify } = useStore.getState();
    if (!tool) return select(null);
    const op = createOperation(circuit, tool.gate, col, row, { customId: tool.customId });
    if (op && commit(addOperation(circuit, op))) select(op.id);
    else notify(t('editor.cannotPlace'));
  };

  return (
    <div
      ref={setNodeRef}
      data-cell={`${row}:${col}`}
      onClick={onClick}
      style={cellStyle(row, col)}
      className={`absolute rounded ${tool ? 'cursor-copy hover:bg-amber-400/15' : ''} ${
        hovered ? (preview.ok ? 'bg-emerald-400/25 ring-2 ring-emerald-500/60 ring-inset' : 'bg-rose-400/20 ring-2 ring-rose-500/60 ring-inset') : ''
      }`}
    />
  );
}

/** A draggable piece of an operation: the whole gate or one of its wires. */
function Part({ op, item, row, children, className = '' }: { op: Operation; item: DragItem; row: number; children: ReactNode; className?: string }) {
  const id = item.kind === 'wire' ? `wire:${op.id}:${item.role}:${item.index}` : `op:${op.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: item });
  const selected = useStore((s) => s.selectedId === op.id);
  const select = useStore((s) => s.select);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={op.gate}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        select(op.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const { circuit, commit } = useStore.getState();
        commit(removeOperation(circuit, op.id));
      }}
      style={cellStyle(row, op.column)}
      className={`absolute z-10 flex touch-none items-center justify-center select-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className={`flex items-center justify-center ${selected ? 'rounded-md ring-2 ring-sel ring-offset-1 ring-offset-canvas' : ''} ${className}`}>
        {children}
      </div>
    </div>
  );
}

const Dot = () => <div className="size-3.5 rounded-full bg-ctrl" />;

const Oplus = () => (
  <svg viewBox="0 0 28 28" className="size-7 text-ctrl">
    <circle cx="14" cy="14" r="12" fill="currentColor" />
    <path d="M14 6v16M6 14h16" className="stroke-ctrl-ink" strokeWidth="2.5" />
  </svg>
);

const Cross = () => (
  <svg viewBox="0 0 20 20" className="size-5 text-ctrl">
    <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

function Box({ op, label, sub }: { op: Operation; label: string; sub?: string }) {
  return (
    <div className={`flex h-10 min-w-10 flex-col items-center justify-center rounded-md border px-1 font-mono leading-none shadow-sm ${gateTone(op.gate)}`}>
      <span className="text-sm font-semibold">{label}</span>
      {sub && <span className="mt-0.5 max-w-11 truncate text-[10px] opacity-90">{sub}</span>}
    </div>
  );
}

function OperationView({ op }: { op: Operation }) {
  const circuit = useStore((s) => s.circuit);
  const selected = useStore((s) => s.selectedId === op.id);
  const [lo, hi] = spanOf(op);
  const x = LABEL_WIDTH + op.column * CELL + CELL / 2;
  const wire = (role: 'controls' | 'targets', index: number): DragItem => ({ kind: 'wire', id: op.id, role, index });
  const whole = (row: number): DragItem => ({ kind: 'op', id: op.id, grabWire: row });
  const angle = op.params[0] !== undefined ? prettyAngle(op.params[0]) : undefined;
  const line = hi > lo && op.gate !== 'CUSTOM' && (
    <div
      className={`absolute w-0.5 ${selected ? 'bg-amber-400' : 'bg-ctrl'}`}
      style={{ left: x - 1, top: HEADER + lo * CELL + CELL / 2, height: (hi - lo) * CELL }}
    />
  );

  if (op.gate === 'CUSTOM') {
    const height = (hi - lo) * CELL + 40;
    return (
      <Part op={op} item={whole(lo)} row={lo} className="self-start">
        <div
          className={`mt-1.5 flex w-11 items-center justify-center rounded-md border font-mono text-sm font-semibold shadow-sm ${gateTone('CUSTOM')}`}
          style={{ height }}
        >
          <span className="truncate px-0.5">
            <MathText latex={customLabel(circuit, op)} />
          </span>
        </div>
      </Part>
    );
  }

  if (op.gate === 'MEASURE') {
    return (
      <Part op={op} item={whole(op.targets[0])} row={op.targets[0]}>
        <div className={`flex h-10 w-10 flex-col items-center justify-center rounded-md border shadow-sm ${gateTone('MEASURE')}`}>
          <Gauge size={18} />
          <span className="font-mono text-[10px] leading-none">{op.basis ?? 'Z'}</span>
        </div>
      </Part>
    );
  }

  if (op.controls.length === 0 && op.targets.length === 1) {
    return (
      <Part op={op} item={whole(op.targets[0])} row={op.targets[0]}>
        <Box op={op} label={boxLabel(op.gate)} sub={angle} />
      </Part>
    );
  }

  const target = (index: number) => {
    if (op.gate === 'SWAP' || op.gate === 'CSWAP') return <Cross />;
    if (op.gate === 'CNOT' || op.gate === 'CCX') return <Oplus />;
    if (op.gate === 'CZ') return <Dot />;
    return <Box op={op} label={boxLabel(op.gate)} sub={index === 0 ? angle : undefined} />;
  };

  return (
    <>
      {line}
      {op.controls.map((w, i) => (
        <Part key={`c${i}`} op={op} item={wire('controls', i)} row={w} className="p-1.5">
          <Dot />
        </Part>
      ))}
      {op.targets.map((w, i) => (
        <Part key={`t${i}`} op={op} item={wire('targets', i)} row={w} className="p-0.5">
          {target(i)}
        </Part>
      ))}
    </>
  );
}

/** The double line from a measurement, or a classically controlled gate, down to its classical bit. */
function ClassicalLink({ op }: { op: Operation }) {
  const numQubits = useStore((s) => s.circuit.numQubits);
  const bit = op.gate === 'MEASURE' ? op.classicalTarget : op.condition?.bit;
  if (bit === undefined) return null;
  const x = LABEL_WIDTH + op.column * CELL + CELL / 2;
  const top = HEADER + spanOf(op)[1] * CELL + CELL / 2;
  const bottom = classicalY(numQubits, bit);
  return (
    <>
      <div className="pointer-events-none absolute w-[5px] border-x border-ctrl" style={{ left: x - 2.5, top, height: bottom - top }} />
      {op.condition && (
        <div
          className={`pointer-events-none absolute size-2.5 rounded-full border border-ctrl ${op.condition.value ? 'bg-ctrl' : 'bg-surface'}`}
          style={{ left: x - 5, top: bottom - 5 }}
        />
      )}
    </>
  );
}

function ClassicalWire({ bit }: { bit: number }) {
  const numQubits = useStore((s) => s.circuit.numQubits);
  const y = classicalY(numQubits, bit);
  return (
    <>
      <div className="absolute h-[5px] border-y border-wire" style={{ left: LABEL_WIDTH, right: 8, top: y - 2.5 }} />
      <div
        className="absolute left-0 flex items-center justify-end px-1 font-serif text-base"
        style={{ top: y - CLASSICAL_ROW / 2, width: LABEL_WIDTH - 8, height: CLASSICAL_ROW }}
      >
        <MathText latex={`c_{${bit}}`} />
      </div>
    </>
  );
}

function WireLabel({ wire }: { wire: number }) {
  const { t } = useTranslation();
  const label = useStore((s) => s.circuit.qubitLabels[wire]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const finish = () => {
    setEditing(false);
    const { circuit, commit } = useStore.getState();
    if (draft.trim() && draft !== label) commit(setQubitLabel(circuit, wire, draft.trim()));
  };

  const style = { top: HEADER + wire * CELL, width: LABEL_WIDTH - 8, height: CELL };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label={t('editor.editLabel', { wire })}
        className="absolute left-0 rounded border border-accent bg-field px-1 font-mono text-xs"
        style={{ ...style, top: style.top + (CELL - 32) / 2, height: 32 }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(label);
        setEditing(true);
      }}
      title={t('editor.editLabel', { wire })}
      className="absolute left-0 truncate rounded px-1 text-right font-serif text-base hover:bg-surface-2"
      style={style}
    >
      <MathText latex={label} />
    </button>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { t } = useTranslation();
  const btn = 'rounded p-1 hover:bg-surface-2 disabled:opacity-30';
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${t('editor.remove')} ${label}`}>
        <Minus size={14} />
      </button>
      <span className="w-6 text-center font-mono tabular-nums">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${t('editor.add')} ${label}`}>
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function CircuitEditor() {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const commit = useStore((s) => s.commit);
  const tool = useStore((s) => s.tool);
  const width = LABEL_WIDTH + circuit.numColumns * CELL + 8;
  const clbits = numClbits(circuit);
  const height = HEADER + circuit.numQubits * CELL + clbits * CLASSICAL_ROW;

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 className="font-semibold">{t('editor.title')}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Stepper label={t('editor.qubits')} value={circuit.numQubits} min={1} max={MAX_QUBITS} onChange={(n) => commit(setNumQubits(circuit, n))} />
          <Stepper label={t('editor.steps')} value={circuit.numColumns} min={1} max={MAX_COLUMNS} onChange={(n) => commit(setNumColumns(circuit, n))} />
          <span className="text-sm text-muted" title={t('editor.depthHelp')}>
            {t('editor.depth')} <span className="font-mono tabular-nums">{circuitDepth(circuit)}</span>
          </span>
        </div>
      </div>
      {tool && (
        <p className="border-b border-amber-300/50 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('palette.placing', { gate: tool.gate === 'CUSTOM' ? 'U' : tool.gate })}
        </p>
      )}
      <div className="overflow-x-auto p-3">
        <div className="relative" style={{ width, height }} onClick={() => useStore.getState().select(null)}>
          {Array.from({ length: circuit.numColumns }, (_, col) => (
            <div key={col} className="absolute text-center font-mono text-[10px] text-faint" style={{ left: LABEL_WIDTH + col * CELL, width: CELL, top: 2 }}>
              {col + 1}
            </div>
          ))}
          {Array.from({ length: circuit.numQubits }, (_, row) => (
            <div key={row}>
              <div
                className="absolute h-px bg-wire"
                style={{ left: LABEL_WIDTH, right: 8, top: HEADER + row * CELL + CELL / 2 }}
              />
              <WireLabel key={circuit.qubitLabels[row]} wire={row} />
              {Array.from({ length: circuit.numColumns }, (_, col) => (
                <GridCell key={col} row={row} col={col} />
              ))}
            </div>
          ))}
          {Array.from({ length: clbits }, (_, bit) => (
            <ClassicalWire key={bit} bit={bit} />
          ))}
          {circuit.operations.map((op) => (
            <ClassicalLink key={op.id} op={op} />
          ))}
          {circuit.operations.map((op) => (
            <OperationView key={op.id} op={op} />
          ))}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-faint">{t('editor.hint')}</p>
    </section>
  );
}
