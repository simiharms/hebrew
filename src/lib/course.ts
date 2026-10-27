// The course: numbered units in grammar order, like a university Hebrew
// textbook. Each unit bundles a grammar lesson, a text to read, a scene to
// listen to, verbs to drill and a writing task, then a short unit check.
import type { Level } from '../content/types.ts';
import { emails, grammar, readings, scenes, verbById } from './content.ts';
import { deckById } from './decks.ts';
import type { AppState } from './store.ts';

export interface Unit {
  id: string; // stable id: progress is saved under it (unit:<id>:check)
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
  deck?: string; // a card deck to study (decks.ts), e.g. the alphabet
}

export const UNITS: Unit[] = [
  // ---------- A1: first steps (alphabet → simple sentences) ----------
  {
    id: 'u_a1_letters',
    title: 'Letters and sounds',
    titleHe: 'האלף-בית',
    level: 'A1',
    goal: 'Read and write all the letters, including the final forms, and say hello.',
    grammar: ['g_alphabet'],
    read: ['r_a1_signs'],
    listen: ['s_a1_shalom'],
    verbs: [],
    deck: 'alpha',
  },
  {
    id: 'u_a1_hello',
    title: 'Hello, who are you?',
    titleHe: 'שלום, מי אתה?',
    level: 'A1',
    goal: 'Introduce yourself and ask who, what and where — no verb “to be” needed.',
    grammar: ['g_a1_pronouns'],
    read: ['r_a1_about_me'],
    listen: ['s_a1_ulpan_first_day'],
    write: 'e_a1_about_me',
    verbs: [],
    deck: 't:basics',
  },
  {
    id: 'u_a1_family',
    title: 'Family: masculine, feminine, plural',
    titleHe: 'המשפחה שלי',
    level: 'A1',
    goal: 'Talk about your family with the right gender and plural endings.',
    grammar: ['g_a1_gender_plural'],
    read: ['r_a1_my_family'],
    listen: ['s_a1_family_photo'],
    verbs: [],
    deck: 't:family',
  },
  {
    id: 'u_a1_present',
    title: 'What do you do? The present tense',
    titleHe: 'זמן הווה',
    level: 'A1',
    goal: 'Describe your day with the four present-tense forms.',
    grammar: ['g_a1_present'],
    read: ['r_a1_my_day'],
    listen: ['s_a1_cafe_order'],
    verbs: ['verb_laavod', 'verb_lagur', 'verb_lilmod', 'verb_leekhol', 'verb_lishtot'],
  },
  {
    id: 'u_a1_have',
    title: 'Having: יש, אין and של',
    titleHe: 'יש, אין, של',
    level: 'A1',
    goal: 'Say what there is, what you have and whose it is.',
    grammar: ['g_a1_yesh_ein_shel'],
    read: ['r_a1_apartment_rooms'],
    listen: ['s_a1_new_apartment_tour'],
    verbs: ['verb_lirtsot', 'verb_leehov'],
    deck: 't:home',
  },
  {
    id: 'u_a1_where',
    title: 'Where? ב, ל, מ and the article',
    titleHe: 'איפה? לאן? מאיפה?',
    level: 'A1',
    goal: 'Ask the way and say where you are, where you go and where you come from.',
    grammar: ['g_a1_prep_article'],
    read: ['r_a1_way_to_ulpan'],
    listen: ['s_a1_directions'],
    verbs: ['verb_lalekhet', 'verb_lavo', 'verb_linsoa'],
    deck: 't:city',
  },
  {
    id: 'u_a1_numbers',
    title: 'Numbers, days and times',
    titleHe: 'מספרים, ימים ושעות',
    level: 'A1',
    goal: 'Count to twenty, tell the time and read a schedule.',
    grammar: ['g_a1_numbers_basic'],
    read: ['r_a1_schedule'],
    listen: ['s_a1_opening_hours'],
    verbs: ['verb_liftoakh', 'verb_lisgor', 'verb_lakum'],
    numbers: true,
    deck: 't:numbers',
  },
  {
    id: 'u_a1_plans',
    title: 'I want to…: the infinitive',
    titleHe: 'אני רוצה ל…',
    level: 'A1',
    goal: 'Make plans with want to, can, need to and like to.',
    grammar: ['g_a1_infinitive'],
    read: ['r_a1_weekend_plans'],
    listen: ['s_a1_plans_friday'],
    write: 'e_a1_whatsapp_plans',
    verbs: ['verb_likro', 'verb_lirot', 'verb_lakhshov'],
  },
  // ---------- A2: past, future, requests ----------
  {
    id: 'u_a2_past',
    title: "Yesterday: the past tense of pa'al",
    titleHe: 'זמן עבר',
    level: 'A2',
    goal: 'Tell what you did yesterday and last weekend.',
    grammar: ['g_a2_past_paal'],
    read: ['r_a2_last_weekend'],
    listen: ['s_a2_what_did_you_do'],
    write: 'e_a2_weekend_message',
    verbs: ['verb_ligmor', 'verb_lishkoakh', 'verb_likhtov', 'verb_lishmoa'],
  },
  {
    id: 'u_a2_shopping',
    title: 'How much? Questions and quantities',
    titleHe: 'כמה זה עולה?',
    level: 'A2',
    goal: 'Ask questions of all kinds and shop for exactly what you need.',
    grammar: ['g_a2_questions'],
    read: ['r_a2_supermarket_flyer'],
    listen: ['s_a2_market_prices'],
    verbs: ['verb_liknot', 'verb_leshalem', 'verb_laalot', 'verb_livkhor'],
    deck: 't:shopping',
  },
  {
    id: 'u_a2_future',
    title: 'Tomorrow: the future tense',
    titleHe: 'זמן עתיד',
    level: 'A2',
    goal: 'Make plans and talk about tomorrow, next week and next year.',
    grammar: ['g_a2_future_paal'],
    read: ['r_a2_trip_plans'],
    listen: ['s_a2_weather_tomorrow'],
    write: 'e_a2_trip_email',
    verbs: ['verb_lishon', 'verb_lakhzor', 'verb_lihyot'],
  },
  {
    id: 'u_a2_imperative',
    title: 'Do this! Requests and instructions',
    titleHe: 'ציווי ובקשות',
    level: 'A2',
    goal: 'Follow and give instructions, and ask politely.',
    grammar: ['g_a2_imperative'],
    read: ['r_a2_recipe_shakshuka'],
    listen: ['s_a2_cooking_class'],
    verbs: ['verb_lasim', 'verb_lakakhat', 'verb_lekhakot', 'verb_levashel'],
  },
  {
    id: 'u_a2_compare',
    title: 'Better, cheaper, the best',
    titleHe: 'יותר, פחות, הכי',
    level: 'A2',
    goal: 'Compare things and say what you prefer.',
    grammar: ['g_a2_comparison'],
    read: ['r_a2_phone_review'],
    listen: ['s_a2_which_phone'],
    write: 'e_a2_invitation_reply',
    verbs: ['verb_lehaadif', 'verb_lehamlits', 'verb_livkhor'],
  },
  {
    id: 'u_a2_feelings',
    title: 'It hurts! Feelings and health',
    titleHe: 'כואב לי',
    level: 'A2',
    goal: 'Say how you feel, describe symptoms and understand advice.',
    grammar: ['g_a2_dative'],
    read: ['r_a2_sick_day_story'],
    listen: ['s_a2_pharmacy'],
    verbs: ['verb_lehargish', 'verb_lanuakh', 'verb_lishon'],
    deck: 't:body',
  },
  // ---------- A2+ to B2 ----------
  {
    id: 'u_roots_present',
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
    id: 'u_et_prepositions',
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
    id: 'u_describing',
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
    id: 'u_binyanim',
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
    id: 'u_numbers_time',
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
    id: 'u_hifil',
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
    id: 'u_smichut',
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
    id: 'u_hitpael_nifal',
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
    id: 'u_weak_roots',
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
    id: 'u_she_time',
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
    id: 'u_modals',
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
    id: 'u_conditionals',
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
    id: 'u_connectors',
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
    id: 'u_formal',
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
    id: 'u_verbal_nouns',
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
    id: 'u_passive',
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
    id: 'u_opinion',
    title: 'Opinion and argument',
    titleHe: 'דעה וטיעון',
    level: 'B2',
    goal: 'Read op-eds and interviews and answer with your own argument.',
    grammar: [],
    read: ['r_b2_hybrid_work', 'r_b2_water_tech', 'r_b2_founder_interview'],
    listen: ['s_board_launch_delay', 's_apartment_contract_lawyer'],
    verbs: [],
  },
  // ---------- C1: formal, literary and nuanced Hebrew ----------
  {
    id: 'u_c1_formal',
    title: 'Formal and literary syntax',
    titleHe: 'תחביר רשמי',
    level: 'C1',
    goal: 'Read and write formal Hebrew: אשר, הנו, על מנת, בעקבות.',
    grammar: ['g_c1_formal_syntax', 'g_c1_construct_advanced'],
    read: ['r_c1_language_essay'],
    listen: ['s_c1_panel_language'],
    write: 'e_c1_formal_letter',
    verbs: [],
    deck: 't:academic',
  },
  {
    id: 'u_c1_passive',
    title: "Pu'al and huf'al: the full passive",
    titleHe: 'פועל והופעל',
    level: 'C1',
    goal: 'Understand reports and lectures full of הוקם, פותח, מומן.',
    grammar: ['g_c1_pual_hufal'],
    read: ['r_c1_annual_report'],
    listen: ['s_c1_lecture_history'],
    verbs: [],
    deck: 't:civics',
  },
  {
    id: 'u_c1_hedging',
    title: 'Maybe, apparently, had it been: hedging',
    titleHe: 'הסתייגות ותנאי שלא התקיים',
    level: 'C1',
    goal: 'Hedge claims and talk about what would have happened.',
    grammar: ['g_c1_hedging'],
    read: ['r_c1_science_feature'],
    listen: ['s_c1_radio_expert'],
    write: 'e_c1_complaint_ombudsman',
    verbs: [],
  },
  {
    id: 'u_c1_idioms',
    title: 'Idioms, slang and nuance',
    titleHe: 'ניבים וסלנג',
    level: 'C1',
    goal: 'Catch irony, idioms and register shifts.',
    grammar: ['g_c1_idioms_register'],
    read: ['r_c1_humor_column'],
    listen: ['s_c1_comedy_podcast'],
    verbs: [],
    deck: 't:idioms',
  },
  {
    id: 'u_c1_argument',
    title: 'Making the case: argument and rhetoric',
    titleHe: 'טיעון ורטוריקה',
    level: 'C1',
    goal: 'Argue, concede and rebut in speech and in writing.',
    grammar: ['g_c1_argument'],
    read: ['r_c1_oped_four_day_week'],
    listen: ['s_c1_board_debate'],
    write: 'e_c1_oped_response',
    verbs: [],
  },
];

