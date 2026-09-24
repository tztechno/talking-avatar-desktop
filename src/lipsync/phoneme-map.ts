import type { Viseme } from "./types";

// IPA vowels (as emitted by Kokoro's espeak-style phonemizer) -> viseme
const IPA_VOWELS: Record<string, Viseme> = {
  a: "A", "ɑ": "A", "æ": "A", "ʌ": "A", "ɐ": "A", "ᵻ": "I",
  i: "I", "ɪ": "I", "j": "I",
  u: "U", "ʊ": "U", w: "U",
  e: "E", "ɛ": "E", "ə": "E", "ɚ": "E", "ɜ": "E", "ɝ": "E",
  o: "O", "ɔ": "O", "ɒ": "O",
  // Kokoro diphthong shorthands
  A: "E", I: "A", O: "O", W: "A", Y: "O",
};

const BILABIALS = new Set(["p", "b", "m"]);
const IGNORED = new Set(["ˈ", "ˌ", "ː", "ˑ", "‿", " ", "̃", "̩"]);

/** Converts an IPA phoneme string into a viseme sequence (consonants other than bilabials are dropped). */
export function ipaToVisemes(ipa: string): Viseme[] {
  const out: Viseme[] = [];
  for (const ch of ipa) {
    if (IGNORED.has(ch)) continue;
    if (BILABIALS.has(ch)) out.push("X");
    else if (IPA_VOWELS[ch]) out.push(IPA_VOWELS[ch]);
    else if (/[.,!?;:—…]/.test(ch)) out.push("X");
  }
  return out;
}

// Hiragana / katakana vowel rows
const KANA_ROWS: [Viseme, string][] = [
  ["A", "あかさたなはまやらわがざだばぱぁゃアカサタナハマヤラワガザダバパァャ"],
  ["I", "いきしちにひみりぎじぢびぴぃイキシチニヒミリギジヂビピィ"],
  ["U", "うくすつぬふむゆるぐずづぶぷぅゅゥクスツヌフムユルグズヅブプゥュウ"],
  ["E", "えけせてねへめれげぜでべぺぇエケセテネヘメレゲゼデベペェ"],
  ["O", "おこそとのほもよろをごぞどぼぽぉょオコソトノホモヨロヲゴゾドボポォョ"],
];
const KANA: Map<string, Viseme> = new Map();
for (const [v, chars] of KANA_ROWS) for (const c of chars) KANA.set(c, v);
const KANA_BILABIAL = new Set("まみむめもばびぶべぼぱぴぷぺぽマミムメモバビブベボパピプペポ");

/** Maps a single character (kana, romaji/English letter or other) to a viseme sequence. */
export function charToVisemes(ch: string, prev?: Viseme): Viseme[] {
  const kana = KANA.get(ch);
  if (kana) return KANA_BILABIAL.has(ch) ? ["X", kana] : [kana];
  if (ch === "ん" || ch === "ン") return ["X"];
  // Long-vowel mark and small tsu extend / pause the previous shape
  if (ch === "ー") return prev ? [prev] : [];
  if (ch === "っ" || ch === "ッ") return ["X"];

  const c = ch.toLowerCase();
  if ("aeiou".includes(c)) return [c.toUpperCase() as Viseme];
  if (c === "y") return ["I"];
  if (c === "w") return ["U"];
  if ("pbm".includes(c)) return ["X"];
  // CJK ideographs: no reading available, approximate with an open syllable
  if (/\p{Script=Han}/u.test(ch)) return ["A", "O"];
  return [];
}

/** Viseme sequence for a word of any script (heuristic, used by the Web Speech path). */
export function textToVisemes(text: string): Viseme[] {
  const out: Viseme[] = [];
  for (const ch of text) {
    const vs = charToVisemes(ch, out[out.length - 1]);
    out.push(...vs);
  }
  // Collapse runs of the same viseme to keep motion readable
  return out.filter((v, i) => i === 0 || v !== out[i - 1]);
}

/** How open each shape is at full voice, used to scale mouth openness. */
export const VISEME_OPENNESS: Record<Viseme, number> = {
  X: 0, A: 1, I: 0.45, U: 0.5, E: 0.65, O: 0.8,
};
