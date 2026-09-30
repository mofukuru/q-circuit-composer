import { useDraggable } from '@dnd-kit/core';
import { addCustomGate, GATES, type GateName, removeCustomGate } from '@qcc/core';
import { Plus, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DragItem } from '../drag';
import MathText from './MathText';
import { useStore } from '../store';
import { gateTone } from './gateStyle';

const GROUPS: { key: 'single' | 'multi' | 'measure'; gates: GateName[] }[] = [
  { key: 'single', gates: ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ'] },
  { key: 'multi', gates: ['CNOT', 'CY', 'CZ', 'CRX', 'CRY', 'CRZ', 'SWAP', 'CCX', 'CSWAP'] },
  { key: 'measure', gates: ['MEASURE'] },
];

function PaletteItem({ gate, customId, label, title }: { gate: GateName; customId?: string; label: ReactNode; title: string }) {
  const item: DragItem = { kind: 'palette', gate, customId };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${gate}:${customId ?? ''}`, data: item });
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const armed = tool?.gate === gate && tool.customId === customId;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      title={title}
      aria-pressed={armed}
      onClick={() => setTool(armed ? null : { gate, customId })}
      className={`flex h-10 min-w-10 touch-none items-center justify-center rounded-md border px-2 font-mono text-sm font-semibold shadow-sm transition select-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${gateTone(gate)} ${armed ? 'ring-2 ring-sel ring-offset-2 ring-offset-canvas' : ''} ${isDragging ? 'opacity-40' : ''}`}
    >
      {label}
    </button>
  );
}

/** Custom gate list and the form to add one. With `listOnly` the gates are plain chips, for when the bar already offers them for dragging. */
export function CustomGates({ listOnly }: { listOnly?: boolean }) {
  const { t } = useTranslation();
  const circuit = useStore((s) => s.circuit);
  const commit = useStore((s) => s.commit);
  const [label, setLabel] = useState('');

  const add = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    commit(addCustomGate(circuit, trimmed));
    setLabel('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {circuit.customGates.map((g) => (
          <div key={g.id} className="flex items-center gap-0.5">
            {listOnly ? (
              <span className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-2 font-mono text-sm font-semibold ${gateTone('CUSTOM')}`}>
                <MathText latex={g.label} />
              </span>
            ) : (
              <PaletteItem gate="CUSTOM" customId={g.id} label={<MathText latex={g.label} />} title={g.label} />
            )}
            <button
              type="button"
              onClick={() => commit(removeCustomGate(circuit, g.id))}
              className="rounded p-0.5 text-faint hover:bg-surface-2 hover:text-ink"
              aria-label={t('palette.removeCustom', { label: g.label })}
              title={t('palette.removeCustom', { label: g.label })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('palette.customPlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-field px-2 py-1 font-mono text-sm"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-sm hover:bg-surface-2"
        >
          <Plus size={14} />
          {t('palette.addCustom')}
        </button>
      </form>
    </div>
  );
}

export default function Palette() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t('palette.title')}</h2>
        <p className="mt-1 text-xs text-muted">{t('palette.hint')}</p>
      </div>
      {GROUPS.map((group) => (
        <div key={group.key}>
          <h3 className="mb-1.5 text-xs font-medium text-muted">{t(`palette.${group.key}`)}</h3>
          <div className="flex flex-wrap gap-1.5">
            {group.gates.map((gate) => (
              <PaletteItem key={gate} gate={gate} label={GATES[gate].label} title={GATES[gate].description} />
            ))}
          </div>
        </div>
      ))}
      <div>
        <h3 className="mb-1.5 text-xs font-medium text-muted">{t('palette.custom')}</h3>
        <CustomGates />
      </div>
    </section>
  );
}

/**
 * Compact palette for narrow screens: every gate in a few wrapped rows, pinned
 * above the circuit so a gate is never more than a short drag away.
 */
export function PaletteBar() {
  const { t } = useTranslation();
  const customGates = useStore((s) => s.circuit.customGates);
  return (
    <section
      aria-label={t('palette.title')}
      data-drop-shield
      className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-line bg-surface shadow-sm"
    >
      {/* Capped so that many custom gates cannot push the circuit off a short screen. */}
      <div data-no-autoscroll className="flex max-h-[40vh] flex-wrap gap-1.5 overflow-y-auto px-4 py-2">
        {GROUPS.flatMap((group) => group.gates).map((gate) => (
          <PaletteItem key={gate} gate={gate} label={GATES[gate].label} title={GATES[gate].description} />
        ))}
        {customGates.map((g) => (
          <PaletteItem key={g.id} gate="CUSTOM" customId={g.id} label={<MathText latex={g.label} />} title={g.label} />
        ))}
      </div>
    </section>
  );
}
