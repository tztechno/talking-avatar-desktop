import type { EngineId } from "../tts/types";

export interface Settings {
  engine: EngineId;
  /** Last voice per engine */
  voice: Partial<Record<EngineId, string>>;
  speed: number;
  bgMode: "transparent" | "color" | "chroma";
  bgColor: string;
  /** Set once Kokoro has loaded successfully, so it auto-loads from cache next time */
  kokoroCached: boolean;
  /** Built-in avatar folder under public/avatars */
  avatar: "sample-photo" | "default";
  text: string;
}

const KEY = "talking-avatar:settings";

export const DEFAULTS: Settings = {
  engine: "webspeech",
  voice: { kokoro: "af_heart" },
  speed: 1,
  bgMode: "transparent",
  bgColor: "#dfe7f5",
  kokoroCached: false,
  avatar: "sample-photo",
  text:
    "Hello, and welcome to this channel.\n" +
    "Today, I will read this script aloud, and my lips will move in sync with every word.\n" +
    "Let's get started.",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
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
