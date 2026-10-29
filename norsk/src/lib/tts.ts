// Text-to-speech with the device's built-in Norwegian voice (free, offline on
// iOS and macOS: "Nora"; Windows and Android have their own).
import { getState } from './store.ts';

let voices: SpeechSynthesisVoice[] = [];
const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

function refresh() {
  if (!synth) return;
  voices = synth.getVoices();
}
if (synth) {
  refresh();
  synth.addEventListener?.('voiceschanged', refresh);
}

export function ttsSupported(): boolean {
  return !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function norwegianVoices(): SpeechSynthesisVoice[] {
  refresh();
  // nb = Bokmål, no = Norwegian, nn = Nynorsk (a Nynorsk voice still reads Bokmål well).
  const nv = voices.filter((v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang));
  const rank = (v: SpeechSynthesisVoice) => (/^nn/i.test(v.lang) ? 2 : 0) + (/enhanced|premium|neural|natural/i.test(v.name) ? -1 : 0);
  return nv.sort((a, b) => rank(a) - rank(b));
}

function pickVoice(gender?: 'm' | 'f'): SpeechSynthesisVoice | undefined {
  const nv = norwegianVoices();
  if (!nv.length) return undefined;
  const preferred = getState().settings.voiceURI;
  const main = nv.find((v) => v.voiceURI === preferred) ?? nv[0];
  if (!gender || nv.length < 2) return main;
  // With several Norwegian voices, male speakers get a male-sounding one (or at least another one).
  const others = nv.filter((v) => v !== main);
  const isMale = (v: SpeechSynthesisVoice) => /\b(male|henrik|jon|finn|aksel|magnus)\b/i.test(v.name) && !/female/i.test(v.name);
  if (gender === 'm') return isMale(main) ? main : others.find(isMale) ?? others[0];
  return !isMale(main) ? main : others.find((v) => !isMale(v)) ?? main;
}

export interface SpeakOpts {
  rate?: number;
  gender?: 'm' | 'f';
  pitch?: number; // used when only one Norwegian voice exists, to tell speakers apart
}

let token = 0;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** iOS only allows speech after a user gesture; call once from a touch handler. */
export function unlockSpeech(): void {
  if (!ttsSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth!.speak(u);
}

async function cancelCurrent(): Promise<void> {
  if (synth!.speaking || synth!.pending) {
    synth!.cancel();
    // WebKit drops an utterance queued immediately after cancel().
    await delay(80);
  }
}

/** Split long text into sentence-sized chunks (some engines cut off long utterances). */
function chunks(text: string): string[] {
  if (text.length <= 180) return [text];
  const parts = text.match(/[^.!?:;\n]+[.!?:;]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) {
      out.push(cur);
      cur = '';
    }
    cur += p;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Speak text; resolves when finished (or cancelled). */
export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!ttsSupported()) return;
  const my = ++token;
  await cancelCurrent();
  for (const c of chunks(text)) {
    if (my !== token) return;
    await speakQueued(c, opts, my);
  }
}

function speakQueued(text: string, opts: SpeakOpts, my: number): Promise<void> {
  return new Promise((resolve) => {
    if (my !== token) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'nb-NO';
    const v = pickVoice(opts.gender);
    if (v) u.voice = v;
    u.rate = opts.rate ?? getState().settings.rate;
    // With a single voice, vary pitch so dialogue speakers sound different.
    if (norwegianVoices().length < 2) {
      if (opts.pitch) u.pitch = opts.pitch;
      else if (opts.gender) u.pitch = opts.gender === 'm' ? 0.8 : 1.15;
    }
    let finished = false;
    let started = false;
    const t0 = Date.now();
    const done = () => {
      if (finished) return;
      finished = true;
      clearInterval(watchdog);
      resolve();
    };
    u.onstart = () => {
      started = true;
    };
    u.onend = done;
    u.onerror = done;
    // Safari sometimes never fires onend; poll as a fallback once speech has had time to start.
    const watchdog = setInterval(() => {
      if (my !== token) return done();
      if ((started || Date.now() - t0 > 3000) && !synth!.speaking && !synth!.pending) done();
    }, 400);
    synth!.speak(u);
  });
}

/** Speak a sequence (e.g. scene lines). onLine is called before each line. */
export async function speakSequence(
  items: { text: string; gender?: 'm' | 'f'; pitch?: number }[],
  opts: { rate?: number; gap?: number; onLine?: (i: number) => void } = {},
): Promise<boolean> {
  if (!ttsSupported()) return false;
  const my = ++token;
  await cancelCurrent();
  for (let i = 0; i < items.length; i++) {
    if (my !== token) return false;
    opts.onLine?.(i);
    for (const c of chunks(items[i].text)) {
      if (my !== token) return false;
      await speakQueued(c, { rate: opts.rate, gender: items[i].gender, pitch: items[i].pitch }, my);
    }
    if (my !== token) return false;
    await new Promise((r) => setTimeout(r, opts.gap ?? 350));
  }
  return my === token;
}

export function stopSpeaking(): void {
  token++;
  synth?.cancel();
}

/** Distinct pitches per speaker so several same-gender speakers sound different with one voice. */
export function speakerPitches(speakers: Record<string, { gender: 'm' | 'f' }>): Record<string, number> {
  const ladders = { f: [1.15, 1.32, 1.0], m: [0.8, 0.95, 0.68] };
  const used = { f: 0, m: 0 };
  const out: Record<string, number> = {};
  for (const [k, sp] of Object.entries(speakers)) {
    const l = ladders[sp.gender];
    out[k] = l[used[sp.gender]++ % l.length];
  }
  return out;
}
