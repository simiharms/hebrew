// The course plan: the 23 lessons of "Et år i Norge" (Randi Rosenvinge
// Schirmer), with the book's lesson titles, places and grammar in the book's
// order. The texts and exercises in src/content are written for this app;
// this plan is what they are written against (and what the validator checks).
//
// The story runs through one year, August to June: Susanne from Freiburg and
// Matthias from Bern start at a summer language course in Oslo; Matthias moves
// to Bergen, Susanne to Tromsø; Christmas in the polar night, Easter at the
// cabin, 17 May in Oslo and midsummer in Tromsø.
import type { Level } from '../content/types.ts';

export interface PlanTopic {
  id: string;
  title: string; // German
  points: string; // what the explanation must cover (for authors and the overview)
}

export interface PlanLesson {
  n: number;
  level: Level;
  title: string; // Norwegian, as in the book
  titleDe: string;
  place: string; // German
  when: string; // German
  story: string; // what happens in the lesson text (English, for authors)
  extra: string[]; // titles of the Landeskunde / extra texts
  wk: string; // title of the Wörterkiste
  grammar: PlanTopic[];
}

export const PLAN: PlanLesson[] = [
  {
    n: 1,
    level: 'A1',
    title: 'På språkkurs i Oslo',
    titleDe: 'Im Sprachkurs in Oslo',
    place: 'Oslo, Blindern',
    when: 'August',
    story:
      'First day of the summer language course at the University of Oslo (Blindern). The teacher Torunn Haugen welcomes the class. Susanne Becker (24, from Freiburg, studies Scandinavian languages) and Matthias Steiner (26, engineer from Bern, Switzerland) introduce themselves; so do Elin (Swedish, Gothenburg) and Mads (Danish, Aarhus). Name, country, city, languages, what they do (study/work), where they live in Oslo (Susanne rents a room, a hybel, at the Nygård family).',
    extra: ['Hva kan man gjøre i Norge?'],
    wk: 'Hvem er du?',
    grammar: [
      { id: 'g01_pronomen', title: 'Personalpronomen (Subjektform)', points: 'jeg, du, han, hun, den, det, vi, dere, de; De (formal, rare today); du-form is normal in Norway.' },
      { id: 'g01_praesens', title: 'Infinitiv und Präsens', points: 'Infinitive with å (å snakke, å bo, å være, å ha). Present = infinitive + -r, the same for all persons (jeg snakker, de snakker). Irregular: er, har, gjør, sier, vet, spør. No ending change by person, unlike German.' },
      { id: 'g01_wortstellung', title: 'Wortstellung im einfachen Hauptsatz', points: 'Subject – verb – rest (Jeg bor i Oslo). The verb stands in second place (V2). Yes/no questions start with the verb (Bor du i Oslo?). Question words first (Hvor bor du?).' },
      { id: 'g01_genus', title: 'Die drei Geschlechter und der unbestimmte Artikel', points: 'en (maskulin), ei (feminin; en is also allowed), et (neutrum): en mann, ei/en jente, et hus. Gender must be learnt with each noun; German gender does not help (et hus = das Haus, but en bil = das Auto).' },
      { id: 'g01_nasjonalitet', title: 'Länder, Sprachen und Nationalitäten', points: 'Tyskland – tysk – en tysker; Sveits – sveitsisk – en sveitser; Østerrike – østerriksk – en østerriker; Norge – norsk – en nordmann; Sverige – svensk – en svenske; Danmark – dansk – en danske. Adjectives and languages are written in lower case. Jeg kommer fra Tyskland. Jeg er tysk / tysker (no article).' },
    ],
  },
  {
    n: 2,
    level: 'A1',
    title: 'Øl og bløtkake',
    titleDe: 'Bier und Sahnetorte',
    place: 'Oslo, ein Café bei Blindern',
    when: 'August',
    story:
      'After class Susanne, Matthias, Elin and Mads go to the cafeteria. Ordering at the counter (Kan jeg få …? Hva koster …?), paying by card, prices (Matthias is shocked by the price of a beer; Mads says it is cheaper in Denmark). Susanne has bløtkake because it is Friday. Small talk about the course.',
    extra: ['Skikk og bruk'],
    wk: 'På kafeteria',
    grammar: [
      { id: 'g02_flertall', title: 'Der unbestimmte Plural', points: 'Most nouns: -er (en bil – biler, ei jente – jenter). Monosyllabic neuter nouns: no ending (et hus – hus, et barn – barn). Nouns in -er: -e (en lærer – lærere). Irregular: en mann – menn, ei bok – bøker, en bror – brødre, et øye – øyne, en sko – sko.' },
      { id: 'g02_inversjon', title: 'Inversion', points: 'When something other than the subject comes first (time, place, object, a subordinate clause), verb and subject swap places: I dag drikker jeg kaffe. Her bor jeg. The verb is always in position 2 – like German, but Norwegian never sends the verb to the end.' },
      { id: 'g02_leddsetning', title: 'Wortstellung im Nebensatz', points: 'Subordinate clauses (at, fordi, når, hvis, om) keep subject – verb order, NO verb at the end (unlike German): …fordi jeg er sulten. Sentence adverbs like ikke go BEFORE the verb in the subordinate clause: …fordi jeg ikke har penger.' },
      { id: 'g02_tall', title: 'Zahlen 0–20 und Preise', points: 'null, en/ett, to, tre, fire, fem, seks, sju (syv), åtte, ni, ti, elleve, tolv, tretten, fjorten, femten, seksten, sytten, atten, nitten, tjue. en krone, kroner; Hva koster det? Det koster femten kroner.' },
    ],
  },
  {
    n: 3,
    level: 'A1',
    title: 'Hallo, Anna!',
    titleDe: 'Hallo, Anna!',
    place: 'Oslo, Sagene: bei Familie Nygård und im Supermarkt',
    when: 'August',
    story:
      'Susanne phones Anna Nygård (25, medical student, daughter of her landlady) – "Hallo, Anna!" – and they agree to cook dinner together. Shopping list, at the supermarket: fish, potatoes, vegetables, bread, brunost; describing food with adjectives (fersk, god, dyr, billig, norsk). Cooking in the Nygårds’ kitchen.',
    extra: ['Norsk mat'],
    wk: 'I butikken',
    grammar: [
      { id: 'g03_adjektiv', title: 'Das Adjektiv: unbestimmte Form', points: 'Agreement with gender and number, attributive and predicative alike: en stor bil / bilen er stor; et stort hus / huset er stort; store biler / bilene er store. Neuter -t, plural -e.' },
      { id: 'g03_ig_sk', title: 'Adjektive auf -ig und -sk', points: 'Adjectives in -ig and multi-syllable adjectives in -sk (incl. all nationalities) take no -t in the neuter: et hyggelig møte, et billig hus, et norsk ord, et praktisk kjøkken; plural -e as usual (hyggelige, norske). One-syllable fersk and frisk do take -t (ferskt brød). Adjectives that already end in consonant + t take nothing (et kort brev, et svart skjerf); after a long vowel the t doubles (søt – søtt).' },
      { id: 'g03_artikkel', title: 'Wegfall des Artikels', points: 'No article with profession, nationality, religion after være/bli: Anna er medisinstudent. Hun er norsk. Matthias er ingeniør. Also in many set phrases: ha bil, ha tid, ta buss.' },
      { id: 'g03_tall', title: 'Zahlen 21–100, Telefonnummern', points: 'tjueen (enogtjue), tjueto …, tretti, førti, femti, seksti, sytti, åtti, nitti, hundre. Both systems exist; the "new" one (tjueen) is standard. Telephone numbers are read in pairs: 22 85 50 50 = tjueto åttifem femti femti.' },
    ],
  },
  {
    n: 4,
    level: 'A1',
    title: 'Skandinaviske venner',
    titleDe: 'Skandinavische Freunde',
    place: 'Oslo, Frognerparken',
    when: 'Ende August',
    story:
      'A picnic in Frognerparken. Elin (Swedish) and Mads (Danish) explain how Scandinavians understand each other ("skandinavisk"); differences in words (Swedish rolig = funny, Norwegian rolig = calm). Matthias asks many questions; Mads gives orders (Kom hit! Ta en kake!). What they can, want to and must do this weekend.',
    extra: ['Norge, Sverige, Danmark og Finland'],
    wk: 'Spørsmål og svar',
    grammar: [
      { id: 'g04_ikke', title: 'ikke und andere Satzadverbien im Hauptsatz', points: 'ikke, aldri, alltid, ofte, også, bare, gjerne stand right after the finite verb: Jeg snakker ikke svensk. With inversion after the subject: I dag kommer han ikke. With a modal verb: Jeg kan ikke komme.' },
      { id: 'g04_imperativ', title: 'Der Imperativ', points: 'Imperative = infinitive without -e (if the infinitive has more than one syllable): snakke – snakk!, komme – kom!, spise – spis! One-syllable verbs stay: gå!, ta!, se! Same for one or many people. Politeness: Vær så snill, … / Kan du …?' },
      { id: 'g04_sporreord', title: 'Fragewörter', points: 'hva, hvem, hvor, hvordan, når, hvorfor, hvor mye, hvor mange, hvor gammel, hva slags. Hvor kommer du fra? Hvem er det? – hv- is pronounced v.' },
      { id: 'g04_modal', title: 'Modalverben', points: 'kan (kunne), vil (ville), skal (skulle), må (måtte), bør (burde): present forms + infinitive WITHOUT å: Jeg vil spise. Jeg må gå. skal = future/plan (Jeg skal reise i morgen). vil ha = möchte haben.' },
    ],
  },
  {
    n: 5,
    level: 'A1',
    title: 'Typisk norsk?',
    titleDe: 'Typisch norwegisch?',
    place: 'Oslo, bei Familie Nygård',
    when: 'Anfang September',
    story:
      'At breakfast with the Nygård family (Kari, Per, Ola, Anna) Susanne writes a list of things that are "typically Norwegian": brunost and the ostehøvel, matpakke, going on tur on Sundays, taking off shoes indoors, kos, dugnad. Per teases her: are Germans not just as typical? Bestemor Ingrid tells a short troll story.',
    extra: ['Troll'],
    wk: 'Hjemme hos familien',
    grammar: [
      { id: 'g05_pronomen', title: 'Alle Formen des Personalpronomens', points: 'Subject/object: jeg – meg, du – deg, han – ham (han), hun – henne, den – den, det – det, vi – oss, dere – dere, de – dem. Object form after verbs and prepositions: Jeg ser henne. Kommer du med oss?' },
      { id: 'g05_den_det', title: 'Die 3. Person: den und det', points: 'Things are den (en/ei-nouns) or det (et-nouns): Bilen er ny. Den er rød. Huset er gammelt. Det er stort. det as formal subject: Det regner. Det er kaldt. Det er Anna.' },
      { id: 'g05_blaa', title: 'Adjektive wie blå, grå, ny', points: 'Adjectives ending in a stressed vowel take -tt in the neuter: blå – blått, grå – grått, ny – nytt, fri – fritt. Plural: blå (blåe), grå, nye. Also: god – godt (one t).' },
      { id: 'g05_refleksiv', title: 'Reflexive Verben', points: 'vaske seg, sette seg, glede seg, kle på seg, legge seg, føle seg: jeg vasker meg, du vasker deg, han/hun vasker seg, vi vasker oss, dere vasker dere, de vasker seg.' },
      { id: 'g05_dobbelkonsonant', title: 'Rechtschreibung: Doppelkonsonanten', points: 'A double consonant at the end of a word is simplified before another consonant: grønn – grønt, tynn – tynt, trygg – trygt; m is never doubled at the end of a word: dum – dumt – dumme, et rom – rommet. ll varies: full – fullt, but snill – snilt.' },
    ],
  },
  {
    n: 6,
    level: 'A2',
    title: 'Gratulerer med dagen!',
    titleDe: 'Herzlichen Glückwunsch zum Geburtstag!',
    place: 'Oslo, Aker brygge',
    when: 'September',
    story:
      'Anna turns 25. The family celebrates in the morning with presents and the birthday song; in the evening friends meet at a restaurant at Aker brygge. Told in the past tense the day after (Susanne writes in her diary): what they did, bought, ate, and how Anna liked the presents.',
    extra: ['To norske barnesanger'],
    wk: 'Gratulerer!',
    grammar: [
      { id: 'g06_bestemt', title: 'Die bestimmte Form des Substantivs', points: 'The article is a suffix: bilen, boka (boken), huset; plural bilene, bøkene, husene (husa). All four forms: en bil – bilen – biler – bilene. Nouns ending in -e: ei jente – jenta – jenter – jentene; et eple – eplet – epler – eplene.' },
      { id: 'g06_er', title: 'Substantive auf -er', points: 'People and agent nouns in -er: en lærer – læreren – lærere – lærerne; en baker – bakeren – bakere – bakerne. Others: en genser – genseren – gensere – genserne.' },
      { id: 'g06_el_en_er', title: 'Adjektive auf -el, -en und -er', points: 'gammel – gammelt – gamle; sulten – sultent – sultne; vakker – vakkert – vakre; enkel – enkelt – enkle. The e drops in the plural and the double consonant is simplified.' },
      { id: 'g06_preteritum', title: 'Präteritum der regelmäßigen Verben', points: 'Four classes: 1 -et (-a): snakke – snakket, vaske – vasket; 2 -te: spise – spiste, kjøpe – kjøpte, lese – leste; 3 -de: prøve – prøvde, leve – levde; 4 -dde: bo – bodde, tro – trodde. Same form for all persons.' },
    ],
  },
  {
    n: 7,
    level: 'A2',
    title: 'Teater og sjalusi',
    titleDe: 'Theater und Eifersucht',
    place: 'Oslo, Nationaltheatret',
    when: 'September',
    story:
      'Susanne, Matthias, Anna and Anna’s boyfriend Jonas see Ibsen’s "Et dukkehjem" at Nationaltheatret. In the break Matthias and Anna talk a lot; Jonas becomes jealous. Afterwards: "Har du sett …? Har du noen gang …?" – what they have experienced; Jonas and Anna make up.',
    extra: ['Henrik Ibsen'],
    wk: 'Følelser',
    grammar: [
      { id: 'g07_perfektum', title: 'Das Perfekt', points: 'har + past participle (all verbs, also motion verbs; er + participle is possible for some motion/change verbs: Han er reist). Participles of regular verbs: snakket, spist, prøvd, bodd. være – har vært, ha – har hatt, gjøre – har gjort.' },
      { id: 'g07_pret_perf', title: 'Präteritum oder Perfekt?', points: 'Präteritum for a finished time (i går, i fjor, da jeg var barn, for to år siden). Perfekt when no time is given, for experience (Har du vært i Bergen?), and for something that continues (Jeg har bodd her i tre uker). German speakers overuse Perfekt in the past – Norwegian is strict.' },
      { id: 'g07_hvilken', title: 'Das Fragepronomen hvilken', points: 'hvilken (m/f), hvilket (n), hvilke (pl): Hvilken buss tar du? Hvilket teater? Hvilke skuespillere? Colloquially often hva for en/et/noen.' },
      { id: 'g07_denne', title: 'Das Demonstrativpronomen denne', points: 'denne (m/f), dette (n), disse (pl) + definite noun: denne bilen, dette huset, disse billettene. Dette er … = Das ist … (for anything).' },
      { id: 'g07_som', title: 'Das Relativpronomen som', points: 'som for all genders and numbers: mannen som sitter der, huset som vi bor i. som can be dropped when it is not the subject: filmen (som) vi så. Prepositions go to the end: stolen som jeg sitter på.' },
    ],
  },
  {
    n: 8,
    level: 'A2',
    title: 'Middag med provokasjon',
    titleDe: 'Abendessen mit Provokation',
    place: 'Oslo, bei Familie Nygård',
    when: 'Ende September',
    story:
      'Sunday dinner at the Nygårds’. Kari’s brother, onkel Arne from Ålesund, provokes everyone: about Germans and punctuality, about oil money, about the young who never eat fish. Susanne answers back politely but firmly. Table manners: Vær så god, Takk for maten, Velbekomme. Timeline of the evening with clock times.',
    extra: ['Takk for maten!'],
    wk: 'Måltider',
    grammar: [
      { id: 'g08_sterke_verb', title: 'Starke und unregelmäßige Verben (Teil 1)', points: 'Most common irregular verbs with presens, preteritum and perfektum: være – er – var – vært; ha – har – hadde – hatt; gjøre – gjør – gjorde – gjort; si – sier – sa – sagt; gå – går – gikk – gått; komme – kom – kommet; se – så – sett; ta – tok – tatt; gi – ga – gitt; få – fikk – fått; drikke – drakk – drukket; sitte – satt – sittet; ligge – lå – ligget; vite – vet – visste – visst; spørre – spør – spurte – spurt.' },
      { id: 'g08_klokka', title: 'Die Uhrzeit', points: 'Hvor mye er klokka? Klokka er tre. kvart over tre (3.15), halv fire (3.30 – half TO four, like German "halb vier"), kvart på fire (3.45), ti over tre, fem på halv fire (3.25), fem over halv fire (3.35). Official: klokka 15.30 (femten tretti).' },
      { id: 'g08_tid', title: 'Zeitangaben: om, for … siden, i, på', points: 'om to timer (in two hours, future), for to timer siden (vor zwei Stunden), i to timer (zwei Stunden lang), på to timer (innerhalb von / in a negation: Jeg har ikke spist på to timer). om morgenen, om kvelden (regularly), i dag, i kveld, i morgen.' },
    ],
  },
  {
    n: 9,
    level: 'A2',
    title: 'Karl Johan eller Champs-Élysées?',
    titleDe: 'Karl Johan oder Champs-Élysées?',
    place: 'Oslo, Karl Johans gate',
    when: 'Ende September',
    story:
      'Matthias has two offers: an internship at a small engineering firm in Bergen, or a job in Paris. Walking down Karl Johans gate from the station to the Royal Palace with Susanne, he compares: the big city or the small, the old house or the new office, school and university in Switzerland, Germany and Norway. He decides on Bergen.',
    extra: ['Karl Johans gate'],
    wk: 'I byen',
    grammar: [
      { id: 'g09_bestemt_adjektiv', title: 'Die bestimmte Form des Adjektivs', points: 'den/det/de + adjective in -e + definite noun (double definiteness): den store bilen, det store huset, de store bilene. liten: den lille bilen, de små bilene. Predicative stays indefinite: Bilen er stor.' },
      { id: 'g09_den_det_de', title: 'Das Demonstrativpronomen den, det, de', points: 'Stressed den/det/de = dieser/jener: Den bilen der er min. Det huset vil jeg se. De skoene er fine. Pointing with her/der: den her, det der.' },
      { id: 'g09_el', title: 'Substantive auf -el', points: 'The e drops before an ending, double consonants are simplified: en sykkel – sykkelen – sykler – syklene; en nøkkel – nøkler; et eksempel – eksempelet – eksempler – eksemplene; en onkel – onkler.' },
      { id: 'g09_genitiv', title: 'Der Genitiv mit -s', points: 'Name/noun + s, without apostrophe: Annas bror, Oslos gater, kongens slott. After the genitive the noun is indefinite: Matthias’ jobb (after s: apostrophe). Colloquially often broren til Anna (lesson 16).' },
      { id: 'g09_prep_sporreord', title: 'Fragewort und Präposition', points: 'The preposition goes to the end of the question: Hvem snakker du med? Hva tenker du på? Hvor kommer du fra? (German: Mit wem …? Woran …?)' },
    ],
  },
  {
    n: 10,
    level: 'A2',
    title: 'Den nye leiligheten til Matthias i Bergen',
    titleDe: 'Matthias’ neue Wohnung in Bergen',
    place: 'Bergen, Sandviken',
    when: 'Oktober',
    story:
      'Matthias has moved to Bergen and writes Susanne a long e-mail about his new flat in an old wooden house in Sandviken: the rooms, what is upstairs and downstairs, the view of the harbour, the rain, the neighbour Fru Solheim. What he did the first week (irregular verbs in the past).',
    extra: ['Bergen og Vestlandet'],
    wk: 'Hjem, kjære hjem',
    grammar: [
      { id: 'g10_uregelmessige', title: 'Überblick: die unregelmäßigen Verben', points: 'Patterns of strong verbs: i – a – u (drikke – drakk – drukket, finne – fant – funnet), i – ei – i (skrive – skrev – skrevet, bite – bet/beit – bitt), y – øy – ø (fly – fløy – fløyet), e – a – å (bære – bar – båret, stjele – stjal – stjålet), a – o – a (fare – for – fart, dra – dro – dratt). Irregular weak: selge – solgte – solgt, fortelle – fortalte – fortalt, legge – la – lagt, sette – satte – satt, gjøre – gjorde – gjort. The list in the app (Verben) has them all.' },
      { id: 'g10_stedsadverb', title: 'Ortsadverbien: inn – inne, ut – ute', points: 'Direction vs. location: inn/inne, ut/ute, opp/oppe, ned/nede, hjem/hjemme, bort/borte, fram/framme. Jeg går ut. Jeg er ute. Han kommer hjem. Han er hjemme.' },
      { id: 'g10_i_paa', title: 'i und på bei Ortsangaben', points: 'i for cities, countries, rooms you are inside (i Bergen, i Norge, i stua, i huset); på for islands, many regions and institutions, kitchen, and surfaces (på Vestlandet, på Island, på kjøkkenet, på kontoret, på universitetet, på badet, på taket). These must partly be learned.' },
    ],
  },
  {
    n: 11,
    level: 'B1',
    title: 'På reise',
    titleDe: 'Auf Reisen',
    place: 'Oslo – Bergen: Bergensbahn, Flåmsbahn, Nærøyfjord',
    when: 'Oktober',
    story:
      'Susanne visits Matthias: Bergensbanen across Hardangervidda, change in Myrdal, Flåmsbana down to Flåm, a boat on Nærøyfjorden, bus to Voss, train to Bergen. Told partly afterwards (she had booked, the train had already left …) and partly as plans for the coming months (Hun skal …, hun kommer til å …).',
    extra: ['Med tog og båt gjennom Norge'],
    wk: 'På reise',
    grammar: [
      { id: 'g11_pluskvamperfektum', title: 'Das Plusquamperfekt', points: 'hadde + past participle: Toget hadde allerede gått da hun kom. Used like German (had done before something else in the past).' },
      { id: 'g11_futurum', title: 'Das Futur', points: 'skal (plan, intention), vil (prediction, will), kommer til å (prediction about what will happen), present + time expression (Jeg reiser i morgen). Det kommer til å regne. Jeg skal besøke ham.' },
      { id: 'g11_noytrum_flertall', title: 'Bestimmter Plural der Neutra', points: 'et hus – husa / husene; et barn – barna; et bein – beina; et fjell – fjella / fjellene; et tog – toga / togene. barn always barna. Both endings are correct Bokmål.' },
      { id: 'g11_ubøyelige', title: 'Unveränderliche Adjektive', points: 'No endings: adjectives in -e (moderne, stille, ekte), in -s (gratis, felles, sams), some loanwords (bra, ekstra, lilla, rosa, orange), and adjectives in unstressed -o/-a: et moderne tog, gratis kaffe, bra folk.' },
      { id: 'g11_kanskje', title: 'Wortstellung mit kanskje', points: 'kanskje at the start does NOT cause inversion: Kanskje jeg kommer i morgen (but inversion is also possible). Inside the clause it is a sentence adverb: Jeg kommer kanskje i morgen.' },
      { id: 'g11_ordenstall', title: 'Ordnungszahlen und Datum', points: 'første, andre, tredje, fjerde, femte, sjette, sjuende, åttende, niende, tiende, ellevte, tolvte, … tjuende, tjueførste. Dates: den 17. mai (syttende mai), 1. januar. Written with a full stop: 3. etasje.' },
    ],
  },
  {
    n: 12,
    level: 'B1',
    title: 'Er det mulig å bli enig?',
    titleDe: 'Kann man sich einigen?',
    place: 'Oslo: Vigelandpark, Bygdøy, Munch-Museum',
    when: 'Oktober',
    story:
      'Matthias is visiting Oslo for a weekend. Susanne, Anna and Jonas try to agree on a Sunday programme: Vigelandsparken (free and outside), the Viking Ship and folk museums on Bygdøy (more interesting? more expensive?), or Munchmuseet (warmer when it rains). Lots of comparing, arguing and compromise.',
    extra: ['To norske kunstnere'],
    wk: 'Å diskutere',
    grammar: [
      { id: 'g12_gradbøying', title: 'Die Steigerung des Adjektivs', points: 'Regular: -ere, -est (billig – billigere – billigst, varm – varmere – varmest). Adjectives in -ig/-som: -st (billigst, morsomst). Long adjectives and participles: mer/mest (mer interessant, mest interessant).' },
      { id: 'g12_sammenligning', title: 'Vergleiche: enn, like … som, så … som', points: 'større enn (größer als), like stor som (genauso groß wie), ikke så stor som (nicht so groß wie), mindre … enn. Pronoun after enn: Hun er eldre enn meg / enn jeg (er).' },
      { id: 'g12_forsterkende', title: 'Verstärkende Adverbien', points: 'veldig, svært, altfor, ganske, temmelig, litt, nokså, utrolig, kjempe- (kjempefin), helt: Det er altfor dyrt. Det var veldig gøy.' },
      { id: 'g12_adverb', title: 'Das Adjektiv als Adverb', points: 'The neuter form of the adjective is used as an adverb: Hun snakker godt norsk. Han kjører fort. Det gikk fint. Adjectives in -ig: hyggelig – Det var hyggelig.' },
    ],
  },
  {
    n: 13,
    level: 'B1',
    title: 'På loppemarked',
    titleDe: 'Auf dem Flohmarkt',
    place: 'Oslo, Flohmarkt in einer Schule',
    when: 'Oktober',
    story:
      'Susanne needs warm clothes before she moves north to Tromsø. With Anna and Ola she goes to the big school loppemarked. Whose is what? Ola’s old skis, Anna’s ski boots, Per’s anorak, a jacket that turns out to be Kari’s favourite. Bargaining and possessives everywhere.',
    extra: ['Dugnad og loppemarked'],
    wk: 'Klær',
    grammar: [
      { id: 'g13_possessiv', title: 'Die Possessivpronomen', points: 'min/mi/mitt/mine, din/di/ditt/dine, hans, hennes, dens/dets, vår/vårt/våre, deres. Usually AFTER the noun, which is then definite: bilen min, boka mi, huset mitt, skoene mine. Before the noun for emphasis: MIN bil. Family words: far min, mor mi (no definite form).' },
    ],
  },
  {
    n: 14,
    level: 'B1',
    title: 'På tur i Jotunheimen',
    titleDe: 'Wandern in Jotunheimen',
    place: 'Jotunheimen, Besseggen',
    when: 'Anfang Oktober',
    story:
      'Before winter, Susanne, Matthias and Anna hike Besseggen above Gjende. Norway’s highest mountains and longest lakes, who is fittest, the best and worst moments, the weather that changes fast. Facts about Norway as "the highest, longest, deepest".',
    extra: ['Friluftsliv og allemannsretten'],
    wk: 'Ut på tur',
    grammar: [
      { id: 'g14_uregelmessig_gradbøying', title: 'Unregelmäßige Steigerung', points: 'god – bedre – best, dårlig – verre – verst, mye – mer – mest, mange – flere – flest, få – færre – færrest, gammel – eldre – eldst, ung – yngre – yngst, stor – større – størst, liten – mindre – minst, lang – lengre – lengst, tung – tyngre – tyngst, høy – høyere – høyest.' },
      { id: 'g14_superlativ', title: 'Der Gebrauch der Steigerungsformen', points: 'Superlative definite with den/det/de + -e: den høyeste toppen, det lengste vannet, de beste turene. Predicative: Denne turen er lengst. Absolute comparative: en eldre dame (an older lady).' },
      { id: 'g14_genitiv_adjektiv', title: 'Das Adjektiv nach Genitiv und Possessiv', points: 'After a genitive or possessive the adjective takes -e and the noun stays indefinite: Norges høyeste fjell, Annas nye sko, min gamle sekk / den gamle sekken min.' },
      { id: 'g14_konjunksjoner', title: 'Beiordnende Konjunktionen', points: 'og, men, eller, for (denn), så (also, deshalb) join main clauses – no change of word order after them: Vi var slitne, men vi gikk videre. Det regnet, så vi ble våte.' },
    ],
  },
  {
    n: 15,
    level: 'B1',
    title: 'En vanlig hverdag hos familien Nygård',
    titleDe: 'Ein ganz normaler Alltag bei Familie Nygård',
    place: 'Oslo, bei Familie Nygård',
    when: 'Ende Oktober',
    story:
      'Susanne’s last week in Oslo. A normal weekday in the Nygård family from 6 a.m. to bedtime: Kari (teacher) and Per (works for the municipality), Ola (16) and his homework, Anna’s night shift practice, bestemor Ingrid who visits. Who does what at home; everyone has their own habits.',
    extra: ['Familie og arbeidsliv i Norge'],
    wk: 'Slekt og familie',
    grammar: [
      { id: 'g15_sin', title: 'Das reflexive Possessivpronomen sin', points: 'sin/si/sitt/sine refers back to the subject of the same clause: Per vasker bilen sin (his own). Per vasker bilen hans (somebody else’s). Never in the subject itself: Per og broren hans … (not *broren sin).' },
      { id: 'g15_ubestemte_pronomen', title: 'Indefinitpronomen', points: 'all/alt/alle, hver/hvert, begge, annen/annet/andre, noen/noe, ingen/ikke noe(n), ingenting/ikke noe. Alle barna, hver dag, begge to, en annen gang, noe brød, noen venner, Jeg har ikke noen penger / ingen penger.' },
      { id: 'g15_synes_tro_tenke', title: 'synes, tro und tenke', points: 'synes = opinion from experience (Jeg synes filmen er god), tro = believe/suppose (Jeg tror det regner i morgen), tenke = think (about), plan (Jeg tenker på deg. Jeg tenker å reise).' },
    ],
  },
  {
    n: 16,
    level: 'B1',
    title: 'Susannes første dag på Universitetet i Tromsø',
    titleDe: 'Susannes erster Tag an der Universität Tromsø',
    place: 'Tromsø, UiT – Norwegens arktische Universität',
    when: 'November',
    story:
      'Susanne starts her exchange semester in Tromsø. Info meeting for international students, the student flat she shares with Inga (23, Sámi from Kautokeino, studies biology), registration, the library, a lecture in Nordic linguistics where the professor speaks northern Norwegian dialect. She notes what she understands and what not.',
    extra: ['Bokmål, nynorsk og norske dialekter'],
    wk: 'Studier',
    grammar: [
      { id: 'g16_genitiv_omskriving', title: 'Genitiv mit Präpositionen', points: 'Instead of -s Norwegian often uses a preposition: faren til Anna, taket på huset, Universitetet i Tromsø, prisen på boka, en venn av meg, slutten av filmen. til for people/owners, på for parts, i for places, av for "from among / of".' },
      { id: 'g16_tid_konjunksjoner', title: 'Temporale Konjunktionen', points: 'da (once in the past: Da jeg kom …), når (whenever, and future: Når jeg kommer …), mens, før, etter at, til, siden, så snart. Main clause after a subordinate clause: inversion (Da jeg kom, var det mørkt).' },
      { id: 'g16_konjunksjoner', title: 'Kausale, konditionale und andere Konjunktionen', points: 'fordi / siden (kausal), hvis / om (konditional), for at (final), så (at) (konsekutiv), selv om (konzessiv), som om / enn (komparativ). Word order: subject – sentence adverb – verb (…selv om hun ikke forsto alt).' },
    ],
  },
  {
    n: 17,
    level: 'B2',
    title: 'Lunefull kjærlighet',
    titleDe: 'Launische Liebe',
    place: 'Hurtigruten, Tromsø – Lofoten',
    when: 'November',
    story:
      'A weekend trip on Hurtigruta from Tromsø to Svolvær in Lofoten. Susanne gets seasick, a crew member, Erik from Svolvær, looks after her; they meet again in Svolvær. Matthias calls from Bergen and is strangely quiet. Erik is charming, but when Susanne wants to meet again he is suddenly busy. Fickle love.',
    extra: ['Hurtigruta og Nord-Norge'],
    wk: 'Jeg er så syk!',
    grammar: [
      { id: 'g17_tidsuttrykk', title: 'Zeitausdrücke mit Präpositionen', points: 'Past – present – future and regular: i fjor / i år / til neste år; i går kveld / i kveld / i morgen tidlig; på mandag (coming) / på mandager (every) / (sist) mandag; i sommer (this summer, past or future), om sommeren (every summer), i jula, i påsken, om natta, for et år siden, om et år, i tre uker, på tre uker.' },
      { id: 'g17_modal_fortid', title: 'Modalverben in der Vergangenheit', points: 'kunne – har kunnet, ville – har villet, skulle – har skullet, måtte – har måttet, burde – har burdet. Hun måtte legge seg. Han burde ha ringt (should have). Jeg kunne ikke komme.' },
      { id: 'g17_fremtid_fortid', title: 'Zukunft in der Vergangenheit', points: 'skulle / ville + infinitive for a future seen from the past: Hun visste at hun skulle reise til Lofoten. Han sa at han ville ringe. Plans that did not happen: Vi skulle møtes, men …' },
    ],
  },
  {
    n: 18,
    level: 'B2',
    title: 'Mørketid og julefeiring',
    titleDe: 'Polarnacht und Weihnachtsfeier',
    place: 'Tromsø',
    when: 'Dezember',
    story:
      'The sun has gone; Tromsø lives with lights, candles and the blue hour. Julebord at the department, lutefisk vs. ribbe, the Christmas market. Matthias comes up to celebrate julaften with Susanne and Inga’s friends: what is done on julaften (presents are opened in the evening, juletrefest, nisse). Things get decorated, baked, sung.',
    extra: ['Jul i Norge'],
    wk: 'God jul!',
    grammar: [
      { id: 'g18_passiv', title: 'Das Passiv', points: 's-passive (present/infinitive, rules, general): Døra lukkes kl. 22. Bøkene må leveres. bli-passive (events, all tenses): Huset ble pyntet. Pakkene blir åpnet. være + participle = state: Butikken er stengt. Agent with av.' },
      { id: 'g18_s_verb', title: 's-Verben mit aktiver Bedeutung', points: 'synes, trives, finnes, lykkes, minnes, mislykkes, svettes, skyldes: Jeg trives i Tromsø. Det finnes mange nisser. Present = infinitive (jeg synes, hun trives), preteritum: syntes, trivdes, fantes, lyktes.' },
      { id: 'g18_slik', title: 'slik und sånn', points: 'slik (written) / sånn (spoken) = so ein, solch: en sånn kake, et sånt hus, sånne julesanger, slike ting. Adverb: Gjør det slik! Sånn er det.' },
    ],
  },
  {
    n: 19,
    level: 'B2',
    title: 'Telefonsamtale og påskeplaner',
    titleDe: 'Ein Telefongespräch und Osterpläne',
    place: 'Tromsø – Trondheim (am Telefon)',
    when: 'Februar/März',
    story:
      'Anna is doing a hospital internship in Trondheim. She and Susanne talk on the phone: Anna reports what her supervisor and the patients said, Susanne reports news from Tromsø (and that Erik has written again). They plan Easter at the Nygårds’ cabin; then Susanne retells the conversation to Inga (indirect speech).',
    extra: ['Trondheim og Nidarosdomen'],
    wk: 'I telefonen',
    grammar: [
      { id: 'g19_indirekte_tale', title: 'Die indirekte Rede', points: 'Statements with at, questions with om (yes/no) or the question word: Hun sier at hun kommer. Hun spurte om jeg kom. Hun lurer på hva vi skal gjøre. Subject question: Hun spør hvem SOM kommer. Tense shift after a past verb (Han sa at han var syk); sentence adverbs before the verb (at hun ikke kunne komme). No subjunctive like German.' },
      { id: 'g19_faa', title: 'få als Hilfsverb', points: 'få + participle = manage to get something done: Jeg fikk ikke gjort leksene. få + infinitive = may / get to: Jeg fikk lov til å … / Får jeg låne telefonen din? få vite = erfahren.' },
      { id: 'g19_presentering', title: 'Präsentierende Sätze mit det', points: 'det + verb + indefinite subject: Det står en mann ved døra. Det bor mange studenter her. Det kommer et brev i morgen. (German: Da steht ein Mann …)' },
      { id: 'g19_utbrytning', title: 'Spaltsätze', points: 'Det er/var … som … to stress a part: Det var Anna som ringte. Det er i påsken vi skal reise. Common in questions: Hvem er det som har spist kaka?' },
    ],
  },
  {
    n: 20,
    level: 'B2',
    title: 'Hyttetur og påskekos – eller omvendt',
    titleDe: 'Hüttenausflug und Ostergemütlichkeit – oder umgekehrt',
    place: 'Die Hütte der Nygårds im Gudbrandsdal',
    when: 'April (Ostern)',
    story:
      'Easter at the Nygårds’ cabin: skiing in the sun, oranges and Kvikk Lunsj, påskekrim on TV and in the milk cartons. Then the weather turns: snowstorm, power cut, the car stuck. "If we had listened to the weather forecast …" In the end the best Easter ever – or the other way round.',
    extra: ['Kos, krim og norsk litteratur'],
    wk: 'Skiftende skydekke',
    grammar: [
      { id: 'g20_irreal', title: 'Irreale Bedingungssätze und Wünsche', points: 'Present unreal: Hvis jeg hadde tid, ville jeg gå på ski (Präteritum + ville). Past unreal: Hvis vi hadde hørt på værmeldingen, ville vi ha blitt hjemme / hadde vi blitt hjemme. Wishes: Jeg skulle ønske at det var sol. Om bare …!' },
      { id: 'g20_preposisjon_infinitiv', title: 'Präposition + Infinitiv oder Nebensatz', points: 'Prepositions can take å + infinitive or an at-clause: Jeg gleder meg til å reise. Hun er redd for at bilen ikke starter. uten å si noe, i stedet for å gå, etter å ha spist. Verbs with fixed prepositions: tenke på, glede seg til, være flink til.' },
    ],
  },
  {
    n: 21,
    level: 'B2',
    title: 'Biltur og krangel på Sørlandskysten',
    titleDe: 'Autofahrt und Streit an der Südküste',
    place: 'Kristiansand – Lillesand – Mandal – Stavanger (Preikestolen)',
    when: 'Mai',
    story:
      'Susanne and Matthias rent a car for a long weekend on the south coast: white wooden towns, narrow roads, a speed camera, a ferry they miss. They quarrel – about the map, his driving, and Erik – and stop talking to each other. At Preikestolen they finally talk, and each admits the other is right about something.',
    extra: ['Sørlandet og Stavanger'],
    wk: 'Bil og trafikk',
    grammar: [
      { id: 'g21_egen', title: 'egen', points: 'egen/eget/egne = own, after a possessive: min egen bil, hennes eget rom, sine egne barn; also with the indefinite: en egen inngang. Plural and definite: egne.' },
      { id: 'g21_resiproke', title: 'Reziproke s-Verben und hverandre', points: 'møtes, sees, treffes, snakkes, høres (Vi snakkes!) = each other; or verb + hverandre: De krangler med hverandre. De så på hverandre. Vi sees i morgen.' },
      { id: 'g21_presens_partisipp', title: 'Das Partizip Präsens', points: '-ende: kjørende, gående, kommende, sovende. Used as an adjective (unchanged: en sovende baby, kommende uke), adverb (Det er overraskende kaldt) and with bli/komme (Hun ble sittende. Han kom løpende).' },
    ],
  },
  {
    n: 22,
    level: 'B2',
    title: 'Hurra for 17. mai!',
    titleDe: 'Hurra für den 17. Mai!',
    place: 'Oslo, Karl Johan und das Schloss',
    when: '17. Mai',
    story:
      'Susanne and Matthias are back in Oslo with the Nygårds for Constitution Day: bunad, champagne breakfast, the children’s parade (barnetoget) up Karl Johan to the palace where the royal family waves, ice cream and hot dogs, russ in red. A short history: 1814, the Constitution at Eidsvoll, 1905. Thoughts on national feeling – Swiss and German perspectives too.',
    extra: ['Kongen og kongefamilien'],
    wk: 'Norsk nasjonalfølelse',
    grammar: [
      { id: 'g22_verbalsubstantiv', title: 'Verbalsubstantive', points: 'From verbs: -ing (en feiring, en forklaring), -ning (en løsning), -else (en opplevelse, en følelse), -sjon (en demonstrasjon), and bare stems (et kjøp, et besøk). Gender: -else and -sjon are masculine (en); -ing/-ning nouns are masculine or feminine (en/ei løsning – løsningen/løsninga).' },
      { id: 'g22_sammensatte_ord', title: 'Zusammengesetzte Substantive', points: 'Written as one word (særskriving is a typical error!): nasjonaldag, barnetog, juletre. Linking -s- or -e-: arbeidsdag, hverdagsliv, barnehage. Gender and inflection come from the last part: et tog → et barnetog, barnetoget.' },
      { id: 'g22_perfektum_partisipp', title: 'Das Partizip Perfekt als Adjektiv', points: 'en pyntet buss, et pyntet hus, pyntede busser / den pyntede bussen (class 1 participles in -et take -ede); strong participles: en stjålet sykkel, et skrevet brev (pl. skrevne / stjålne). Predicative after være/bli: Bordet er dekket.' },
    ],
  },
  {
    n: 23,
    level: 'B2',
    title: 'Sankthans i Tromsø',
    titleDe: 'Mittsommer in Tromsø',
    place: 'Tromsø',
    when: 'Juni',
    story:
      'The midnight sun. Susanne writes a blog post / long e-mail home: sitting and looking at the sea at midnight, the sankthansbål on the beach, Inga’s family in their gákti for a graduation, Matthias who has come up for her last week. Looking back on the year in Norway – what she learned, what she will miss – and what comes next.',
    extra: ['Samene i Norge'],
    wk: 'Noen datauttrykk',
    grammar: [
      { id: 'g23_ligge_staa_sitte', title: 'ligge, stå, sitte + og + Verb', points: 'Norwegian expresses an ongoing action with a position verb: Hun sitter og leser. Vi sto og ventet. Han ligger og sover. Also holde på med å (gerade dabei sein).' },
      { id: 'g23_sammensatte_verb', title: 'Zusammengesetzte Verben', points: 'Particle verbs (separable, particle stressed): stå opp, ta med, legge ned, gi opp, sette opp, finne ut. Fixed compounds (one word, often more formal or figurative): nedlegge (stilllegen), oppgi (angeben), oppfinne. As adjectives the fixed compound is usual: Butikken er nedlagt. en oppsatt plan.' },
    ],
  },
];

export const planByN = new Map(PLAN.map((l) => [l.n, l]));
