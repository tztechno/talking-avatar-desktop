import { VISEME_OPENNESS } from "./phoneme-map";
import { AttackRelease, gateAndScale } from "./smoothing";
import type { LipSync, MouthState, Viseme } from "./types";

/** Guesses a vowel shape from the spectrum's low / mid / high band energy ratios. */
export function guessVisemeFromBands(low: number, mid: number, high: number): Viseme {
  const total = low + mid + high || 1;
  const l = low / total;
  const h = high / total;
  if (h > 0.38) return "I";
  if (h > 0.3) return "E";
  if (l > 0.62) return "U";
  if (l > 0.52) return "O";
  return "A";
}

/**
 * Audio-driven lip-sync: loudness from the AnalyserNode drives openness, and the viseme
 * is estimated via spectral band energy analysis.
 */
export class AudioLipSync implements LipSync {
  private time: Float32Array<ArrayBuffer>;
  private freq: Uint8Array<ArrayBuffer>;
  private smooth = new AttackRelease(0.035, 0.09);
  private lastT = 0;
  private shown: Viseme = "X";

  constructor(private analyser: AnalyserNode) {
    this.time = new Float32Array(analyser.fftSize);
    this.freq = new Uint8Array(analyser.frequencyBinCount);
  }

  frame(t: number): MouthState {
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    const a = this.analyser;

    a.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = this.time[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.time.length);
    const loud = gateAndScale(rms);

    let viseme: Viseme = "X";
    if (loud > 0) {
      viseme = this.bandGuess();
    }

    const target = viseme === "X" ? 0 : loud * (0.35 + 0.65 * VISEME_OPENNESS[viseme]);
    const open = this.smooth.update(target, dt);
    if (viseme !== "X") this.shown = viseme;
    return { viseme: open < 0.08 ? "X" : this.shown, open };
  }

  private bandGuess(): Viseme {
    const a = this.analyser;
    a.getByteFrequencyData(this.freq);
    const hzPerBin = a.context.sampleRate / a.fftSize;
    let low = 0, mid = 0, high = 0;
    for (let i = 1; i < this.freq.length; i++) {
      const hz = i * hzPerBin;
      const e = this.freq[i];
      if (hz < 800) low += e;
      else if (hz < 2200) mid += e;
      else if (hz < 5000) high += e;
    }
    return guessVisemeFromBands(low, mid, high);
  }
}
