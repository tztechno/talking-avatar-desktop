import { REST, type LipSync, type MouthState, type Viseme } from "../lipsync/types";
import { Blinker } from "./blink";
import type { EyeState } from "./manifest";
import type { LoadedAvatar } from "./loader";
import type { FaceGeometry } from "./photo-face";
import { PhotoWarp } from "./photo-warp";

const EYE_CLOSURE: Record<EyeState, number> = { open: 0, half: 0.55, closed: 1 };

/** Canvas 2D renderer: layered sprites, blinking, breathing, head sway and nods. */
export class AvatarRenderer {
  lipSync: LipSync | null = null;
  /** When set, overrides lip-sync (debug buttons) */
  manualViseme: Viseme | null = null;
  /** CSS colour, or null for transparent */
  background: string | null = null;
  /** Talking mode adds a little more head motion */
  talking = false;
  mouth: MouthState = REST;
  fps = 0;
  onFrame?: (mouth: MouthState) => void;

  private ctx: CanvasRenderingContext2D;
  private avatar: LoadedAvatar | null = null;
  private warp: PhotoWarp | null = null;
  private blinker = new Blinker();
  private raf = 0;
  private nodStart = -Infinity;
  private frames = 0;
  private fpsWindow = 0;
  private scale = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  setAvatar(avatar: LoadedAvatar): void {
    const warp = avatar.photo?.face ? new PhotoWarp(avatar.photo.image, avatar.photo.face) : null;
    this.warp?.dispose();
    this.warp = warp;
    this.avatar?.dispose();
    this.avatar = avatar;
    const { width, height, blink } = avatar.manifest;
    this.blinker = new Blinker(blink.minInterval, blink.maxInterval, blink.duration);
    // Render at up to 2x for crisp output while keeping export sizes sensible
    this.scale = Math.max(1, Math.min(2, 1024 / Math.max(width, height)));
    this.canvas.width = Math.round(width * this.scale);
    this.canvas.height = Math.round(height * this.scale);
  }

  /** Sets (or replaces) where the current photo avatar's mouth and eyes are. */
  setPhotoFace(face: FaceGeometry): void {
    const photo = this.avatar?.photo;
    if (!photo) return;
    const warp = new PhotoWarp(photo.image, face);
    this.warp?.dispose();
    this.warp = warp;
    photo.face = face;
  }

  get isPhoto(): boolean {
    return !!this.avatar?.photo;
  }

  nod(): void {
    this.nodStart = performance.now() / 1000;
  }

  start(): void {
    if (this.raf) return;
    const loop = (ms: number) => {
      this.draw(ms / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  draw(t: number): void {
    this.trackFps(t);
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.background) {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const a = this.avatar;
    if (!a) return;
    const m = a.manifest;

    this.mouth = this.manualViseme
      ? { viseme: this.manualViseme, open: this.manualViseme === "X" ? 0 : 1 }
      : (this.lipSync?.frame(t) ?? REST);
    const eyes: EyeState = this.blinker.eyes(t);

    // Idle motion: sum of slow sines reads as organic sway; nod is a damped dip.
    // Photos include the background, so they move much less.
    const amp = (this.talking ? 1.6 : 1) * (a.photo ? 0.35 : 1);
    const sway = (Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.3 + 1) * 0.4) * 0.018 * amp;
    const bob = Math.sin(t * 0.9 + 2) * 1.5 * amp;
    const nodT = t - this.nodStart;
    const nod = nodT >= 0 && nodT < 0.6 ? Math.sin((nodT / 0.6) * Math.PI) * 0.035 : 0;
    const breathe = 1 + Math.sin((t * Math.PI * 2) / 4) * 0.006;

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.translate(m.pivot.x, m.pivot.y + bob);
    ctx.rotate(sway);
    ctx.scale(1, breathe);
    // Nod: tilt forward by squashing slightly and shifting down
    ctx.translate(0, nod * 60);
    ctx.scale(1, 1 - nod * 0.4);
    ctx.translate(-m.pivot.x, -m.pivot.y);

    if (a.photo) {
      // Slight overscale hides the edges the sway would reveal
      ctx.translate(m.width / 2, m.height / 2);
      ctx.scale(1.02, 1.02);
      ctx.translate(-m.width / 2, -m.height / 2);
      const frame = this.warp ? this.warp.render(this.mouth, EYE_CLOSURE[eyes]) : a.photo.image;
      ctx.drawImage(frame, 0, 0, m.width, m.height);
      this.onFrame?.(this.mouth);
      return;
    }

    const img = a.images;
    this.drawLayer(img.base);
    this.drawLayer(img[`eyes_${eyes}`] ?? (eyes === "half" ? img.eyes_closed : img.eyes_open));

    const mouthImg = img[`mouth_${this.mouth.viseme}`];
    if (mouthImg) {
      // Scale the shape vertically with openness so loudness reads even with 6 sprites
      const sy = this.mouth.viseme === "X" ? 1 : 0.7 + 0.35 * Math.min(1, this.mouth.open);
      ctx.save();
      ctx.translate(m.mouthAnchor.x, m.mouthAnchor.y);
      ctx.scale(1, sy);
      ctx.translate(-m.mouthAnchor.x, -m.mouthAnchor.y);
      this.drawLayer(mouthImg);
      ctx.restore();
    }
    this.onFrame?.(this.mouth);
  }

  private drawLayer(img?: HTMLImageElement): void {
    if (!img || !this.avatar) return;
    const { width, height } = this.avatar.manifest;
    this.ctx.drawImage(img, 0, 0, width, height);
  }

  private trackFps(t: number): void {
    this.frames++;
    if (t - this.fpsWindow >= 1) {
      this.fps = this.frames / (t - this.fpsWindow);
      this.frames = 0;
      this.fpsWindow = t;
    }
  }
}
