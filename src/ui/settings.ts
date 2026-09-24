export interface Settings {
  voice: string;
  speed: number;
  bgMode: "transparent" | "color" | "chroma";
  bgColor: string;
  /** Built-in avatar folder under public/avatars */
  avatar: "sample-photo" | "default";
  text: string;
}

const KEY = "talking-avatar:settings";

export const DEFAULTS: Settings = {
  voice: "",
  speed: 1,
  bgMode: "transparent",
  bgColor: "#dfe7f5",
  avatar: "sample-photo",
  text:
    "Hello, and welcome to this channel.\n" +
    "Today, I will read this script aloud, and my lips will move in sync with every word.\n" +
    "Let's get started.",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        voice: typeof parsed.voice === "string" ? parsed.voice : (parsed.voice?.webspeech || ""),
      };
    }
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
