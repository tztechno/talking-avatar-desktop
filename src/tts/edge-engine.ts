import { invoke } from "@tauri-apps/api/core";
import { splitSentences } from "./sentences";
import { Emitter, type SessionEvents, type SpeakOptions, type SpeechSession, type TTSEngine, type VoiceInfo } from "./types";

interface WordBoundaryInfo {
  offset_ms: number;
  duration_ms: number;
  text: string;
}

interface EdgeSpeakResult {
  audio_base64: string;
  boundaries: WordBoundaryInfo[];
}

export class EdgeSession extends Emitter<SessionEvents> implements SpeechSession {
  private done = false;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode;
  private timers: number[] = [];

  constructor(
    private ctx: AudioContext,
    audioBuffer: AudioBuffer,
    boundaries: WordBoundaryInfo[],
    fullText: string,
  ) {
    super();
    this.gainNode = ctx.createGain();
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 1024;

    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);
    this.source = source;

    source.onended = () => {
      this.finish();
    };

    // Emit start and schedule boundary events
    void ctx.resume().then(() => {
      if (this.done) return;
      source.start();
      this.emit("start", undefined);

      const sentences = splitSentences(fullText);
      // Map boundaries to word events and sentence events
      let currentSentenceIdx = 0;
      for (const b of boundaries) {
        const tid = window.setTimeout(() => {
          if (this.done) return;
          const charIndex = fullText.indexOf(b.text);
          this.emit("word", {
            charIndex: charIndex >= 0 ? charIndex : 0,
            charLength: b.text.length,
          });

          while (
            currentSentenceIdx < sentences.length &&
            sentences[currentSentenceIdx].start <= (charIndex >= 0 ? charIndex : 0)
          ) {
            const s = sentences[currentSentenceIdx];
            this.emit("sentence", {
              index: currentSentenceIdx,
              text: s.text,
              charIndex: s.start,
            });
            currentSentenceIdx++;
          }
        }, b.offset_ms);
        this.timers.push(tid);
      }
    });
  }

  get audioNode(): AudioNode {
    return this.gainNode;
  }

  get analyser(): AnalyserNode {
    return this.analyserNode;
  }

  pause(): void {
    void this.ctx.suspend();
  }

  resume(): void {
    void this.ctx.resume();
  }

  stop(): void {
    if (this.done) return;
    this.clearTimers();
    try {
      this.source?.stop();
      this.source?.disconnect();
    } catch {
      /* already stopped */
    }
    void this.ctx.resume();
    this.finish();
  }

  finish(err?: unknown): void {
    if (this.done) return;
    this.done = true;
    this.clearTimers();
    if (err !== undefined) this.emit("error", err);
    this.emit("end", undefined);
  }

  get finished(): boolean {
    return this.done;
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}

export class EdgeSessionProxy extends Emitter<SessionEvents> implements SpeechSession {
  private activeSession: EdgeSession | null = null;
  private cancelled = false;

  setActiveSession(s: EdgeSession): void {
    this.activeSession = s;
    s.on("start", () => this.emit("start", undefined));
    s.on("sentence", (e) => this.emit("sentence", e));
    s.on("word", (e) => this.emit("word", e));
    s.on("end", () => this.emit("end", undefined));
    s.on("error", (e) => this.emit("error", e));
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }

  get audioNode(): AudioNode | undefined {
    return this.activeSession?.audioNode;
  }

  get analyser(): AnalyserNode | undefined {
    return this.activeSession?.analyser;
  }

  pause(): void {
    this.activeSession?.pause();
  }

  resume(): void {
    this.activeSession?.resume();
  }

  stop(): void {
    this.cancelled = true;
    if (this.activeSession) {
      this.activeSession.stop();
    } else {
      this.emit("end", undefined);
    }
  }
}

export class EdgeEngine implements TTSEngine {
  readonly id = "edge" as const;
  private voiceList: VoiceInfo[] = [];

  constructor(private getAudioCtx: () => AudioContext) {}

  async init(): Promise<void> {
    try {
      const voices = await invoke<VoiceInfo[]>("get_edge_voices");
      this.voiceList = voices;
    } catch (e) {
      console.warn("Failed to load Edge TTS voices:", e);
      this.voiceList = [];
    }
  }

  voices(): VoiceInfo[] {
    return this.voiceList;
  }

  speak(text: string, opts: SpeakOptions): SpeechSession {
    const proxy = new EdgeSessionProxy();

    // Async synthesis call to Tauri backend
    void (async () => {
      try {
        const res = await invoke<EdgeSpeakResult>("speak_edge_tts", {
          text,
          voice: opts.voice,
          speed: opts.speed,
        });

        if (proxy.isCancelled) return;

        // Convert base64 to ArrayBuffer
        const binary = atob(res.audio_base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const ctx = this.getAudioCtx();
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

        if (proxy.isCancelled) return;

        const session = new EdgeSession(ctx, audioBuffer, res.boundaries, text);
        proxy.setActiveSession(session);
      } catch (err) {
        if (!proxy.isCancelled) {
          proxy.emit("error", err);
          proxy.emit("end", undefined);
        }
      }
    })();

    return proxy;
  }
}
