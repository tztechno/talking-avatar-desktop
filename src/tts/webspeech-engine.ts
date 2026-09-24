import { splitSentences } from "./sentences";
import { Emitter, type SessionEvents, type SpeakOptions, type SpeechSession, type TTSEngine, type VoiceInfo } from "./types";

class WebSpeechSession extends Emitter<SessionEvents> implements SpeechSession {
  private done = false;

  pause(): void {
    speechSynthesis.pause();
  }

  resume(): void {
    speechSynthesis.resume();
  }

  stop(): void {
    if (this.done) return;
    speechSynthesis.cancel();
    this.finish();
  }

  finish(err?: unknown): void {
    if (this.done) return;
    this.done = true;
    if (err !== undefined) this.emit("error", err);
    this.emit("end", undefined);
  }

  get finished(): boolean {
    return this.done;
  }
}

/** Browser/OS voices via the Web Speech API. No download; audio cannot be analysed. */
export class WebSpeechEngine implements TTSEngine {
  readonly id = "webspeech" as const;
  private list: SpeechSynthesisVoice[] = [];

  static get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  init(): Promise<void> {
    if (!WebSpeechEngine.supported) return Promise.reject(new Error("Web Speech API is not supported in this browser"));
    return new Promise((resolve) => {
      const load = () => {
        this.list = speechSynthesis.getVoices();
        return this.list.length > 0;
      };
      if (load()) return resolve();
      // Voices arrive asynchronously in Chrome; some platforms never fire the event
      const timer = setTimeout(() => {
        load();
        resolve();
      }, 1500);
      speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          clearTimeout(timer);
          load();
          resolve();
        },
        { once: true },
      );
    });
  }

  voices(): VoiceInfo[] {
    return this.list.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
  }

  speak(text: string, opts: SpeakOptions): SpeechSession {
    const session = new WebSpeechSession();
    const voice = this.list.find((v) => v.voiceURI === opts.voice);
    const sentences = splitSentences(text);
    speechSynthesis.cancel();

    if (!sentences.length) {
      queueMicrotask(() => session.finish());
      return session;
    }

    // One utterance per sentence: gives sentence events and avoids Chrome's long-utterance cutoff
    sentences.forEach((s, index) => {
      const u = new SpeechSynthesisUtterance(s.text);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = opts.speed;
      u.onstart = () => {
        if (session.finished) return;
        if (index === 0) session.emit("start", undefined);
        session.emit("sentence", { index, text: s.text, charIndex: s.start });
      };
      u.onboundary = (e) => {
        if (session.finished || e.name === "sentence") return;
        session.emit("word", { charIndex: s.start + e.charIndex, charLength: e.charLength ?? 0 });
      };
      u.onend = () => {
        if (index === sentences.length - 1) session.finish();
      };
      u.onerror = (e) => {
        // "interrupted"/"canceled" are the result of stop(), not failures
        if (e.error === "interrupted" || e.error === "canceled") return session.finish();
        session.finish(new Error(`Speech error: ${e.error}`));
      };
      speechSynthesis.speak(u);
    });
    return session;
  }
}
