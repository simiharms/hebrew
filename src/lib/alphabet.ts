// The alphabet deck: every letter with its name, sound and an example word.
export interface Letter {
  ch: string;
  name: string; // Hebrew name
  nameTr: string;
  sound: string;
  ex: string;
  exTr: string;
  exEn: string;
}

export const LETTERS: Letter[] = [
  { ch: 'א', name: 'אלף', nameTr: 'álef', sound: 'silent or a glottal stop; carries a vowel', ex: 'אבא', exTr: 'ába', exEn: 'dad' },
  { ch: 'ב', name: 'בית', nameTr: 'bet', sound: 'b or v', ex: 'בית', exTr: 'báyit', exEn: 'house' },
  { ch: 'ג', name: 'גימל', nameTr: 'gímel', sound: 'g (ג׳ = j)', ex: 'גם', exTr: 'gam', exEn: 'also' },
  { ch: 'ד', name: 'דלת', nameTr: 'dálet', sound: 'd', ex: 'דג', exTr: 'dag', exEn: 'fish' },
  { ch: 'ה', name: 'הא', nameTr: 'he', sound: 'h (usually silent at the end of a word)', ex: 'הר', exTr: 'har', exEn: 'mountain' },
  { ch: 'ו', name: 'וו', nameTr: 'vav', sound: 'v, or the vowels o / u', ex: 'ורד', exTr: 'véred', exEn: 'rose' },
  { ch: 'ז', name: 'זין', nameTr: 'záyin', sound: 'z (ז׳ = zh)', ex: 'זמן', exTr: 'zman', exEn: 'time' },
  { ch: 'ח', name: 'חית', nameTr: 'khet', sound: 'kh, as in Bach', ex: 'חלב', exTr: 'khaláv', exEn: 'milk' },
  { ch: 'ט', name: 'טית', nameTr: 'tet', sound: 't', ex: 'טוב', exTr: 'tov', exEn: 'good' },
  { ch: 'י', name: 'יוד', nameTr: 'yud', sound: 'y, or the vowels i / e', ex: 'יום', exTr: 'yom', exEn: 'day' },
  { ch: 'כ', name: 'כף', nameTr: 'kaf', sound: 'k or kh', ex: 'כלב', exTr: 'kélev', exEn: 'dog' },
  { ch: 'ך', name: 'כף סופית', nameTr: 'kaf sofít', sound: 'kh: כ at the end of a word', ex: 'דרך', exTr: 'dérekh', exEn: 'way' },
  { ch: 'ל', name: 'למד', nameTr: 'lámed', sound: 'l', ex: 'לחם', exTr: 'lékhem', exEn: 'bread' },
  { ch: 'מ', name: 'מם', nameTr: 'mem', sound: 'm', ex: 'מים', exTr: 'máyim', exEn: 'water' },
  { ch: 'ם', name: 'מם סופית', nameTr: 'mem sofít', sound: 'm: מ at the end of a word', ex: 'שלום', exTr: 'shalóm', exEn: 'hello; peace' },
  { ch: 'נ', name: 'נון', nameTr: 'nun', sound: 'n', ex: 'נר', exTr: 'ner', exEn: 'candle' },
  { ch: 'ן', name: 'נון סופית', nameTr: 'nun sofít', sound: 'n: נ at the end of a word', ex: 'גן', exTr: 'gan', exEn: 'garden' },
  { ch: 'ס', name: 'סמך', nameTr: 'sámekh', sound: 's', ex: 'ספר', exTr: 'séfer', exEn: 'book' },
  { ch: 'ע', name: 'עין', nameTr: 'áyin', sound: 'silent or a glottal stop in most speech; carries a vowel', ex: 'עיר', exTr: 'ir', exEn: 'city' },
  { ch: 'פ', name: 'פא', nameTr: 'pe', sound: 'p or f', ex: 'פה', exTr: 'po', exEn: 'here' },
  { ch: 'ף', name: 'פא סופית', nameTr: 'pe sofít', sound: 'f: פ at the end of a word', ex: 'כסף', exTr: 'késef', exEn: 'money' },
  { ch: 'צ', name: 'צדי', nameTr: 'tsádi', sound: 'ts (צ׳ = ch)', ex: 'צבע', exTr: 'tséva', exEn: 'colour' },
  { ch: 'ץ', name: 'צדי סופית', nameTr: 'tsádi sofít', sound: 'ts: צ at the end of a word', ex: 'עץ', exTr: 'ets', exEn: 'tree' },
  { ch: 'ק', name: 'קוף', nameTr: 'kuf', sound: 'k', ex: 'קפה', exTr: 'kafé', exEn: 'coffee' },
  { ch: 'ר', name: 'ריש', nameTr: 'resh', sound: 'r, from the back of the throat', ex: 'רחוב', exTr: 'rekhóv', exEn: 'street' },
  { ch: 'ש', name: 'שין', nameTr: 'shin', sound: 'sh, sometimes s', ex: 'שמש', exTr: 'shémesh', exEn: 'sun' },
  { ch: 'ת', name: 'תו', nameTr: 'tav', sound: 't', ex: 'תודה', exTr: 'todá', exEn: 'thank you' },
];
