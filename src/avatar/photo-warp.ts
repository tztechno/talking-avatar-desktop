import { VISEME_OPENNESS } from "../lipsync/phoneme-map";
import type { MouthState, Viseme } from "../lipsync/types";
import type { FaceGeometry } from "./photo-face";

/** Jaw drop at full openness, in mouth half-widths */
const MAX_DROP = 0.5;
/** Horizontal mouth scale per shape: I/E stretch, U/O round */
const PUCKER: Record<Viseme, number> = { X: 1, A: 0.96, I: 1.07, U: 0.7, O: 0.78, E: 1.04 };
/** How much of the upper teeth shows per shape */
const TEETH: Record<Viseme, number> = { X: 0, A: 0.75, I: 1, U: 0.25, O: 0.45, E: 1 };

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Backward warp: for each output pixel, find the source pixel. Mouth space is measured in
// mouth half-widths, x along the lips, y down. The lower face drops by u_open, the upper lip
// lifts a little, and the gap between them is painted as the inside of the mouth.
const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform vec2 u_mc;
uniform vec2 u_ax;
uniform float u_hw;
uniform float u_chin;
uniform float u_open;
uniform float u_pucker;
uniform float u_teeth;
uniform vec4 u_eye0;
uniform vec4 u_eye1;
uniform float u_blink;
varying vec2 v_uv;

float lens(float x, float w) {
  float t = x / w;
  return pow(max(0.0, 1.0 - t * t), 0.6);
}
// Lower face displacement (jaw drop) for source depth s >= 0
float lowerD(float sx, float s) {
  float w = mix(1.0, 2.0, smoothstep(0.0, 0.9, s));
  float neck = 1.0 - smoothstep(u_chin, u_chin + 0.8, s);
  return u_open * lens(sx, w) * neck;
}
// Upper lip lift for source depth s <= 0 (negative = up)
float upperD(float sx, float s) {
  return -0.22 * u_open * lens(sx, 1.0) * (1.0 - smoothstep(0.0, 0.8, -s));
}
// Blink: stretch the skin above the eye down over it
vec2 blink(vec2 p, vec4 e) {
  float lx = (p.x - e.x) / e.z;
  float c = u_blink * (1.0 - smoothstep(0.8, 1.25, abs(lx)));
  float y0 = e.y - e.w * 0.5;
  float y1 = e.y + e.w * 0.5;
  float ya = e.y - e.z * 0.9;
  if (c <= 0.0 || p.y < ya || p.y > y1) return p;
  float srcBottom = y1 - c * (y1 - y0 + e.w * 0.15);
  return vec2(p.x, ya + (p.y - ya) * (srcBottom - ya) / (y1 - ya));
}

