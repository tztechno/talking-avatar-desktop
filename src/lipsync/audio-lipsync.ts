import type { AudioQueue } from "../tts/audio-queue";
import { ipaToVisemes, VISEME_OPENNESS } from "./phoneme-map";
import { AttackRelease, gateAndScale } from "./smoothing";
import type { LipSync, MouthState, Viseme } from "./types";

export interface ChunkMeta {
  phonemes?: string;
}

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

/** Viseme at time `t` (0..duration) when the sequence is spread evenly over the chunk. */
export function timelineViseme(seq: Viseme[], t: number, duration: number): Viseme | undefined {
  if (!seq.length || duration <= 0) return undefined;
  const i = Math.floor((t / duration) * seq.length);
  return seq[Math.max(0, Math.min(seq.length - 1, i))];
}

/**
 * Audio-driven lip-sync: loudness from the AnalyserNode drives openness, and the viseme comes
 * from the chunk's phoneme timeline (falling back to an FFT band guess).
 */
export class AudioLipSync implements LipSync {
  private time: Float32Array<ArrayBuffer>;
  private freq: Uint8Array<ArrayBuffer>;
  private smooth = new AttackRelease(0.035, 0.09);
  private lastT = 0;
  private shown: Viseme = "X";
  private seqCache = new WeakMap<object, Viseme[]>();

  constructor(private queue: Pick<AudioQueue<ChunkMeta>, "analyser" | "ctx" | "chunkAt">) {
    const a = queue.analyser;
    this.time = new Float32Array(a.fftSize);
    this.freq = new Uint8Array(a.frequencyBinCount);
  }

  frame(t: number): MouthState {
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    const a = this.queue.analyser;

    a.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (const v of this.time) sum += v * v;
    const rms = Math.sqrt(sum / this.time.length);
    const loud = gateAndScale(rms);

    let viseme: Viseme = "X";
    if (loud > 0) {
      viseme = this.bandGuess();
      const now = this.queue.ctx.currentTime;
      const chunk = this.queue.chunkAt(now);
      if (chunk?.meta.phonemes) {
        let seq = this.seqCache.get(chunk);
        if (!seq) this.seqCache.set(chunk, (seq = ipaToVisemes(chunk.meta.phonemes)));
        viseme = timelineViseme(seq, now - chunk.start, chunk.end - chunk.start) ?? viseme;
      }
    }

    // Bilabials and silence close the mouth; otherwise scale by the shape's natural openness
    const target = viseme === "X" ? 0 : loud * (0.35 + 0.65 * VISEME_OPENNESS[viseme]);
    const open = this.smooth.update(target, dt);
    if (viseme !== "X") this.shown = viseme;
    return { viseme: open < 0.08 ? "X" : this.shown, open };
  }

  private bandGuess(): Viseme {
    const a = this.queue.analyser;
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
