import { type Circuit, type CodeFormat, createCircuit, decodeCircuit, type GateName, parseCircuit, serializeCircuit } from '@qcc/core';
import { create } from 'zustand';

export type ResultMode = 'probs' | 'expval';
export type OutputTab = 'results' | 'code' | 'latex';
export type Theme = 'light' | 'dark' | 'system';

/** A gate chosen in the palette with a click, waiting to be placed with a click on a cell. */
export interface Tool {
  gate: GateName;
  customId?: string;
}

interface Settings {
  shots: number;
  resultMode: ResultMode;
  sampled: boolean;
  tab: OutputTab;
  codeFormat: Exclude<CodeFormat, 'latex'>;
  latexStandalone: boolean;
  theme: Theme;
}

interface State extends Settings {
  circuit: Circuit;
  past: Circuit[];
  future: Circuit[];
  selectedId: string | null;
  tool: Tool | null;
  seed: number;
  toast: string | null;
  notify: (message: string) => void;
  /** Applies an edit and records it for undo. Returns false (and changes nothing) for a null edit. */
  commit: (next: Circuit | null) => boolean;
  /** Shows an edit without recording it, e.g. while a slider is dragged. `settle` records it as one undo step. */
  preview: (next: Circuit) => void;
  settle: () => void;
  /** The circuit before the current run of previews started. */
  draftBase: Circuit | null;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setTool: (tool: Tool | null) => void;
  resample: () => void;
  set: (patch: Partial<Settings>) => void;
}

const HISTORY_LIMIT = 100;
const CIRCUIT_KEY = 'qcc:circuit';
const SETTINGS_KEY = 'qcc:settings';

const DEFAULT_SETTINGS: Settings = {
  shots: 1024,
  resultMode: 'probs',
  sampled: false,
  tab: 'results',
  codeFormat: 'pennylane',
  latexStandalone: false,
  theme: 'system',
};

// Browser storage can be unavailable (private windows, blocked site data), so every access is guarded.
function load<T>(key: string, parse: (raw: string) => T): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** A circuit from a share link (#c=...) wins over the one saved in this browser. */
function initialCircuit(): Circuit {
  const match = /[#&]c=([^&]+)/.exec(window.location.hash);
  if (match) {
    try {
      const circuit = decodeCircuit(match[1]);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return circuit;
    } catch {
      // fall through to the saved circuit
    }
  }
  return load(CIRCUIT_KEY, parseCircuit) ?? createCircuit(3);
}

export const useStore = create<State>((set, get) => ({
  ...DEFAULT_SETTINGS,
  ...load(SETTINGS_KEY, (raw) => JSON.parse(raw) as Partial<Settings>),
  circuit: initialCircuit(),
  past: [],
  future: [],
  selectedId: null,
  tool: null,
  seed: 1,
  toast: null,

  notify: (message) => {
    set({ toast: message });
    setTimeout(() => {
      if (get().toast === message) set({ toast: null });
    }, 2500);
  },
  draftBase: null,
  commit: (next) => {
    if (!next) return false;
    const { circuit, past, selectedId, draftBase } = get();
    set({
      circuit: next,
      past: [...past, draftBase ?? circuit].slice(-HISTORY_LIMIT),
      future: [],
      draftBase: null,
      selectedId: next.operations.some((o) => o.id === selectedId) ? selectedId : null,
    });
    return true;
  },
  preview: (next) => set((s) => ({ circuit: next, draftBase: s.draftBase ?? s.circuit })),
  settle: () => {
    const { draftBase, circuit, commit } = get();
    if (draftBase && draftBase !== circuit) commit(circuit);
    else set({ draftBase: null });
  },
  undo: () => {
    const { circuit, past, future } = get();
    const prev = past.at(-1);
    if (prev) set({ circuit: prev, past: past.slice(0, -1), future: [circuit, ...future], draftBase: null });
  },
  redo: () => {
    const { circuit, past, future } = get();
    const [next, ...rest] = future;
    if (next) set({ circuit: next, past: [...past, circuit], future: rest, draftBase: null });
  },
  select: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
  resample: () => set((s) => ({ seed: s.seed + 1 })),
  set: (patch) => set(patch),
}));

useStore.subscribe((state, prev) => {
  if (state.circuit !== prev.circuit) save(CIRCUIT_KEY, serializeCircuit(state.circuit));
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
  if (keys.some((k) => state[k] !== prev[k])) {
    save(SETTINGS_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, state[k]]))));
  }
});