export interface UnitStep {
  id: string; // content id, or "unit:<unit id>:verbs" / ":numbers" / ":check"
  kind: 'grammar' | 'read' | 'listen' | 'write' | 'verbs' | 'numbers' | 'deck' | 'check';
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
  if (verbs.length) steps.push({ id: `unit:${u.id}:verbs`, kind: 'verbs', title: `Verbs: ${verbs.map((id) => verbById.get(id)!.inf).join(', ')}`, route: `session/unit/${n}` });
  const deck = u.deck ? deckById(u.deck) : undefined;
  if (deck) steps.push({ id: `deck:${deck.id}`, kind: 'deck', title: `Cards: ${deck.title}`, route: `deck/${deck.id}` });
  if (u.numbers) steps.push({ id: `unit:${u.id}:numbers`, kind: 'numbers', title: 'Numbers by ear and in writing', route: `numbers/unit/${u.id}` });
  if (u.write) {
    const e = emails.find((x) => x.id === u.write);
    if (e) steps.push({ id: `${e.id}:w`, kind: 'write', title: e.title, route: `write/${e.id}` });
  }
  // The check asks the unit's grammar drills and verbs; a unit with neither has no check.
  const drills = u.grammar.some((id) => grammar.find((g) => g.id === id)?.drills.length);
  if (drills || verbs.length) steps.push({ id: `unit:${u.id}:check`, kind: 'check', title: 'Unit check', route: `unit/${n}/check` });
  return steps;
}

export function stepDone(s: AppState, step: UnitStep): boolean {
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
