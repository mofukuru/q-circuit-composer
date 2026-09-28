import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GATES, removeOperation } from '@qcc/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CircuitEditor from './components/CircuitEditor';
import { gateTone } from './components/gateStyle';
import Header from './components/Header';
import Inspector from './components/Inspector';
import OutputPanel from './components/OutputPanel';
import Palette from './components/Palette';
import { applyDrop, type Cell, type DragItem, DropPreview } from './drag';
import { useStore } from './store';

function useTheme() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Leave keys to text fields; sliders and checkboxes have no undo of their own.
      if (target.closest('input:not([type=range]):not([type=checkbox]), textarea, select, [contenteditable]')) return;
      const { undo, redo, selectedId, circuit, commit, select, setTool } = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        commit(removeOperation(circuit, selectedId));
      } else if (e.key === 'Escape') {
        setTool(null);
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
      {toast}
    </div>
  );
}

const dragLabel = (item: DragItem) => {
  if (item.kind === 'palette') return item.gate;
  return useStore.getState().circuit.operations.find((o) => o.id === item.id)?.gate ?? 'H';
};

export default function App() {
  const { t } = useTranslation();
  const [active, setActive] = useState<DragItem | null>(null);
  const [preview, setPreview] = useState<(Cell & { ok: boolean }) | null>(null);
  // A small movement threshold keeps clicks (select / arm a tool) working on draggable elements.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  useTheme();
  useShortcuts();

  const onDragStart = ({ active }: DragStartEvent) => {
    setActive(active.data.current as DragItem);
    useStore.getState().setTool(null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const cell = over?.data.current as Cell | undefined;
    if (!cell) return setPreview(null);
    setPreview({ ...cell, ok: applyDrop(useStore.getState().circuit, active.data.current as DragItem, cell) !== null });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    setPreview(null);
    const cell = over?.data.current as Cell | undefined;
    if (!cell) return;
    const item = active.data.current as DragItem;
    const { circuit, commit, select, notify } = useStore.getState();
    const next = applyDrop(circuit, item, cell);
    if (!commit(next)) return notify(t('editor.cannotPlace'));
    const added = next!.operations.find((o) => !circuit.operations.some((p) => p.id === o.id));
    select(added?.id ?? (item.kind === 'palette' ? null : item.id));
  };

  const onDragCancel = () => {
    setActive(null);
    setPreview(null);
  };

  const label = active ? dragLabel(active) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <DropPreview.Provider value={preview}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className="space-y-6 panel p-4 lg:self-start">
              <Palette />
              <hr className="border-line" />
              <Inspector />
            </aside>
            <div className="min-w-0 space-y-4">
              <CircuitEditor />
              <OutputPanel />
            </div>
          </main>
        </div>
        <DragOverlay dropAnimation={null}>
          {label && (
            <div className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-2 font-mono text-sm font-semibold shadow-lg ${gateTone(label)}`}>
              {GATES[label].label}
            </div>
          )}
        </DragOverlay>
        <Toast />
      </DropPreview.Provider>
    </DndContext>
  );
}
