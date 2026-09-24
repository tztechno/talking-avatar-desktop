/// <reference lib="webworker" />
import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import type { FromWorker, ToWorker } from "./kokoro-protocol";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

// huggingface.co answers requests with a *.workers.dev Referer with a 404 and no CORS headers,
// so never send one. Done in code (not only via Referrer-Policy header) so a cached copy of
// this worker can't bring the bug back.
const baseFetch = self.fetch.bind(self);
self.fetch = (input, init) => baseFetch(input, { ...init, referrerPolicy: "no-referrer" });

let tts: KokoroTTS | null = null;
let loading: Promise<void> | null = null;
const cancelled = new Set<number>();

const post = (msg: FromWorker, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function load(): Promise<void> {
  const webgpu = await hasWebGPU();
  const device = webgpu ? "webgpu" : "wasm";
  // fp32 on WebGPU avoids quantization artefacts; q8 keeps the WASM download small
  const dtype = webgpu ? "fp32" : "q8";

  // Aggregate per-file progress into one 0..1 value
  const files = new Map<string, { loaded: number; total: number }>();
  tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype,
    device,
    progress_callback: (info) => {
      if (info.status !== "progress") return;
      files.set(info.file, { loaded: info.loaded, total: info.total });
      let loaded = 0, total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      if (total) post({ type: "progress", progress: loaded / total });
    },
  });

  const voices = Object.entries(tts.voices).map(([id, v]) => ({
    id,
    name: v.name,
    lang: v.language,
  }));
  post({ type: "ready", device, voices });
}

async function speak(msg: Extract<ToWorker, { type: "speak" }>): Promise<void> {
  if (!tts) throw new Error("Model not loaded");
  const voice = msg.voice as keyof KokoroTTS["voices"];
  for (let i = 0; i < msg.sentences.length; i++) {
    let t0 = performance.now();
    // One stream per app-level sentence keeps highlight indices aligned with the UI.
    // kokoro-js 1.2.1 never closes the splitter it builds for a plain string, so the last
    // sentence would wait forever; pass our own and close it.
    const splitter = new TextSplitterStream();
    splitter.push(msg.sentences[i]);
    splitter.close();
    for await (const out of tts.stream(splitter, { voice, speed: msg.speed })) {
      if (cancelled.has(msg.id)) return;
      const audio = out.audio.audio;
      post(
        {
          type: "chunk",
          id: msg.id,
          sentence: i,
          phonemes: out.phonemes,
          audio,
          sampleRate: out.audio.sampling_rate,
          genMs: performance.now() - t0,
        },
        [audio.buffer],
      );
      t0 = performance.now();
    }
  }
  post({ type: "done", id: msg.id });
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      loading ??= load();
      await loading;
    } else if (msg.type === "speak") {
      await speak(msg);
      cancelled.delete(msg.id);
    } else if (msg.type === "cancel") {
      cancelled.add(msg.id);
    }
  } catch (err) {
    if (msg.type === "init") loading = null;
    post({
      type: "error",
      id: "id" in msg ? msg.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