void main() {
  vec2 p = v_uv * u_size;
  vec2 ny = vec2(-u_ax.y, u_ax.x);
  vec2 d = p - u_mc;
  float lx = dot(d, u_ax) / u_hw;
  float ly = dot(d, ny) / u_hw;

  // Pucker only around the lips, fading out before the nose and chin
  float r = length(vec2(lx, ly * 2.0));
  float sx = lx / mix(1.0, u_pucker, 1.0 - smoothstep(0.8, 1.7, r));
  float sy = ly;
  float cavity = 0.0;
  vec3 inside = vec3(0.0);

  if (u_open > 0.001) {
    float lo = ly - lowerD(sx, ly);
    for (int i = 0; i < 3; i++) lo = ly - lowerD(sx, max(lo, 0.0));
    float hi = ly - upperD(sx, ly);
    for (int i = 0; i < 3; i++) hi = ly - upperD(sx, min(hi, 0.0));
    if (lo >= 0.0) {
      sy = lo;
    } else if (hi <= 0.0) {
      sy = hi;
    } else {
      // In the opening between the lips
      sy = 0.0;
      float top = upperD(sx, 0.0);
      float bottom = lowerD(sx, 0.0);
      float gh = bottom - top;
      float yIn = ly - top;
      float edge = abs(sx);
      vec3 col = mix(vec3(0.32, 0.09, 0.10), vec3(0.09, 0.025, 0.03), smoothstep(0.15, 0.9, edge));
      col = mix(col, vec3(0.58, 0.24, 0.26), smoothstep(0.55, 1.0, yIn / gh) * (1.0 - smoothstep(0.3, 0.9, edge)) * 0.55);
      float th = min(0.16, gh * 0.42);
      float teeth = u_teeth * (1.0 - smoothstep(th - 0.015, th, yIn)) * (1.0 - smoothstep(0.5, 0.85, edge));
      col = mix(col, vec3(0.86, 0.82, 0.77) * (0.72 + 0.28 * (1.0 - yIn / th)), teeth);
      col *= mix(0.55, 1.0, smoothstep(0.0, 0.05, yIn));
      inside = col;
      // Soft edges against both lips and the mouth corners
      float px = 1.0 / u_hw;
      cavity = smoothstep(0.0, 1.5 * px, yIn) * smoothstep(0.0, 1.5 * px, bottom - ly) * (1.0 - smoothstep(0.93, 1.0, edge));
    }
  }

  vec2 q = u_mc + u_ax * (sx * u_hw) + ny * (sy * u_hw);
  if (u_blink > 0.0) {
    q = blink(q, u_eye0);
    q = blink(q, u_eye1);
  }
  vec4 base = texture2D(u_tex, q / u_size);
  gl_FragColor = vec4(mix(base.rgb, inside, cavity), max(base.a, cavity));
}`;

type Uniform = "u_tex" | "u_size" | "u_mc" | "u_ax" | "u_hw" | "u_chin" | "u_open" | "u_pucker" | "u_teeth" | "u_eye0" | "u_eye1" | "u_blink";
const UNIFORMS: Uniform[] = ["u_tex", "u_size", "u_mc", "u_ax", "u_hw", "u_chin", "u_open", "u_pucker", "u_teeth", "u_eye0", "u_eye1", "u_blink"];

/** Animates a single photo's mouth and eyelids by warping it on the GPU. */
export class PhotoWarp {
  readonly canvas = document.createElement("canvas");
  private gl: WebGLRenderingContext;
  private loc = {} as Record<Uniform, WebGLUniformLocation | null>;
  private hasEyes: boolean;
  // Smoothed shape parameters so switching visemes does not snap
  private open = 0;
  private pucker = 1;
  private teeth = 0;

  constructor(source: TexImageSource & { width: number; height: number }, face: FaceGeometry) {
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    const gl = this.canvas.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL is not available, so photos cannot be animated in this browser");
    this.gl = gl;

    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`Shader error: ${gl.getShaderInfoLog(sh)}`);
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Shader link error: ${gl.getProgramInfoLog(prog)}`);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    for (const u of UNIFORMS) this.loc[u] = gl.getUniformLocation(prog, u);
    gl.uniform1i(this.loc.u_tex, 0);
    gl.uniform2f(this.loc.u_size, source.width, source.height);

    const { left, right } = face.mouth;
    const center = face.mouth.center ?? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const len = Math.hypot(right.x - left.x, right.y - left.y) || 1;
    const ax = { x: (right.x - left.x) / len, y: (right.y - left.y) / len };
    const hw = len / 2;
    // Chin depth measured along the mouth's downward normal
    const chinDepth = face.chin ? (face.chin.x - center.x) * -ax.y + (face.chin.y - center.y) * ax.x : 0.75 * len;
    gl.uniform2f(this.loc.u_mc, center.x, center.y);
    gl.uniform2f(this.loc.u_ax, ax.x, ax.y);
    gl.uniform1f(this.loc.u_hw, hw);
    gl.uniform1f(this.loc.u_chin, Math.max(0.8, chinDepth / hw));

    this.hasEyes = !!face.eyes;
    face.eyes?.forEach((e, i) => {
      const cx = (e.outer.x + e.inner.x) / 2;
      const cy = (e.top.y + e.bottom.y) / 2;
      const halfW = Math.abs(e.outer.x - e.inner.x) / 2;
      gl.uniform4f(this.loc[i ? "u_eye1" : "u_eye0"], cx, cy, halfW, Math.max(2, e.bottom.y - e.top.y));
    });
  }

  /** Draws one frame. blink: 0 = eyes open, 1 = closed. */
  render(mouth: MouthState, blink: number): HTMLCanvasElement {
    const { gl, loc } = this;
    const v = mouth.viseme;
    const target = v === "X" ? 0 : Math.min(1, mouth.open) * VISEME_OPENNESS[v];
    this.open += (target - this.open) * 0.6;
    this.pucker += (PUCKER[v] - this.pucker) * 0.35;
    this.teeth += (TEETH[v] - this.teeth) * 0.35;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1f(loc.u_open, this.open * MAX_DROP);
    gl.uniform1f(loc.u_pucker, this.pucker);
    gl.uniform1f(loc.u_teeth, this.teeth);
    gl.uniform1f(loc.u_blink, this.hasEyes ? blink : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }

  dispose(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
