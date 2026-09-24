import { describe, expect, it } from "vitest";
import { splitSentences } from "../src/tts/sentences";

describe("splitSentences", () => {
  it("splits English and keeps offsets", () => {
    const text = "Hello there. How are you?  Fine!";
    const s = splitSentences(text);
    expect(s.map((x) => x.text)).toEqual(["Hello there.", "How are you?", "Fine!"]);
    for (const x of s) expect(text.slice(x.start, x.start + x.text.length)).toBe(x.text);
  });
  it("splits Japanese punctuation", () => {
    expect(splitSentences("こんにちは。元気ですか？はい！").map((x) => x.text)).toEqual(["こんにちは。", "元気ですか？", "はい！"]);
  });
  it("splits on newlines and drops blanks", () => {
    expect(splitSentences("one\n\n two \n").map((x) => x.text)).toEqual(["one", "two"]);
  });
  it("does not split decimals", () => {
    expect(splitSentences("Pi is 3.14 today. Yes.").map((x) => x.text)).toEqual(["Pi is 3.14 today.", "Yes."]);
  });
  it("returns nothing for whitespace", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});
