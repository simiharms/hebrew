import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { back, go } from '../lib/router.ts';
import { speak, ttsSupported } from '../lib/tts.ts';

export function TopBar({ title, backTo, right }: { title: string; backTo?: string | true; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <div class="topbar-inner">
        {backTo && (
          <button class="icon-btn" aria-label="Zurück" onClick={() => (backTo === true ? back() : go(backTo))}>
            ‹
          </button>
        )}
        <h1>{title}</h1>
        {right}
      </div>
    </header>
  );
}

const TABS = [
  { id: 'heute', label: 'Heute', ico: '☀️' },
  { id: 'lektionen', label: 'Lektionen', ico: '📖' },
  { id: 'woerter', label: 'Wörter', ico: '🗂️' },
  { id: 'verben', label: 'Verben', ico: '🔁' },
  { id: 'ueben', label: 'Üben', ico: '✏️' },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav class="tabbar">
      <div class="tabbar-inner">
        {TABS.map((t) => (
          <button class={`tab ${active === t.id ? 'active' : ''}`} onClick={() => go(t.id)} aria-label={t.label}>
            <span class="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function SpeakBtn({ text, gender, label, small }: { text: string; gender?: 'm' | 'f'; label?: string; small?: boolean }) {
  if (!ttsSupported()) return null;
  return (
    <button
      class={`btn ${small ? 'small' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, { gender });
      }}
      aria-label="Anhören"
    >
      🔊{label ? ` ${label}` : ''}
    </button>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div class="progress">
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  return <span class="badge level">{level}</span>;
}

export function Item({
  emoji,
  title,
  sub,
  onClick,
  right,
  done,
}: {
  emoji?: string;
  title: ComponentChildren;
  sub?: ComponentChildren;
  onClick?: () => void;
  right?: ComponentChildren;
  done?: boolean;
}) {
  return (
    <button class={`item ${done ? 'done' : ''}`} onClick={onClick}>
      {emoji && <span class="emoji">{emoji}</span>}
      <span class="grow">
        <div class="title">{title}</div>
        {sub && <div class="sub">{sub}</div>}
      </span>
      {right}
    </button>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="group">
      {options.map((o) => (
        <button class={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

let toastSetter: ((m: string | null) => void) | null = null;

export function toast(msg: string) {
  toastSetter?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div class="toast">{msg}</div> : null;
}

/** Minimal formatter for explanations: paragraphs, "• " bullets, **bold**. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div class="lesson-body">
      {blocks.map((b) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[•\-*]\s/.test(l))) {
          return (
            <ul>
              {lines.map((l) => (
                <li>{inline(l.replace(/^\s*[•\-*]\s/, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p>
            {lines.map((l, i) => (
              <>
                {i > 0 && <br />}
                {/^\s*[•\-*]\s/.test(l) ? <>• {inline(l.replace(/^\s*[•\-*]\s/, ''))}</> : inline(l)}
              </>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p) => (p.startsWith('**') && p.endsWith('**') ? <strong class="no-em">{p.slice(2, -2)}</strong> : p));
}

export function Table({ rows }: { rows: string[][] }) {
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <div class="table-wrap">
      <table class="grid">
        <thead>
          <tr>
            {head.map((h) => (
              <th>{inline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r) => (
            <tr>
              {r.map((c) => (
                <td>{inline(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A destructive action that asks for a second tap instead of a browser dialog. */
export function ConfirmButton({ label, confirmLabel, onConfirm, cls = 'btn small ghost' }: { label: string; confirmLabel: string; onConfirm: () => void; cls?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button class={`${cls} ${armed ? 'danger' : ''}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Enter continues (to the next task) while `active`; inputs are disabled by then. */
export function useEnterKey(onEnter: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      onEnter();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [active, onEnter]);
}

/** Small "DE" toggle that shows a German translation. */
export function DeToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button class={`btn small ghost ${on ? 'on' : ''}`} onClick={onToggle} aria-label="Deutsche Übersetzung">
      DE
    </button>
  );
}
