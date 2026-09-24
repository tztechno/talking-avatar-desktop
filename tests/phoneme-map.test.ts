import { describe, expect, it } from "vitest";
import { charToVisemes, ipaToVisemes, textToVisemes } from "../src/lipsync/phoneme-map";

describe("ipaToVisemes", () => {
  it("maps vowels and closes on bilabials", () => {
    // "hello, mama" roughly
    expect(ipaToVisemes("həlˈoʊ, mˈɑːmə")).toEqual(["E", "O", "U", "X", "X", "A", "X", "E"]);
  });
  it("ignores stress and length marks", () => {
    expect(ipaToVisemes("ˈiː")).toEqual(["I"]);
  });
});

describe("kana and letters", () => {
  it("maps each kana row", () => {
    expect(textToVisemes("かきくけこ")).toEqual(["A", "I", "U", "E", "O"]);
    expect(textToVisemes("カキクケコ")).toEqual(["A", "I", "U", "E", "O"]);
  });
  it("closes lips for m/b/p kana and ん", () => {
    expect(charToVisemes("ま")).toEqual(["X", "A"]);
    expect(charToVisemes("ん")).toEqual(["X"]);
  });
  it("extends the previous vowel for ー", () => {
    expect(charToVisemes("ー", "O")).toEqual(["O"]);
  });
  it("handles English words", () => {
    expect(textToVisemes("Hello")).toEqual(["E", "O"]);
    expect(textToVisemes("bob")).toEqual(["X", "O", "X"]);
  });
  it("collapses repeated shapes", () => {
    expect(textToVisemes("ああああ")).toEqual(["A"]);
  });
});
