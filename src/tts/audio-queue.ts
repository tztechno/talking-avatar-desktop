export interface QueuedChunk<M> {
  start: number;
  end: number;
  meta: M;
}

/**
 * Gap-free playback of sequential PCM chunks on one AudioContext.
 * Everything is routed through an AnalyserNode (for lip-sync) into `output`,
 * which export can also tap.
 */
export class AudioQueue<M> {
  readonly analyser: AnalyserNode;
  readonly output: GainNode;
  readonly chunks: QueuedChunk<M>[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private nextStart = 0;
  private timers: number[] = [];
  private finished = false;
  private stopped = false;

  onChunkStart?: (chunk: QueuedChunk<M>, index: number) => void;
  onDrained?: () => void;

  constructor(readonly ctx: AudioContext) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;
    this.output = ctx.createGain();
    this.analyser.connect(this.output);
    this.output.connect(ctx.destination);
  }

  enqueue(samples: Float32Array, sampleRate: number, meta: M): void {
    if (this.stopped) return;
    const buf = this.ctx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);

    // Small lead-in so the first chunk is never scheduled in the past
    const start = Math.max(this.nextStart, this.ctx.currentTime + 0.05);
    src.start(start);
    this.nextStart = start + buf.duration;
    this.sources.push(src);

    const chunk = { start, end: this.nextStart, meta };
    const index = this.chunks.push(chunk) - 1;
    src.onended = () => this.checkDrained();
    this.at(start, () => this.onChunkStart?.(chunk, index));
  }

  /** Signals that no more chunks will be enqueued. */
  finish(): void {
    this.finished = true;
    this.checkDrained();
  }

  /** Chunk playing at the given context time, if any. */
  chunkAt(time: number): QueuedChunk<M> | undefined {
    return this.chunks.find((c) => time >= c.start && time < c.end);
  }

  stop(): void {
    this.stopped = true;
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* not started yet */
      }
      s.disconnect();
    }
    for (const t of this.timers) clearTimeout(t);
    this.sources = [];
    this.timers = [];
    this.output.disconnect();
  }

  private checkDrained(): void {
    if (this.stopped || !this.finished) return;
    if (this.ctx.currentTime + 0.01 >= this.nextStart) {
      this.stopped = true;
      this.onDrained?.();
    }
  }

  // Fires a callback when the context clock reaches `time`; re-checks so it survives ctx.suspend()
  private at(time: number, cb: () => void): void {
    const tick = () => {
      if (this.stopped) return;
      const wait = time - this.ctx.currentTime;
      if (wait <= 0.005) cb();
      else this.timers.push(window.setTimeout(tick, Math.max(4, wait * 1000)));
    };
    tick();
  }
}
