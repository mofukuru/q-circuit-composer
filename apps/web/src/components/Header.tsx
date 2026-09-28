import { clearOperations, encodeCircuit, parseCircuit, serializeCircuit } from '@qcc/core';
import { Code, Ellipsis, FolderOpen, Link2, Monitor, Moon, Redo2, Save, Sun, Trash2, Undo2 } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Theme, useStore } from '../store';

export const REPO_URL = 'https://github.com/mofukuru/q-circuit-composer';

const iconBtn =
  'rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

const IMPORT_INPUT_ID = 'qcc-import-json';

const menuItem = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-2';

/** Overflow menu used on narrow screens in place of the toolbar buttons. */
function MoreMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative sm:hidden">
      <button type="button" className={iconBtn} onClick={() => setOpen(!open)} aria-label={label} aria-haspopup="menu" aria-expanded={open}>
        <Ellipsis size={18} />
      </button>
      {open && (
        <div
          role="menu"
          // Close after choosing an action, but not when using the language select.
          onClick={(e) => (e.target as HTMLElement).closest('[role=menuitem]') && setOpen(false)}
          className="absolute top-full right-0 z-40 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

export default function Header() {
  const { t, i18n } = useTranslation();
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const theme = useStore((s) => s.theme);
  const { undo, redo, set, notify } = useStore.getState();
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

  const actions = [
    {
      label: t('toolbar.clear'),
      icon: Trash2,
      onClick: () => {
        const { circuit, commit } = useStore.getState();
        if (circuit.operations.length > 0 && window.confirm(t('toolbar.clearConfirm'))) commit(clearOperations(circuit));
      },
    },
    { label: t('toolbar.share'), icon: Link2, onClick: share },
    { label: t('toolbar.export'), icon: Save, onClick: exportJson },
    { label: t('toolbar.import'), icon: FolderOpen, onClick: () => document.getElementById(IMPORT_INPUT_ID)?.click() },
  ];
  const themeLabel = `${t('toolbar.theme')}: ${t(`toolbar.themes.${theme}`)}`;
  const cycleTheme = () => set({ theme: NEXT_THEME[theme] });
  const languageSelect = (
    <select
      value={i18n.language.startsWith('ja') ? 'ja' : 'en'}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
      aria-label={t('toolbar.language')}
      className="rounded-md border border-line-strong bg-field px-1.5 py-1 text-sm"
    >
      <option value="en">English</option>
      <option value="ja">日本語</option>
    </select>
  );

  return (
    <header className="border-b border-line bg-surface backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src="./favicon.svg" alt="" className="size-8" />
          <div>
            <h1 className="leading-tight font-semibold">{t('app.title')}</h1>
            <p className="hidden text-xs text-muted sm:block">{t('app.tagline')}</p>
          </div>
        </div>
        <nav className="flex items-center gap-0.5">
          <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo} title={`${t('toolbar.undo')} (Ctrl+Z)`} aria-label={t('toolbar.undo')}>
            <Undo2 size={18} />
          </button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo} title={`${t('toolbar.redo')} (Ctrl+Shift+Z)`} aria-label={t('toolbar.redo')}>
            <Redo2 size={18} />
          </button>
          <div className="hidden items-center gap-0.5 sm:flex">
            {actions.map((a, i) => (
              <Fragment key={a.label}>
                {i === 1 && <span className="mx-1 h-5 w-px bg-line-strong" />}
                <button type="button" className={iconBtn} onClick={a.onClick} title={a.label} aria-label={a.label}>
                  <a.icon size={18} />
                </button>
              </Fragment>
            ))}
            <span className="mx-1 h-5 w-px bg-line-strong" />
            {languageSelect}
            <button type="button" className={iconBtn} onClick={cycleTheme} title={themeLabel} aria-label={themeLabel}>
              <ThemeIcon size={18} />
            </button>
            <a href={REPO_URL} className={iconBtn} title={t('app.source')} aria-label={t('app.source')} target="_blank" rel="noreferrer">
              <Code size={18} />
            </a>
          </div>
          <MoreMenu label={t('toolbar.more')}>
            {actions.map((a) => (
              <button key={a.label} type="button" role="menuitem" className={menuItem} onClick={a.onClick}>
                <a.icon size={16} />
                {a.label}
              </button>
            ))}
            <button type="button" role="menuitem" className={menuItem} onClick={cycleTheme}>
              <ThemeIcon size={16} />
              {themeLabel}
            </button>
            <a href={REPO_URL} role="menuitem" className={menuItem} target="_blank" rel="noreferrer">
              <Code size={16} />
              {t('app.source')}
            </a>
            <div className="border-t border-line px-3 py-2">{languageSelect}</div>
          </MoreMenu>
          <input
            id={IMPORT_INPUT_ID}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
        </nav>
      </div>
    </header>
  );
}
