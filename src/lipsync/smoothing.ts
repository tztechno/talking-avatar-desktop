/**
 * Asymmetric one-pole smoother: rises fast (attack) and falls slower (release),
 * which keeps the mouth snappy on syllable onsets without flicker.
 */
export class AttackRelease {
  value = 0;

  constructor(
    private attack = 0.04,
    private release = 0.12,
  ) {}

  /** @param dt seconds since last update */
  update(target: number, dt: number): number {
    const tau = target > this.value ? this.attack : this.release;
    const k = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
    this.value += (target - this.value) * k;
    return this.value;
  }
}

/** Maps a loudness value to 0..1 with a noise gate and soft ceiling. */
export function gateAndScale(rms: number, gate = 0.015, full = 0.18): number {
  if (rms <= gate) return 0;
  return Math.min(1, (rms - gate) / (full - gate));
}
