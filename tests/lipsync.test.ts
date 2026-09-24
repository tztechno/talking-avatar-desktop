import { describe, expect, it } from "vitest";
import { guessVisemeFromBands } from "../src/lipsync/audio-lipsync";
import { EventLipSync } from "../src/lipsync/event-lipsync";
import { Blinker } from "../src/avatar/blink";

describe("audio lip-sync helpers", () => {
  it("guesses shapes from bands", () => {
    expect(guessVisemeFromBands(1, 1, 1.5)).toBe("I");
    expect(guessVisemeFromBands(7, 2, 1)).toBe("U");
    expect(guessVisemeFromBands(4, 4, 2)).toBe("A");
  });
});

describe("EventLipSync", () => {
  it("opens on a word and rests afterwards", () => {
    const ls = new EventLipSync("hello world", 1);
    ls.start(0);
    ls.word(0, 5, 0.1);
    const seen = new Set<string>();
    let maxOpen = 0;
    for (let t = 0.1; t < 0.6; t += 1 / 60) {
      const m = ls.frame(t);
      seen.add(m.viseme);
      maxOpen = Math.max(maxOpen, m.open);
    }
    expect(seen.has("E") || seen.has("O")).toBe(true);
    expect(maxOpen).toBeGreaterThan(0.3);
    let last = ls.frame(0.6);
    for (let t = 0.6; t < 1.5; t += 1 / 60) last = ls.frame(t);
    expect(last.viseme).toBe("X");
  });

  it("falls back to a talking loop when no boundaries arrive", () => {
    const ls = new EventLipSync("こんにちは", 1);
    ls.start(0);
    const seen = new Set<string>();
    for (let t = 0; t < 2; t += 1 / 60) seen.add(ls.frame(t).viseme);
    expect(seen.size).toBeGreaterThan(2);
  });

  it("stays closed when not speaking", () => {
    const ls = new EventLipSync("hi", 1);
    expect(ls.frame(1).viseme).toBe("X");
  });
});

describe("Blinker", () => {
  it("blinks within the configured interval", () => {
    const b = new Blinker(2, 2, 0.16, () => 0.5);
    expect(b.eyes(1)).toBe("open");
    const frames = [];
    for (let t = 2; t < 2.2; t += 0.02) frames.push(b.eyes(t));
    expect(frames).toContain("closed");
    expect(b.eyes(2.5)).toBe("open");
  });
});
