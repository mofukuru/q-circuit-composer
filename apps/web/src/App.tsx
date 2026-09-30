import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GATES, removeOperation } from '@qcc/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import CircuitEditor from './components/CircuitEditor';
import { gateTone } from './components/gateStyle';
import Header from './components/Header';
import Inspector from './components/Inspector';
import OutputPanel from './components/OutputPanel';
import Palette, { CustomGates, PaletteBar } from './components/Palette';
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

/** Matches Tailwind's `lg` breakpoint, where the sidebar sits beside the circuit. */
const WIDE = '(min-width: 64rem)';

function useWide() {
  return useSyncExternalStore(
    (notify) => {
      const media = matchMedia(WIDE);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => matchMedia(WIDE).matches,
  );
}

/** The pinned palette bar covers cells scrolled beneath it; releasing a gate over the bar must not drop it there. */
const collisionDetection: CollisionDetection = (args) => {
  const p = args.pointerCoordinates;
  const shield = document.querySelector('[data-drop-shield]')?.getBoundingClientRect();
  if (p && shield && p.x >= shield.left && p.x <= shield.right && p.y >= shield.top && p.y <= shield.bottom) return [];
  return rectIntersection(args);
};

/** Dragging out of the palette bar should scroll the page, never the bar itself. */
const autoScroll = { canScroll: (el: Element) => !el.hasAttribute('data-no-autoscroll') };

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
  const wide = useWide();
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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={autoScroll}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <DropPreview.Provider value={preview}>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            {wide ? (
              <aside className="space-y-6 panel self-start p-4">
                <Palette />
                <hr className="border-line" />
                <Inspector />
              </aside>
            ) : (
              <PaletteBar />
            )}
            <div className="min-w-0 space-y-4">
              <CircuitEditor />
              {/* On narrow screens the inspector goes below the circuit, keeping the palette right above it. */}
              {!wide && (
                <aside className="space-y-6 panel p-4">
                  <Inspector />
                  <hr className="border-line" />
                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t('palette.custom')}</h2>
                    <CustomGates listOnly />
                  </section>
                </aside>
              )}
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
