import { textToVisemes, VISEME_OPENNESS } from "./phoneme-map";
import { AttackRelease } from "./smoothing";
import type { LipSync, MouthState, Viseme } from "./types";

// Approximate duration of one mouth shape at speed 1.0 (seconds)
const BASE_SHAPE_SEC = 0.11;
// If no boundary event arrives within this window after start, fall back to a generic loop
const NO_BOUNDARY_TIMEOUT = 0.6;
const LOOP: Viseme[] = ["A", "X", "O", "E", "X", "I", "A", "U", "X"];

interface Scheduled {
  viseme: Viseme;
  at: number;
}

/**
 * Event-driven lip-sync for engines whose audio cannot be analysed (Web Speech).
 * Each word boundary schedules a short viseme sequence built from the word's letters/kana.
 */
export class EventLipSync implements LipSync {
  private queue: Scheduled[] = [];
  private speaking = false;
  private paused = false;
  private startedAt = 0;
  private gotBoundary = false;
  private lastT = 0;
  private current: Viseme = "X";
  private currentUntil = 0;
  private shown: Viseme = "X";
  private smooth = new AttackRelease(0.03, 0.08);

  constructor(
    private text: string,
    private speed = 1,
  ) {}

  start(t: number): void {
    this.speaking = true;
    this.startedAt = t;
  }

  end(): void {
    this.speaking = false;
    this.queue = [];
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  word(charIndex: number, charLength: number, t: number): void {
    this.gotBoundary = true;
    // Some engines report charLength 0; take the run up to the next whitespace
    let len = charLength;
    if (!len) {
      const m = /^\S+/.exec(this.text.slice(charIndex));
      len = m ? m[0].length : 1;
    }
    const word = this.text.slice(charIndex, charIndex + len);
    const shapes = textToVisemes(word);
    const step = BASE_SHAPE_SEC / this.speed;
    // A new word replaces whatever is left from the previous one
    this.queue = shapes.map((viseme, i) => ({ viseme, at: t + i * step }));
    this.queue.push({ viseme: "X", at: t + shapes.length * step });
  }

  frame(t: number): MouthState {
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;

    if (!this.speaking || this.paused) {
      this.current = "X";
    } else if (!this.gotBoundary && t - this.startedAt > NO_BOUNDARY_TIMEOUT) {
      const step = BASE_SHAPE_SEC / this.speed;
      this.current = LOOP[Math.floor((t - this.startedAt) / step) % LOOP.length];
    } else {
      while (this.queue.length && this.queue[0].at <= t) {
        this.current = this.queue.shift()!.viseme;
        this.currentUntil = t + (BASE_SHAPE_SEC * 1.5) / this.speed;
      }
      // Hold at most a little over one shape so the mouth rests between words
      if (t > this.currentUntil) this.current = "X";
    }

    const open = this.smooth.update(VISEME_OPENNESS[this.current] * 0.9, dt);
    // While closing, keep showing the last open shape so the sprite fades rather than snaps
    if (this.current !== "X") this.shown = this.current;
    return { viseme: open < 0.08 ? "X" : this.shown, open };
  }
}
