export interface Sentence {
  text: string;
  /** Offset of the sentence's first character in the original text */
  start: number;
}

// Sentence terminators for English and Japanese, plus newlines
const TERMINATORS = /[.!?。！？…]+["'”’」』)]*\s*|\n+/g;

/** Splits text into trimmed sentences, keeping their offsets in the source for highlighting. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let last = 0;
  const push = (end: number) => {
    const raw = text.slice(last, end);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ text: trimmed, start: last + lead });
  };
  for (const m of text.matchAll(TERMINATORS)) {
    const end = m.index + m[0].length;
    // Avoid splitting decimals like "3.14" or abbreviations immediately followed by a letter
    if (m[0].startsWith(".") && /\S/.test(text[end] ?? "") && m[0].trim() === m[0]) continue;
    push(end);
    last = end;
  }
  push(text.length);
  return out;
}
