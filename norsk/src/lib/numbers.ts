// Norwegian numbers, clock times, ordinals and years in words.
// Standard ("new") counting: tjueen, tjueto … The old system (enogtjue) is
// accepted as an alternative everywhere.

const ONES = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
const TENS = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti'];

/** 0–99 in words; ett for neuter (ett hus) and for the clock (klokka ett). */
function below100(n: number, opts: { ett?: boolean; old?: boolean } = {}): string {
  if (n < 20) return n === 1 && opts.ett ? 'ett' : ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return TENS[t];
  if (opts.old) return `${o === 1 ? 'en' : ONES[o]}og${TENS[t]}`;
  return `${TENS[t]}${ONES[o]}`;
}

/** 0–999 999 in words: "to hundre og femti", "tusen og fem", "tre tusen fire hundre og tolv". */
export function numberWords(n: number, opts: { ett?: boolean; old?: boolean } = {}): string {
  if (n < 100) return below100(n, opts);
  const parts: string[] = [];
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (th) parts.push(th === 1 ? 'tusen' : `${numberWords(th, { old: opts.old })} tusen`);
  if (h) parts.push(h === 1 ? 'hundre' : `${ONES[h]} hundre`);
  if (rest) parts.push(`og ${below100(rest, opts)}`);
  return parts.join(' ');
}

/** Ways of writing a number that count as right (spacing, ett hundre, old system, syv, tyve). */
export function numberVariants(n: number, opts: { ett?: boolean } = {}): string[] {
  const base = [numberWords(n, opts), numberWords(n, { ...opts, old: true })];
  const out = new Set<string>();
  for (const b of base) {
    out.add(b);
    out.add(b.replace(/\bhundre\b/, 'ett hundre').replace(/^tusen/, 'ett tusen'));
    out.add(b.replace(/sju/g, 'syv'));
  }
  return [...out];
}

/** Compares number words ignoring spaces: "tohundreogfemti" = "to hundre og femti". */
export function sameNumberWords(a: string, b: string): boolean {
  const k = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');
  return k(a) === k(b);
}

// ---------- ordinals ----------

const ORD = ['nullte', 'første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette', 'sjuende', 'åttende', 'niende', 'tiende', 'ellevte', 'tolvte', 'trettende', 'fjortende', 'femtende', 'sekstende', 'syttende', 'attende', 'nittende'];

export function ordinalWords(n: number): string {
  if (n < 20) return ORD[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return `${TENS[t].replace(/e$/, '')}ende`;
  return `${TENS[t]}${ORD[o]}`;
}

export const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
export const WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];

/** "den syttende mai" */
export function dateWords(day: number, month: number): string {
  return `den ${ordinalWords(day)} ${MONTHS[month - 1]}`;
}

// ---------- years ----------

/** 1984 → "nitten åttifire", 1905 → "nitten hundre og fem", 2025 → "to tusen og tjuefem". */
export function yearWords(y: number): string[] {
  const out: string[] = [];
  if (y >= 1100 && y < 2000) {
    const hi = Math.floor(y / 100);
    const lo = y % 100;
    if (lo === 0) out.push(`${below100(hi)} hundre`);
    else if (lo < 10) out.push(`${below100(hi)} hundre og ${below100(lo)}`);
    else out.push(`${below100(hi)} ${below100(lo)}`, `${below100(hi)} hundre og ${below100(lo)}`);
  }
  out.push(numberWords(y));
  if (y >= 2010 && y < 2100) out.push(`tjue ${below100(y % 100)}`);
  return [...new Set(out)];
}

// ---------- clock ----------

const hourWord = (h: number) => below100(((h + 11) % 12) + 1, { ett: true });

/**
 * Everyday clock time in words, in five-minute steps. The first answer is the
 * standard one; ti på halv / tjue over etc. are accepted too.
 *  3:00 klokka tre · 3:15 kvart over tre · 3:30 halv fire · 3:45 kvart på fire
 *  3:20 ti på halv fire · 3:25 fem på halv fire · 3:35 fem over halv fire
 */
export function clockWords(h: number, m: number): string[] {
  const now = hourWord(h);
  const next = hourWord(h + 1);
  switch (m) {
    case 0:
      return [`klokka ${now}`, now, `klokken ${now}`];
    case 5:
      return [`fem over ${now}`];
    case 10:
      return [`ti over ${now}`];
    case 15:
      return [`kvart over ${now}`];
    case 20:
      return [`ti på halv ${next}`, `tjue over ${now}`];
    case 25:
      return [`fem på halv ${next}`];
    case 30:
      return [`halv ${next}`];
    case 35:
      return [`fem over halv ${next}`];
    case 40:
      return [`ti over halv ${next}`, `tjue på ${next}`];
    case 45:
      return [`kvart på ${next}`];
    case 50:
      return [`ti på ${next}`];
    case 55:
      return [`fem på ${next}`];
    default:
      return [`${below100(m)} over ${now}`];
  }
}

/** 24-hour official reading: 15.30 → "femten tretti", 08.05 → "åtte null fem". */
export function clockDigitalWords(h: number, m: number): string {
  const mm = m === 0 ? 'null null' : m < 10 ? `null ${ONES[m]}` : below100(m);
  return `${below100(h)} ${mm}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
