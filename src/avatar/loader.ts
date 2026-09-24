import JSZip from "jszip";
import { validateManifest, type AvatarManifest, type LayerName } from "./manifest";
import { detectFace, parseFaceGeometry, scaleFace, type FaceGeometry } from "./photo-face";

/** A single photo animated by warping; face is null until the mouth is found or marked. */
export interface PhotoSource {
  image: HTMLCanvasElement;
  face: FaceGeometry | null;
}

export interface LoadedAvatar {
  manifest: AvatarManifest;
  images: Partial<Record<LayerName, HTMLImageElement>>;
  photo?: PhotoSource;
  warnings: string[];
  /** Object URLs to revoke when the avatar is replaced */
  dispose(): void;
}

export class AvatarLoadError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("\n"));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not decode image ${src}`));
    img.src = src;
  });
}

/** Photos larger than this (longest side) are downscaled so warping stays fast */
const MAX_PHOTO_SIDE = 1024;

/** Manifest for a photo avatar: mouth anchor from the face, sway around the bottom edge. */
export function photoManifest(name: string, width: number, height: number, face: FaceGeometry | null): AvatarManifest {
  const m = face?.mouth;
  return {
    name,
    width,
    height,
    mouthAnchor: m ? (m.center ?? { x: (m.left.x + m.right.x) / 2, y: (m.left.y + m.right.y) / 2 }) : { x: width / 2, y: height * 0.62 },
    pivot: { x: width / 2, y: height },
    blink: { minInterval: 2, maxInterval: 6, duration: 0.16 },
    files: {},
  };
}

/**
 * Loads a portrait as a photo avatar. Without a known face geometry the face is detected
 * automatically; if that fails, face is null and the caller asks the user to mark the mouth.
 */
export async function loadPhotoAvatar(
  src: string,
  name: string,
  face?: FaceGeometry,
  revoke: string[] = [],
): Promise<LoadedAvatar> {
  const img = await loadImage(src);
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const image = document.createElement("canvas");
  image.width = Math.round(img.naturalWidth * k);
  image.height = Math.round(img.naturalHeight * k);
  image.getContext("2d")!.drawImage(img, 0, 0, image.width, image.height);

  const warnings: string[] = [];
  let geometry = face ? scaleFace(face, k) : null;
  if (!geometry) {
    try {
      geometry = await detectFace(image);
      if (!geometry) warnings.push("No face was found in the photo.");
    } catch (e) {
      warnings.push(`Face detection is unavailable (${(e as Error).message}).`);
    }
  }
  return {
    manifest: photoManifest(name, image.width, image.height, geometry),
    images: {},
    photo: { image, face: geometry },
    warnings,
    dispose: () => revoke.forEach((u) => URL.revokeObjectURL(u)),
  };
}

/** Shared path: resolve each layer file to a URL, then decode all images. */
async function build(
  rawJson: unknown,
  names: string[],
  urlFor: (file: string) => Promise<string>,
  revoke: string[] = [],
): Promise<LoadedAvatar> {
  const photo = rawJson as { type?: unknown; image?: unknown; name?: unknown; face?: unknown } | null;
  if (photo?.type === "photo") {
    const errors: string[] = [];
    const image = typeof photo.image === "string" ? names.find((n) => n.toLowerCase() === (photo.image as string).toLowerCase()) : undefined;
    if (!image) errors.push(typeof photo.image === "string" ? `Photo "${photo.image}" is missing` : 'A photo avatar needs "image": "<file name>"');
    const face = parseFaceGeometry(photo.face, errors);
    if (errors.length) throw new AvatarLoadError(errors);
    const name = typeof photo.name === "string" && photo.name ? photo.name : "Photo";
    return loadPhotoAvatar(await urlFor(image!), name, face, revoke);
  }
  const { manifest, errors, warnings } = validateManifest(rawJson, names);
  if (!manifest) throw new AvatarLoadError(errors);
  const images: LoadedAvatar["images"] = {};
  await Promise.all(
    (Object.entries(manifest.files) as [LayerName, string][]).map(async ([layer, file]) => {
      images[layer] = await loadImage(await urlFor(file));
    }),
  );
  return { manifest, images, warnings, dispose: () => revoke.forEach((u) => URL.revokeObjectURL(u)) };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new AvatarLoadError([`avatar.json is not valid JSON: ${(e as Error).message}`]);
  }
}

/** Loads a built-in avatar served from a URL folder (e.g. avatars/default/). */
export async function loadAvatarFromUrl(base: string): Promise<LoadedAvatar> {
  const dir = base.endsWith("/") ? base : `${base}/`;
  const res = await fetch(`${dir}avatar.json`);
  if (!res.ok) throw new AvatarLoadError([`Could not fetch ${dir}avatar.json (${res.status})`]);
  const json = parseJson(await res.text());
  // A served folder cannot be listed, so URL avatars must name their files under "layers"
  const j = json as { layers?: Record<string, string>; image?: unknown } | null;
  const listed = [...Object.values(j?.layers ?? {}), ...(typeof j?.image === "string" ? [j.image] : [])];
  return build(json, listed, async (f) => dir + f);
}

/** Loads from files picked via a folder input or drag-and-drop (flat or nested one level). */
export async function loadAvatarFromFiles(files: File[]): Promise<LoadedAvatar> {
  const zip = files.find((f) => f.name.toLowerCase().endsWith(".zip"));
  if (zip) return loadAvatarFromZip(zip);

  const byName = new Map(files.map((f) => [f.name, f]));
  const jsonFile = byName.get("avatar.json");
  // A lone picture (no avatar.json) becomes a photo avatar
  const pictures = files.filter((f) => f.type.startsWith("image/"));
  if (!jsonFile && pictures.length === 1) {
    const url = URL.createObjectURL(pictures[0]);
    return loadPhotoAvatar(url, pictures[0].name.replace(/\.[^.]+$/, ""), undefined, [url]);
  }
  if (!jsonFile) throw new AvatarLoadError(["The folder has no avatar.json"]);
  const json = parseJson(await jsonFile.text());
  const urls: string[] = [];
  return build(json, [...byName.keys()], async (name) => {
    const url = URL.createObjectURL(byName.get(name)!);
    urls.push(url);
    return url;
  }, urls);
}

export async function loadAvatarFromZip(file: Blob): Promise<LoadedAvatar> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new AvatarLoadError(["The file is not a readable .zip archive"]);
  }
  // Accept avatar.json at the root or inside a single top-level folder
  const jsonEntry = Object.values(zip.files).find((f) => !f.dir && /(^|\/)avatar\.json$/.test(f.name) && f.name.split("/").length <= 2);
  if (!jsonEntry) throw new AvatarLoadError(["The zip has no avatar.json"]);
  const prefix = jsonEntry.name.slice(0, -"avatar.json".length);
  const entries = new Map(
    Object.values(zip.files)
      .filter((f) => !f.dir && f.name.startsWith(prefix) && !f.name.slice(prefix.length).includes("/"))
      .map((f) => [f.name.slice(prefix.length), f]),
  );
  const json = parseJson(await jsonEntry.async("text"));
  const urls: string[] = [];
  return build(json, [...entries.keys()], async (name) => {
    const blob = await entries.get(name)!.async("blob");
    // SVG needs an explicit type to decode from a blob URL
    const typed = name.toLowerCase().endsWith(".svg") ? new Blob([blob], { type: "image/svg+xml" }) : blob;
    const url = URL.createObjectURL(typed);
    urls.push(url);
    return url;
  }, urls);
}
