import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { back, go } from '../lib/router.ts';
import { speak, ttsSupported } from '../lib/tts.ts';

export function TopBar({ title, backTo, right }: { title: string; backTo?: string | true; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <div class="topbar-inner">
        {backTo && (
          <button class="icon-btn" aria-label="Back" onClick={() => (backTo === true ? back() : go(backTo))}>
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
  { id: 'today', label: 'Today', ico: '☀️' },
  { id: 'words', label: 'Words', ico: '🌱' },
  { id: 'read', label: 'Read', ico: '📰' },
  { id: 'listen', label: 'Listen', ico: '📺' },
  { id: 'practice', label: 'Practice', ico: '✍️' },
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
      aria-label="Listen"
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

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
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

/** Minimal formatter for lesson text: paragraphs, "• " bullets, **bold**. */
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

const HEB_RUN = /([֐-׿][֐-׿\s"'״׳\-־.,?!/()]*[֐-׿]|[֐-׿])/g;

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p) => {
    const bold = p.startsWith('**') && p.endsWith('**');
    const body = bold ? p.slice(2, -2) : p;
    const pieces = body.split(HEB_RUN).map((x, i) =>
      i % 2 === 1 ? (
        <span class="he" dir="rtl" style={{ fontSize: '1.15em' }}>
          {x}
        </span>
      ) : (
        x
      ),
    );
    return bold ? <strong>{pieces}</strong> : <>{pieces}</>;
  });
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
