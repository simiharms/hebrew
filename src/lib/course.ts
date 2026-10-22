// The course: numbered units in grammar order, like a university Hebrew
// textbook. Each unit bundles a grammar lesson, a text to read, a scene to
// listen to, verbs to drill and a writing task, then a short unit check.
import type { Level } from '../content/types.ts';
import { emails, grammar, readings, scenes, verbById } from './content.ts';
import type { AppState } from './store.ts';

export interface Unit {
  title: string;
  titleHe: string;
  level: Level;
  goal: string; // what you can do after the unit
  grammar: string[];
  read: string[];
  listen: string[];
  write?: string;
  verbs: string[];
  numbers?: boolean;
}

export const UNITS: Unit[] = [
  {
    title: 'Roots and the present tense',
    titleHe: 'שורשים וזמן הווה',
    level: 'A2+',
    goal: 'Recognise word families and talk about what you do every day.',
    grammar: ['g_roots', 'g_paal'],
    read: ['r_a2p_first_week'],
    listen: ['s_first_day_names'],
    write: 'e_intro_team',
    verbs: ['verb_laavod', 'verb_lagur', 'verb_likhtov', 'verb_lishmoa'],
  },
  {
    title: 'Me, you, mine: את and prepositions',
    titleHe: 'אותי, לי, שלי',
    level: 'A2+',
    goal: 'Use אותי / לי / איתי / שלי correctly instead of “את אני” and “עם אני”.',
    grammar: ['g_et_pronouns', 'g_prep_suffixes'],
    read: ['r_a2p_friday_dinner'],
    listen: ['s_roommates_milk'],
    write: 'e_reschedule',
    verbs: ['verb_lifgosh', 'verb_laazor', 'verb_lishol', 'verb_latet'],
  },
  {
    title: 'Describing things and places',
    titleHe: 'שם עצם ושם תואר',
    level: 'A2+',
    goal: 'Make adjectives agree and use ה correctly: הדירה החדשה.',
    grammar: ['g_adjectives'],
    read: ['r_a2p_apartment_ad', 'r_a2p_building_notice'],
    listen: ['s_falafel_stand'],
    write: 'e_sick_day',
    verbs: ['verb_liknot', 'verb_leekhol', 'verb_lishtot', 'verb_lirtsot'],
  },
  {
    title: 'The verb system: seven binyanim',
    titleHe: 'שבעת הבניינים',
    level: 'A2+',
    goal: 'Recognise which binyan a verb is in, and what that says about its meaning.',
    grammar: ['g_binyanim_map', 'g_piel'],
    read: ['r_a2p_shuk_morning'],
    listen: ['s_doctor_appointment'],
    verbs: ['verb_ledaber', 'verb_lekhakot', 'verb_leshalem', 'verb_levakesh'],
  },
  {
    title: 'Numbers, prices and time',
    titleHe: 'מספרים, מחירים ושעות',
    level: 'B1',
    goal: 'Count with the right gender, understand prices and phone numbers, tell the time.',
    grammar: ['g_numbers'],
    read: ['r_a2p_new_bus_line'],
    listen: ['s_weather_traffic'],
    write: 'e_quote_request',
    verbs: ['verb_lehagia', 'verb_lehatkhil', 'verb_linsoa'],
    numbers: true,
  },
  {
    title: "Hif'il: making things happen",
    titleHe: 'בניין הפעיל',
    level: 'B1',
    goal: 'Use common hif\'il verbs: להתחיל, להמשיך, להזמין, להחליט.',
    grammar: ['g_hifil'],
    read: ['r_b1_work_from_home'],
    listen: ['s_standup_delay'],
    write: 'e_followup',
    verbs: ['verb_lehamshikh', 'verb_lehazmin', 'verb_lehakhlit', 'verb_lehasbir'],
  },
  {
    title: 'Smichut: noun + noun',
    titleHe: 'סמיכות',
    level: 'B1',
    goal: 'Build and read noun chains: חדר ישיבות, ישיבת הצוות.',
    grammar: ['g_smichut'],
    read: ['r_b1_renting_apartment'],
    listen: ['s_internet_support'],
    write: 'e_landlord_repair',
    verbs: ['verb_letapel', 'verb_letaken', 'verb_levatel', 'verb_lekabel'],
  },
  {
    title: "Hitpa'el and nif'al",
    titleHe: 'התפעל ונפעל',
    level: 'B1',
    goal: 'Use reflexive and passive-like verbs: להתקשר, להשתמש, להיפגש, להיכנס.',
    grammar: ['g_hitpael', 'g_nifal'],
    read: ['r_b1_dugri'],
    listen: ['s_startup_interview'],
    write: 'e_day_off',
    verbs: ['verb_lehitkasher', 'verb_lehishtamesh', 'verb_lehipagesh', 'verb_lehikanes'],
  },
  {
    title: 'Weak roots',
    titleHe: 'גזרות',
    level: 'B1',
    goal: 'Stop being surprised by לקום, לתת, לשבת, לקנות — the “irregular” verbs.',
    grammar: ['g_weak_roots'],
    read: ['r_b1_coffee_culture'],
    listen: ['s_friday_dinner'],
    verbs: ['verb_lakum', 'verb_lashevet', 'verb_latset', 'verb_lakakhat', 'verb_ladaat'],
  },
  {
    title: 'Who, which, when: ש-clauses and time',
    titleHe: 'משפטי ש ומילות זמן',
    level: 'B1',
    goal: 'Join ideas with ש, כש, מה ש and talk about already / not yet / since.',
    grammar: ['g_relative_she', 'g_time_aspect'],
    read: ['r_b1_ulpan_to_sales'],
    listen: ['s_morning_show_chef'],
    verbs: ['verb_lehavin', 'verb_lehakhin', 'verb_lizkor', 'verb_lakhzor'],
  },
  {
    title: 'Must, can, should',
    titleHe: 'צריך, אפשר, כדאי',
    level: 'B1',
    goal: 'Give advice, ask permission and talk about obligations at work.',
    grammar: ['g_modals'],
    read: ['r_b1_shared_scooters'],
    listen: ['s_office_party_budget'],
    write: 'e_complaint',
    verbs: ['verb_lehishaer', 'verb_lehizaher', 'verb_leherashem'],
  },
  {
    title: 'If and would',
    titleHe: 'משפטי תנאי',
    level: 'B1+',
    goal: 'Negotiate politely: “אם הייתם…”, “הייתי שמח/ה אם…”.',
    grammar: ['g_conditionals'],
    read: ['r_b1p_salary_negotiation', 'r_b1p_cancel_plan'],
    listen: ['s_asking_for_raise'],
    write: 'e_interview_thanks',
    verbs: ['verb_lehatsia', 'verb_lehitnatsel', 'verb_lehityaets'],
  },
  {
    title: 'Connecting ideas',
    titleHe: 'מילות קישור',
    level: 'B1+',
    goal: 'Argue a point with לכן, למרות ש, לעומת זאת, כלומר.',
    grammar: ['g_connectors'],
    read: ['r_b1p_business_culture', 'r_b1p_family_budget'],
    listen: ['s_freelancer_first_year'],
    write: 'e_delay_apology',
    verbs: ['verb_lehitkonen', 'verb_lehitanyen'],
  },
  {
    title: 'Formal Hebrew for work',
    titleHe: 'לשון רשמית',
    level: 'B1+',
    goal: 'Write emails that sound professional: אשמח אם, בהמשך ל, מצורף.',
    grammar: ['g_formal_register'],
    read: ['r_b1p_ceo_reorg_email'],
    listen: ['s_supplier_zoom_deal'],
    write: 'e_negotiation',
    verbs: ['verb_lenahel', 'verb_lehashkia'],
  },
  {
    title: 'Verbal nouns and the business press',
    titleHe: 'שמות פעולה',
    level: 'B1+',
    goal: 'Read headlines built from nouns: הגעה, השקעה, ביטול, התפתחות.',
    grammar: ['g_verbal_nouns'],
    read: ['r_b1p_startup_funding', 'r_b2_ai_small_business'],
    listen: ['s_news_prices_shekel'],
    write: 'e_event_invite',
    verbs: ['verb_lehashkia', 'verb_lehakhlit'],
  },
  {
    title: 'The passive and news Hebrew',
    titleHe: 'סביל ושפת החדשות',
    level: 'B2',
    goal: 'Follow news reports: הוחלט, אושר, נחתם, צפוי.',
    grammar: ['g_passive'],
    read: ['r_b2_interest_rates', 'r_b2_light_rail'],
    listen: ['s_radio_parking_policy'],
    verbs: [],
  },
  {
    title: 'Opinion and argument',
    titleHe: 'דעה וטיעון',
    level: 'B2',
    goal: 'Read op-eds and interviews and answer with your own argument.',
    grammar: [],
    read: ['r_b2_hybrid_work', 'r_b2_water_tech', 'r_b2_founder_interview'],
    listen: ['s_board_launch_delay', 's_apartment_contract_lawyer'],
    verbs: [],
  },
];

