import { AudioQueue } from "./audio-queue";
import type { ChunkMeta } from "../lipsync/audio-lipsync";
import type { FromWorker, ToWorker } from "./kokoro-protocol";
import { splitSentences } from "./sentences";
import { Emitter, type SessionEvents, type SpeakOptions, type SpeechSession, type TTSEngine, type VoiceInfo } from "./types";

type KokoroMeta = ChunkMeta & { sentence: number };

export class KokoroSession extends Emitter<SessionEvents> implements SpeechSession {
  readonly queue: AudioQueue<KokoroMeta>;
  private done = false;

  constructor(
    private engine: KokoroEngine,
    readonly id: number,
    ctx: AudioContext,
  ) {
    super();
    this.queue = new AudioQueue<KokoroMeta>(ctx);
    this.queue.onDrained = () => this.finish();
  }

  get audioNode(): AudioNode {
    return this.queue.output;
  }

  pause(): void {
    void this.queue.ctx.suspend();
  }

  resume(): void {
    void this.queue.ctx.resume();
  }

  stop(): void {
    if (this.done) return;
    this.engine.cancel(this.id);
    this.queue.stop();
    void this.queue.ctx.resume();
    this.finish();
  }

  /** @internal */
  finish(err?: unknown): void {
    if (this.done) return;
    this.done = true;
    this.engine.release(this.id);
    if (err !== undefined) {
      this.queue.stop();
      this.emit("error", err);
    }
    this.emit("end", undefined);
  }
}

/** Kokoro-82M running in a Web Worker; audio is streamed back per sentence. */
export class KokoroEngine implements TTSEngine {
  readonly id = "kokoro" as const;
  device: "webgpu" | "wasm" | null = null;
  private worker: Worker | null = null;
  private voiceList: VoiceInfo[] = [];
  private ready: Promise<void> | null = null;
  private sessions = new Map<number, KokoroSession>();
  private nextId = 1;

  constructor(private ctx: () => AudioContext) {}

  get loaded(): boolean {
    return this.device !== null;
  }

  init(onProgress?: (p: number) => void): Promise<void> {
    if (this.ready) return this.ready;
    this.worker = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise<void>((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        if (msg.type === "progress") onProgress?.(msg.progress);
        else if (msg.type === "ready") {
          this.device = msg.device;
          this.voiceList = msg.voices;
          this.worker!.onmessage = (ev) => this.handle(ev.data);
          resolve();
        } else if (msg.type === "error") {
          this.ready = null;
          this.worker?.terminate();
          this.worker = null;
          reject(new Error(msg.message));
        }
      };
      this.worker!.onerror = (e) => {
        this.ready = null;
        reject(new Error(e.message || "Kokoro worker failed to start"));
      };
    });
    this.post({ type: "init" });
    return this.ready;
  }

  voices(): VoiceInfo[] {
    return this.voiceList;
  }

  speak(text: string, opts: SpeakOptions): SpeechSession {
    if (!this.worker || !this.loaded) throw new Error("Kokoro is not loaded yet");
    const ctx = this.ctx();
    void ctx.resume();
    const id = this.nextId++;
    const session = new KokoroSession(this, id, ctx);
    this.sessions.set(id, session);

    const sentences = splitSentences(text);
    let started = false;
    session.queue.onChunkStart = (chunk) => {
      if (!started) {
        started = true;
        session.emit("start", undefined);
      }
      const s = sentences[chunk.meta.sentence];
      // Only announce a sentence on its first chunk
      const prev = session.queue.chunks[session.queue.chunks.indexOf(chunk) - 1];
      if (s && prev?.meta.sentence !== chunk.meta.sentence) {
        session.emit("sentence", {
          index: chunk.meta.sentence,
          text: s.text,
          charIndex: s.start,
          phonemes: chunk.meta.phonemes,
        });
      }
    };

    if (!sentences.length) {
      queueMicrotask(() => session.finish());
      return session;
    }
    this.post({ type: "speak", id, sentences: sentences.map((s) => s.text), voice: opts.voice, speed: opts.speed });
    return session;
  }

  /** @internal */
  cancel(id: number): void {
    this.post({ type: "cancel", id });
  }

  /** @internal */
  release(id: number): void {
    this.sessions.delete(id);
  }

  private handle(msg: FromWorker): void {
    if (!("id" in msg) || msg.id === undefined) return;
    const session = this.sessions.get(msg.id);
    if (!session) return;
    if (msg.type === "chunk") {
      if (import.meta.env.DEV) {
        const sec = msg.audio.length / msg.sampleRate;
        console.debug(`[kokoro/${this.device}] sentence ${msg.sentence}: ${msg.genMs.toFixed(0)} ms for ${sec.toFixed(2)} s audio`);
      }
      session.queue.enqueue(msg.audio, msg.sampleRate, { sentence: msg.sentence, phonemes: msg.phonemes });
    } else if (msg.type === "done") {
      session.queue.finish();
    } else if (msg.type === "error") {
      session.finish(new Error(msg.message));
    }
  }

  private post(msg: ToWorker): void {
    this.worker?.postMessage(msg);
  }
}
