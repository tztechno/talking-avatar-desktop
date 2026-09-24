import type { EyeState } from "./manifest";

/** Schedules random blinks (occasionally doubled) and reports the eye frame for a time. */
export class Blinker {
  private nextAt: number;
  private blinkStart = -Infinity;
  private pendingDouble = false;

  constructor(
    private minInterval = 2,
    private maxInterval = 6,
    private duration = 0.16,
    private random: () => number = Math.random,
  ) {
    this.nextAt = this.interval();
  }

  eyes(t: number): EyeState {
    if (t >= this.nextAt) {
      this.blinkStart = this.nextAt;
      if (this.pendingDouble) {
        this.pendingDouble = false;
        this.nextAt = t + this.interval();
      } else {
        this.pendingDouble = this.random() < 0.15;
        this.nextAt = t + (this.pendingDouble ? this.duration + 0.12 : this.interval());
      }
    }
    const p = (t - this.blinkStart) / this.duration;
    if (p < 0 || p >= 1) return "open";
    // half -> closed -> half
    return p < 0.25 || p > 0.7 ? "half" : "closed";
  }

  private interval(): number {
    return this.minInterval + this.random() * (this.maxInterval - this.minInterval);
  }
}
