import { useEffect, useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { Progress, Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import {
  COUNT_NOUNS,
  type CountNoun,
  countNoun,
  numberWords,
  phoneWords,
  priceWords,
  timeWords,
  yearWords,
} from '../lib/numbers.ts';
import { record } from '../lib/skills.ts';
import { addMistake, markDone, markTask } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

interface ListenItem {
  label: string;
  say: string;
  answer: string;
  matches: (input: string) => boolean;
}

const digitsOnly = (s: string) => s.replace(/\D/g, '');

function parseAmount(s: string): number {
  const cleaned = s.replace(/[₪\s]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '');
  return parseFloat(cleaned);
}

function genListen(): ListenItem {
  const kind = pick(['price', 'price', 'phone', 'time', 'time', 'count', 'year', 'big']);
  switch (kind) {
    case 'price': {
      const sh = pick([ri(2, 20), ri(21, 99), ri(100, 499)]);
      const ag = pick([0, 0, 0, 50, 90]);
      return {
        label: 'Price (₪)',
        say: `זה עולה ${priceWords(sh, ag)}`,
        answer: ag ? `${sh}.${ag}` : `${sh}`,
        matches: (i) => Math.abs(parseAmount(i) - (sh + ag / 100)) < 0.001,
      };
    }
    case 'phone': {
      const p = `05${pick(['0', '2', '3', '4', '5', '8'])}${Array.from({ length: 7 }, () => ri(0, 9)).join('')}`;
      return {
        label: 'Phone number',
        say: `המספר שלי הוא ${phoneWords(p)}`,
        answer: `${p.slice(0, 3)}-${p.slice(3)}`,
        matches: (i) => digitsOnly(i) === p,
      };
    }
    case 'time': {
      const h = ri(7, 22);
      const m = pick([0, 15, 30, 45, 10, 20, 40, 50, 5, 25]);
      return {
        label: 'Time (e.g. 15:45)',
        say: `נתראה ב${timeWords(h, m)}`,
        answer: `${h}:${String(m).padStart(2, '0')}`,
        matches: (i) => {
          const mm = i.match(/(\d{1,2})\D+(\d{2})/) ?? i.match(/^(\d{1,2})$/);
          if (!mm) return false;
          const H = parseInt(mm[1], 10);
          const M = mm[2] ? parseInt(mm[2], 10) : 0;
          return M === m && (H === h || H + 12 === h || H === h - 12);
        },
      };
    }
    case 'count': {
      const noun = pick(COUNT_NOUNS);
      const n = pick([ri(1, 10), ri(11, 19), ri(20, 60)]);
      return {
        label: `How many ${noun.enPl}?`,
        say: `יש לנו ${countNoun(n, noun)}`,
        answer: `${n}`,
        matches: (i) => digitsOnly(i) === `${n}`,
      };
    }
    case 'year': {
      const y = ri(1948, 2030);
      return { label: 'Year', say: `בשנת ${yearWords(y)}`, answer: `${y}`, matches: (i) => digitsOnly(i) === `${y}` };
    }
    default: {
      const n = pick([ri(1, 9) * 1000 + ri(0, 9) * 100, ri(10, 99) * 1000, ri(100, 999) * 1000, ri(1, 9) * 1e6 + ri(0, 9) * 1e5]);
      return {
        label: 'Budget (₪)',
        say: `התקציב הוא ${numberWords(n, 'm')} שקלים`,
        answer: n.toLocaleString('en-US'),
        matches: (i) => digitsOnly(i) === `${n}`,
      };
    }
  }
}

interface WriteItem {
  prompt: string;
  promptEn: string;
  accepted: string[];
  explain: string;
}

function countExplain(n: number, noun: CountNoun): string {
  const gender = noun.g === 'm' ? 'masculine' : 'feminine';
  const trap = noun.trap ? ` (${noun.trap})` : '';
  if (n === 1) return `“${noun.sg}” is ${gender}${trap}. “One” comes after the noun and agrees: ${noun.g === 'm' ? 'אחד' : 'אחת'}.`;
  if (n === 2 && noun.dual) return `Days, weeks, months, years, hours and “times” have a special dual form: ${noun.dual}.`;
  if (n === 2) return `“Two” before a noun: שני (m) / שתי (f). “${noun.sg}” is ${gender}${trap}.`;
  return `“${noun.sg}” is ${gender}${trap}, so the number is the ${gender} form${noun.g === 'm' ? ' (the one ending in ה for 3–10)' : ' (no ה for 3–10)'}.`;
}

function minuteVariants(h24: number, m: number): string[] {
  const base = timeWords(h24, m, false);
  const out = [base];
  const hourWord = timeWords(h24, 0, false);
  if (m === 5) out.push(`${hourWord} וחמש`, `${hourWord} וחמש דקות`);
  if (m === 10) out.push(`${hourWord} ועשר`, `${hourWord} ועשר דקות`);
  if (m === 15) out.push(`${hourWord} וחמש עשרה`, `${hourWord} ורבע שעה`);
  if (m === 30) out.push(`${hourWord} ושלושים`);
  if (m === 45) out.push(`${hourWord} וארבעים וחמש`);
  if (m === 0) out.push(`${hourWord} בדיוק`);
  return out;
}

function genWrite(): WriteItem {
  const kind = pick(['count', 'count', 'count', 'price', 'time']);
  if (kind === 'price') {
    const sh = pick([ri(1, 20), ri(21, 99), ri(100, 999)]);
    return {
      prompt: `₪${sh}`,
      promptEn: `${sh} shekels`,
      accepted: [priceWords(sh)],
      explain: 'שקל is masculine: 3–10 take the ה form (שלושה שקלים). Colloquially you will often hear the feminine forms, but this is the standard.',
    };
  }
  if (kind === 'time') {
    const h = ri(1, 12);
    const m = pick([0, 15, 30, 45, 20, 10]);
    return {
      prompt: `${h}:${String(m).padStart(2, '0')}`,
      promptEn: 'Say the time (no need for morning/evening)',
      accepted: minuteVariants(h, m),
      explain: 'Hours use feminine numbers (השעה שלוש). :15 = ורבע, :30 = וחצי, :45 = רבע ל… (quarter to the next hour).',
    };
  }
  const noun = pick(COUNT_NOUNS);
  const n = pick([1, 2, ri(3, 10), ri(3, 10), ri(11, 19), ri(20, 99)]);
  return {
    prompt: `${n} × ${noun.sg}`,
    promptEn: `${n} ${n === 1 ? noun.en : noun.enPl}`,
    accepted: [countNoun(n, noun)],
    explain: countExplain(n, noun),
  };
}

const ROUNDS = 10;

export function NumbersPage({ unitId }: { unitId?: string }) {
  const [mode, setMode] = useState<'listen' | 'write'>('listen');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [seed, setSeed] = useState(0);
  const listenItem = useMemo(() => genListen(), [seed, mode]);
  const writeItem = useMemo(() => genWrite(), [seed, mode]);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [okListen, setOkListen] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode === 'listen' && round < ROUNDS) setTimeout(() => speak(listenItem.say), 150);
  }, [listenItem]);
  useEffect(() => {
    if (round !== ROUNDS) return;
    markTask('numbers');
    // Opened from a course unit: that unit's numbers step is done.
    if (unitId) {
      markDone(`unit:${unitId}:numbers`, score / ROUNDS);
      markTask(`unit:${unitId}:numbers`);
    }
  }, [round]);

  const reset = (m: 'listen' | 'write') => {
    setMode(m);
    setRound(0);
    setScore(0);
    setValue('');
    setResult(null);
    setOkListen(null);
    setSeed((x) => x + 1);
  };

  const next = () => {
    setRound((r) => r + 1);
    setValue('');
    setResult(null);
    setOkListen(null);
    setSeed((x) => x + 1);
  };

  const check = () => {
    if (!value.trim()) return;
    if (mode === 'listen') {
      const ok = listenItem.matches(value);
      setOkListen(ok);
      record('numbers', ok ? 1 : 0, ['numbers:listen']);
      record('listening', ok ? 1 : 0, [], 0.5);
      if (ok) setScore((s) => s + 1);
      else addMistake({ kind: 'number', ref: `listen:${listenItem.say}`, prompt: listenItem.say, answer: listenItem.answer, given: value });
    } else {
      const r = checkHebrew(value, writeItem.accepted, { strict: true });
      setResult(r);
      if (r.verdict === 'latin') return;
      record('numbers', r.verdict === 'correct' ? 1 : 0, ['numbers:write', 'g_numbers']);
      if (r.verdict !== 'wrong') {
        setScore((s) => s + 1);
        speak(r.expected);
      } else addMistake({ kind: 'number', ref: `write:${writeItem.prompt}`, prompt: `${writeItem.prompt} (${writeItem.promptEn})`, answer: writeItem.accepted[0], given: value });
    }
  };

  const answered = mode === 'listen' ? okListen !== null : !!result && result.verdict !== 'latin';

  return (
    <>
      <TopBar title="Numbers" backTo="practice" />
      <main class="page">
        <div class="row">
          <Seg
            value={mode}
            options={[
              { v: 'listen', label: '👂 Listen → digits' },
              { v: 'write', label: '✍️ Write in words' },
            ]}
            onChange={reset}
          />
        </div>
        <div class="mt">
          <Progress value={round / ROUNDS} />
        </div>
        {round >= ROUNDS ? (
          <div class="card center">
            <h2>
              {score}/{ROUNDS}
            </h2>
            <p class="muted">Numbers are where real conversations break down — a few rounds a day pays off fast.</p>
            <button class="btn primary" onClick={() => reset(mode)}>
              Another round
            </button>
          </div>
        ) : mode === 'listen' ? (
          <div class="card">
            <div class="badge">{listenItem.label}</div>
            <div class="prompt-box">
              <button class="btn primary" onClick={() => speak(listenItem.say)}>
                🔊 Play
              </button>{' '}
              <button class="btn ghost" onClick={() => speak(listenItem.say, { rate: 0.6 })}>
                🐢 Slow
              </button>
            </div>
            <input
              class={`answer ltr ${okListen === null ? '' : okListen ? 'ok' : 'bad'}`}
              inputMode="decimal"
              value={value}
              placeholder="Type the number"
              onInput={(e) => setValue((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && (answered ? next() : check())}
              autocomplete="off"
            />
            {okListen !== null && (
              <div class={`feedback ${okListen ? 'ok' : 'bad'}`}>
                <strong>{okListen ? '✓ Correct' : `✗ It was ${listenItem.answer}`}</strong>
                <div class="he he-md mt" style={{ color: 'var(--text)' }}>
                  {listenItem.say}
                </div>
              </div>
            )}
            <div class="btn-row">
              {!answered ? (
                <button class="btn primary" onClick={check} disabled={!value.trim()}>
                  Check
                </button>
              ) : (
                <button class="btn primary" onClick={next}>
                  Next →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div class="card">
            <div class="prompt-box">
              <div class="he he-xl" style={{ textAlign: 'center' }}>
                {writeItem.prompt}
              </div>
              <div class="hint">{writeItem.promptEn}</div>
            </div>
            <AnswerInput value={value} onInput={setValue} onEnter={answered ? next : check} autoFocus status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : result.verdict === 'latin' ? '' : 'bad'} />
            {result && <Feedback result={result} extra={answered && <div class="small mt" style={{ color: 'var(--text)' }}>{writeItem.explain}</div>} />}
            {answered && <SpeakBtn text={writeItem.accepted[0]} small />}
            <div class="btn-row">
              {!answered ? (
                <button class="btn primary" onClick={check} disabled={!value.trim()}>
                  Check
                </button>
              ) : (
                <button class="btn primary" onClick={next}>
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
