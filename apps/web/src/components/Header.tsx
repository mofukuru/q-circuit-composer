import { clearOperations, encodeCircuit, parseCircuit, serializeCircuit } from '@qcc/core';
import { Code, FolderOpen, Link2, Monitor, Moon, Redo2, Save, Sun, Trash2, Undo2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type Theme, useStore } from '../store';

export const REPO_URL = 'https://github.com/mofukuru/q-circuit-composer';

const iconBtn =
  'rounded-md p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

export default function Header() {
  const { t, i18n } = useTranslation();
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const theme = useStore((s) => s.theme);
  const { undo, redo, set, notify } = useStore.getState();
  const fileInput = useRef<HTMLInputElement>(null);
  const ThemeIcon = THEME_ICON[theme];

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#c=${encodeCircuit(useStore.getState().circuit)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(t('toolbar.shared'));
    } catch {
      window.prompt(t('toolbar.share'), url);
    }
  };

  const exportJson = () => {
    const blob = new Blob([serializeCircuit(useStore.getState().circuit)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'circuit.json' }).click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      useStore.getState().commit(parseCircuit(await file.text()));
    } catch (e) {
      notify(t('toolbar.importError', { message: (e as Error).message }));
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src="./favicon.svg" alt="" className="size-8" />
          <div>
            <h1 className="leading-tight font-semibold">{t('app.title')}</h1>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">{t('app.tagline')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-0.5">
          <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo} title={`${t('toolbar.undo')} (Ctrl+Z)`} aria-label={t('toolbar.undo')}>
            <Undo2 size={18} />
          </button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo} title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`} aria-label={t('toolbar.redo')}>
            <Redo2 size={18} />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={() => {
              const { circuit, commit } = useStore.getState();
              if (circuit.operations.length > 0 && window.confirm(t('toolbar.clearConfirm'))) commit(clearOperations(circuit));
            }}
            title={t('toolbar.clear')}
            aria-label={t('toolbar.clear')}
          >
            <Trash2 size={18} />
          </button>
          <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" />
          <button type="button" className={iconBtn} onClick={share} title={t('toolbar.share')} aria-label={t('toolbar.share')}>
            <Link2 size={18} />
          </button>
          <button type="button" className={iconBtn} onClick={exportJson} title={t('toolbar.export')} aria-label={t('toolbar.export')}>
            <Save size={18} />
          </button>
          <button type="button" className={iconBtn} onClick={() => fileInput.current?.click()} title={t('toolbar.import')} aria-label={t('toolbar.import')}>
            <FolderOpen size={18} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
          <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" />
          <select
            value={i18n.language.startsWith('ja') ? 'ja' : 'en'}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
            aria-label={t('toolbar.language')}
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
          <button
            type="button"
            className={iconBtn}
            onClick={() => set({ theme: NEXT_THEME[theme] })}
            title={`${t('toolbar.theme')}: ${t(`toolbar.themes.${theme}`)}`}
            aria-label={`${t('toolbar.theme')}: ${t(`toolbar.themes.${theme}`)}`}
          >
            <ThemeIcon size={18} />
          </button>
          <a href={REPO_URL} className={iconBtn} title={t('app.source')} aria-label={t('app.source')} target="_blank" rel="noreferrer">
            <Code size={18} />
          </a>
        </nav>
      </div>
    </header>
  );
}
