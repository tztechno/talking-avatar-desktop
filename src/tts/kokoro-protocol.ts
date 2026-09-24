// Messages exchanged between KokoroEngine (main thread) and kokoro.worker.ts

export type ToWorker =
  | { type: "init" }
  | { type: "speak"; id: number; sentences: string[]; voice: string; speed: number }
  | { type: "cancel"; id: number };

export type FromWorker =
  | { type: "progress"; progress: number }
  | { type: "ready"; device: "webgpu" | "wasm"; voices: { id: string; name: string; lang: string }[] }
  | {
      type: "chunk";
      id: number;
      sentence: number;
      phonemes: string;
      audio: Float32Array;
      sampleRate: number;
      genMs: number;
    }
  | { type: "done"; id: number }
  | { type: "error"; id?: number; message: string };
