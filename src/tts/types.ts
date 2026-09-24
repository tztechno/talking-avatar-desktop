export type EngineId = "edge" | "webspeech";

export interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
}

export interface SentenceEvent {
  index: number;
  text: string;
  /** Character offset of the sentence in the original input text */
  charIndex: number;
  phonemes?: string;
}

export interface WordEvent {
  charIndex: number;
  charLength: number;
}

type Listener<T> = (payload: T) => void;

export interface SessionEvents {
  sentence: SentenceEvent;
  word: WordEvent;
  start: void;
  end: void;
  error: unknown;
}

/** Minimal typed event emitter shared by engine sessions */
export class Emitter<E extends object> {
  private listeners: { [K in keyof E]?: Listener<E[K]>[] } = {};

  on<K extends keyof E>(ev: K, cb: Listener<E[K]>): void {
    (this.listeners[ev] ??= []).push(cb);
  }

  emit<K extends keyof E>(ev: K, payload: E[K]): void {
    for (const cb of this.listeners[ev] ?? []) cb(payload);
  }
}

export interface SpeechSession extends Emitter<SessionEvents> {
  pause(): void;
  resume(): void;
  stop(): void;
  audioNode?: AudioNode;
}

export interface SpeakOptions {
  voice: string;
  speed: number;
}

export interface TTSEngine {
  init(): Promise<void>;
  voices(): VoiceInfo[];
  speak(text: string, opts: SpeakOptions): SpeechSession;
}
