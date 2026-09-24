import type { Point } from "./manifest";

/** Eye outline in image pixels: corners plus the middle of each lid. */
export interface EyeGeometry {
  outer: Point;
  inner: Point;
  top: Point;
  bottom: Point;
}

/** Where the photo's mouth, chin and eyes are, in image pixels. */
export interface FaceGeometry {
  mouth: {
    left: Point;
    right: Point;
    /** Point on the line between the lips; defaults to the corners' midpoint */
    center?: Point;
  };
  /** Bottom of the chin; defaults to 0.75 mouth widths below the lips */
  chin?: Point;
  /** Both eyes, or none (no blinking) */
  eyes?: [EyeGeometry, EyeGeometry];
}

const isPoint = (v: unknown): v is Point => {
  const p = v as Partial<Point> | null;
  return !!p && typeof p.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y);
};

const isEye = (v: unknown): v is EyeGeometry => {
  const e = v as Partial<EyeGeometry> | null;
  return !!e && isPoint(e.outer) && isPoint(e.inner) && isPoint(e.top) && isPoint(e.bottom);
};

/** Validates the optional "face" object of a photo avatar.json. */
export function parseFaceGeometry(raw: unknown, errors: string[]): FaceGeometry | undefined {
  const f = raw as Partial<FaceGeometry> | null;
  if (!f || typeof f !== "object") return undefined;
  if (!f.mouth || !isPoint(f.mouth.left) || !isPoint(f.mouth.right)) {
    errors.push('"face.mouth" needs "left" and "right" points');
    return undefined;
  }
  if (f.mouth.center !== undefined && !isPoint(f.mouth.center)) errors.push('"face.mouth.center" must be a point');
  if (f.chin !== undefined && !isPoint(f.chin)) errors.push('"face.chin" must be a point');
  if (f.eyes !== undefined && !(Array.isArray(f.eyes) && f.eyes.length === 2 && f.eyes.every(isEye))) {
    errors.push('"face.eyes" must list two eyes with "outer", "inner", "top" and "bottom" points');
  }
  return errors.length ? undefined : (f as FaceGeometry);
}

/** Multiplies every point by k (used when a large photo is downscaled). */
export function scaleFace(face: FaceGeometry, k: number): FaceGeometry {
  const s = (p: Point): Point => ({ x: p.x * k, y: p.y * k });
  const eye = (e: EyeGeometry): EyeGeometry => ({ outer: s(e.outer), inner: s(e.inner), top: s(e.top), bottom: s(e.bottom) });
  return {
    mouth: { left: s(face.mouth.left), right: s(face.mouth.right), center: face.mouth.center && s(face.mouth.center) },
    chin: face.chin && s(face.chin),
    eyes: face.eyes && [eye(face.eyes[0]), eye(face.eyes[1])],
  };
}

// MediaPipe Face Mesh landmark indices
const LM = {
  mouthLeft: 61,
  mouthRight: 291,
  upperLipInner: 13,
  lowerLipInner: 14,
  chin: 152,
  eyeA: { outer: 33, inner: 133, top: 159, bottom: 145 },
  eyeB: { outer: 263, inner: 362, top: 386, bottom: 374 },
};

const MEDIAPIPE_VERSION = "1.0.1";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Finds the mouth, chin and eyes with MediaPipe Face Landmarker (loaded on first use, ~4 MB).
 * Returns null when no face is found.
 */
export async function detectFace(image: HTMLImageElement | HTMLCanvasElement): Promise<FaceGeometry | null> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  try {
    const marks = landmarker.detect(image).faceLandmarks[0];
    if (!marks) return null;
    const { width, height } = image;
    const at = (i: number): Point => ({ x: marks[i].x * width, y: marks[i].y * height });
    const eye = (e: typeof LM.eyeA): EyeGeometry => ({
      outer: at(e.outer),
      inner: at(e.inner),
      top: at(e.top),
      bottom: at(e.bottom),
    });
    const up = at(LM.upperLipInner);
    const low = at(LM.lowerLipInner);
    return {
      mouth: { left: at(LM.mouthLeft), right: at(LM.mouthRight), center: { x: (up.x + low.x) / 2, y: (up.y + low.y) / 2 } },
      chin: at(LM.chin),
      eyes: [eye(LM.eyeA), eye(LM.eyeB)],
    };
  } finally {
    landmarker.close();
  }
}
