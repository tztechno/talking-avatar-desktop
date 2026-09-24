import { VISEMES, type Viseme } from "../lipsync/types";

export type EyeState = "open" | "half" | "closed";
export const EYE_STATES: readonly EyeState[] = ["open", "half", "closed"];

export interface Point {
  x: number;
  y: number;
}

/** Normalised avatar.json */
export interface AvatarManifest {
  name: string;
  width: number;
  height: number;
  /** Point the mouth sprite is scaled around */
  mouthAnchor: Point;
  /** Point the head sways / nods around */
  pivot: Point;
  blink: { minInterval: number; maxInterval: number; duration: number };
  /** Layer name -> file name inside the avatar folder (empty for photo avatars) */
  files: Partial<Record<LayerName, string>>;
}

export type LayerName = "base" | `eyes_${EyeState}` | `mouth_${Viseme}`;

export const LAYER_NAMES: LayerName[] = [
  "base",
  ...EYE_STATES.map((s) => `eyes_${s}` as const),
  ...VISEMES.map((v) => `mouth_${v}` as const),
];

const IMAGE_EXT = ["png", "svg", "webp", "jpg", "jpeg", "gif"];

export interface ValidationResult {
  manifest?: AvatarManifest;
  errors: string[];
  warnings: string[];
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function point(raw: unknown, fallback: Point, label: string, errors: string[]): Point {
  if (raw === undefined) return fallback;
  const p = raw as Partial<Point>;
  if (!p || !num(p.x) || !num(p.y)) {
    errors.push(`"${label}" must be an object like { "x": 0, "y": 0 }`);
    return fallback;
  }
  return { x: p.x, y: p.y };
}

/**
 * Validates an avatar.json object against the files actually present.
 * Layer files can be listed explicitly under "layers" or found by convention (e.g. mouth_A.png).
 */
export function validateManifest(raw: unknown, available: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { errors: ["avatar.json must contain a JSON object"], warnings };
  }
  const j = raw as Record<string, unknown>;

  if (!num(j.width) || !num(j.height) || j.width <= 0 || j.height <= 0) {
    errors.push('"width" and "height" must be positive numbers');
  }
  const width = num(j.width) ? j.width : 512;
  const height = num(j.height) ? j.height : 512;

  const b = (j.blink ?? {}) as Record<string, unknown>;
  const blink = {
    minInterval: num(b.minInterval) ? b.minInterval : 2,
    maxInterval: num(b.maxInterval) ? b.maxInterval : 6,
    duration: num(b.duration) ? b.duration : 0.16,
  };
  if (blink.maxInterval < blink.minInterval) errors.push('"blink.maxInterval" must be >= "blink.minInterval"');

  const lower = new Map(available.map((f) => [f.toLowerCase(), f]));
  const explicit = (j.layers ?? {}) as Record<string, unknown>;
  const files = {} as Record<LayerName, string>;
  for (const layer of LAYER_NAMES) {
    const listed = explicit[layer];
    if (typeof listed === "string") {
      const hit = lower.get(listed.toLowerCase());
      if (hit) files[layer] = hit;
      else errors.push(`Layer "${layer}" points to "${listed}", which is missing`);
      continue;
    }
    const hit = IMAGE_EXT.map((ext) => lower.get(`${layer}.${ext}`.toLowerCase())).find(Boolean);
    if (hit) files[layer] = hit;
    else if (layer === "eyes_half" && files.eyes_open) {
      // Half-closed eyes are optional: blink goes straight from open to closed
      warnings.push('No "eyes_half" image; blinks will skip the half-closed frame');
    } else {
      errors.push(`Missing layer "${layer}" (expected ${layer}.png or ${layer}.svg)`);
    }
  }

  const mouthAnchor = point(j.mouthAnchor, { x: width / 2, y: height * 0.62 }, "mouthAnchor", errors);
  const pivot = point(j.pivot, { x: width / 2, y: height * 0.8 }, "pivot", errors);

  if (errors.length) return { errors, warnings };
  return {
    errors,
    warnings,
    manifest: {
      name: typeof j.name === "string" && j.name ? j.name : "Custom avatar",
      width,
      height,
      mouthAnchor,
      pivot,
      blink,
      files,
    },
  };
}
