// Injected before app scripts: a deterministic stand-in for window.speechSynthesis
export function installFakeSpeech(): void {
  type U = SpeechSynthesisUtterance & Record<string, unknown>;
  const queue: U[] = [];
  let busy = false;
  const fire = (u: U, name: string, extra: object = {}) => {
    const fn = u[`on${name}`] as ((e: object) => void) | null;
    fn?.call(u, { name: "word", charLength: 0, ...extra });
  };
  const next = () => {
    const u = queue.shift();
    if (!u) return void (busy = false);
    busy = true;
    setTimeout(() => fire(u, "start"), 0);
    const words = [...u.text.matchAll(/\S+/g)];
    words.forEach((m, i) => setTimeout(() => fire(u, "boundary", { charIndex: m.index, charLength: m[0].length }), i * 250));
    setTimeout(() => {
      fire(u, "end");
      next();
    }, words.length * 250 + 100);
  };
  const voice = { voiceURI: "fake-en", name: "Fake English", lang: "en-US", default: true, localService: true };
  const synth = {
    getVoices: () => [voice],
    speak: (u: U) => {
      queue.push(u);
      if (!busy) next();
    },
    cancel: () => {
      queue.length = 0;
      busy = false;
    },
    pause() {},
    resume() {},
    addEventListener() {},
    speaking: false,
  };
  class FakeUtterance {
    voice: unknown = null;
    lang = "";
    rate = 1;
    constructor(public text: string) {}
  }
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
}