export interface UnitStep {
  id: string; // content id, or "unit:<n>:verbs" / ":numbers" / ":check"
  kind: 'grammar' | 'read' | 'listen' | 'write' | 'verbs' | 'numbers' | 'check';
  title: string;
  route: string;
}

/** The steps of a unit, skipping anything whose content isn't installed. */
export function unitSteps(u: Unit, n: number): UnitStep[] {
  const steps: UnitStep[] = [];
  for (const id of u.grammar) {
    const g = grammar.find((x) => x.id === id);
    if (g) steps.push({ id, kind: 'grammar', title: g.title, route: `grammar/${id}` });
  }
  for (const id of u.read) {
    const r = readings.find((x) => x.id === id);
    if (r) steps.push({ id, kind: 'read', title: r.titleEn, route: `read/${id}` });
  }
  for (const id of u.listen) {
    const s = scenes.find((x) => x.id === id);
    if (s) steps.push({ id, kind: 'listen', title: s.titleEn, route: `listen/${id}` });
  }
  const verbs = u.verbs.filter((id) => verbById.has(id));
  if (verbs.length) steps.push({ id: `unit:${n}:verbs`, kind: 'verbs', title: `Verbs: ${verbs.map((id) => verbById.get(id)!.inf).join(', ')}`, route: `session/unit/${n}` });
  if (u.numbers) steps.push({ id: 'numbers', kind: 'numbers', title: 'Numbers by ear and in writing', route: 'numbers' });
  if (u.write) {
    const e = emails.find((x) => x.id === u.write);
    if (e) steps.push({ id: `${e.id}:w`, kind: 'write', title: e.title, route: `write/${e.id}` });
  }
  steps.push({ id: `unit:${n}:check`, kind: 'check', title: 'Unit check', route: `unit/${n}/check` });
  return steps;
}

export function stepDone(s: AppState, step: UnitStep): boolean {
  if (step.kind === 'numbers') return s.days.some((d) => d.tasks.includes('numbers'));
  return !!s.done[step.id];
}

export function unitProgress(s: AppState, n: number): { done: number; total: number } {
  const steps = unitSteps(UNITS[n], n);
  return { done: steps.filter((st) => stepDone(s, st)).length, total: steps.length };
}

/** Where to start in the course for a given overall level. */
export function startUnitForLevel(level: Level): number {
  const i = UNITS.findIndex((u) => u.level === level);
  return Math.max(0, i);
}

/** The unit to work on now: the learner's current unit, or the next unfinished one. */
export function currentUnit(s: AppState): number {
  for (let n = s.courseUnit; n < UNITS.length; n++) {
    const p = unitProgress(s, n);
    if (p.done < p.total) return n;
  }
  return Math.min(s.courseUnit, UNITS.length - 1);
}
