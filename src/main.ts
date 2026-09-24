import "./style.css";
import { AvatarLoadError, loadAvatarFromFiles, loadAvatarFromUrl, type LoadedAvatar } from "./avatar/loader";
import type { Point } from "./avatar/manifest";
import { AvatarRenderer } from "./avatar/renderer";
import { download, extensionFor, Recorder } from "./export/recorder";
import { AudioLipSync } from "./lipsync/audio-lipsync";
import { EventLipSync } from "./lipsync/event-lipsync";
import { VISEMES, type Viseme } from "./lipsync/types";
import { EdgeEngine, type EdgeSession } from "./tts/edge-engine";
import type { EngineId, SpeechSession, TTSEngine } from "./tts/types";
import { WebSpeechEngine } from "./tts/webspeech-engine";
import { TextHighlighter } from "./ui/highlighter";
import { loadSettings, saveSettings } from "./ui/settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  canvas: $<HTMLCanvasElement>("avatar-canvas"),
  stage: $("stage"),
  bgMode: $<HTMLSelectElement>("bg-mode"),
  bgColor: $<HTMLInputElement>("bg-color"),
  avatarFolder: $<HTMLInputElement>("avatar-folder"),
  avatarZip: $<HTMLInputElement>("avatar-zip"),
  avatarPhoto: $<HTMLInputElement>("avatar-photo"),
  avatarBuiltin: $<HTMLSelectElement>("avatar-builtin"),
  markMouth: $<HTMLButtonElement>("mark-mouth"),
  visemeButtons: $("viseme-buttons"),
  fps: $("fps"),
  voice: $<HTMLSelectElement>("voice"),
  speed: $<HTMLInputElement>("speed"),
  speedOut: $<HTMLOutputElement>("speed-out"),
  text: $<HTMLTextAreaElement>("text"),
  backdrop: $("text-backdrop"),
  speak: $<HTMLButtonElement>("speak"),
  pause: $<HTMLButtonElement>("pause"),
  stop: $<HTMLButtonElement>("stop"),
  record: $<HTMLButtonElement>("record"),
  status: $("status"),
};

const settings = loadSettings();
const now = () => performance.now() / 1000;

let audioCtx: AudioContext | null = null;
const getAudioCtx = () => (audioCtx ??= new AudioContext());

const edge = new EdgeEngine(getAudioCtx);
const webspeech = new WebSpeechEngine();
const engines: Record<EngineId, TTSEngine> = {
  edge,
  webspeech,
};

const renderer = new AvatarRenderer(ui.canvas);
const highlighter = new TextHighlighter(ui.text, ui.backdrop);

let session: SpeechSession | null = null;
let paused = false;
let recorder: Recorder | null = null;

// ---------- status ----------

function setStatus(msg: string, isError = false): void {
  ui.status.textContent = msg;
  ui.status.classList.toggle("error", isError);
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- avatar ----------

const builtinAvatar = () => `${import.meta.env.BASE_URL}avatars/${settings.avatar}/`;

let current: LoadedAvatar | null = null;
/** True while an avatar or photo is being loaded / its face detected */
let avatarBusy = false;
/** Only the most recent load is applied if several overlap */
let loadSeq = 0;

/** The avatar can talk: loaded, not loading, and (for photos) the mouth is known. */
function avatarReady(): boolean {
  return !!current && !avatarBusy && !marking && (!current.photo || !!current.photo.face);
}

/** Tells the user whether Speak can be pressed now, or what is still missing. */
function readyHint(): string {
  if (!avatarReady()) return "";
  return "Ready — press Speak.";
}

function applyAvatar(a: LoadedAvatar): void {
  cancelMarking();
  renderer.setAvatar(a);
  current = a;
  ui.markMouth.hidden = !a.photo;
  if (a.photo && !a.photo.face) {
    startMarking(a.warnings.join(" "));
    return;
  }
  const warn = a.warnings.length ? `\n${a.warnings.join("\n")}` : "";
  setStatus(`Avatar "${a.manifest.name}" loaded. ${readyHint()}${warn}`);
}

// ---------- marking the mouth on a photo ----------

let marking: Point[] | null = null;

/** Canvas click -> photo pixel, allowing for object-fit letterboxing. */
function toImagePoint(e: MouseEvent): Point | null {
  const m = current?.manifest;
  if (!m) return null;
  const r = ui.canvas.getBoundingClientRect();
  const k = Math.min(r.width / m.width, r.height / m.height);
  const x = (e.clientX - r.left - (r.width - m.width * k) / 2) / k;
  const y = (e.clientY - r.top - (r.height - m.height * k) / 2) / k;
  return x >= 0 && y >= 0 && x <= m.width && y <= m.height ? { x, y } : null;
}

function startMarking(reason = ""): void {
  marking = [];
  renderer.manualViseme = "X";
  ui.stage.classList.add("marking");
  setStatus(`${reason ? `${reason} ` : ""}Click the LEFT corner of the mouth on the photo (Esc to cancel).`);
  updateButtons();
}

function cancelMarking(): void {
  if (!marking) return;
  marking = null;
  renderer.manualViseme = null;
  ui.stage.classList.remove("marking");
  updateButtons();
}

ui.canvas.addEventListener("click", (e) => {
  if (!marking || !current?.photo) return;
  const p = toImagePoint(e);
  if (!p) return;
  marking.push(p);
  if (marking.length === 1) return setStatus("Now click the RIGHT corner of the mouth.");
  const [a, b] = marking[0].x <= marking[1].x ? marking : [marking[1], marking[0]];
  cancelMarking();
  try {
    renderer.setPhotoFace({ mouth: { left: a, right: b }, eyes: current.photo.face?.eyes });
    updateButtons();
    setStatus(`Mouth marked. ${readyHint()}`);
  } catch (err) {
    setStatus(errorText(err), true);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && marking) {
    cancelMarking();
    setStatus(avatarReady() ? readyHint() : "The mouth is not marked yet. Press Mark mouth to mark it.");
  }
});
ui.markMouth.addEventListener("click", () => startMarking());

async function loadAvatar(load: () => Promise<LoadedAvatar>, busyText = "Loading avatar…"): Promise<void> {
  const seq = ++loadSeq;
  avatarBusy = true;
  cancelMarking();
  setStatus(busyText);
  updateButtons();
  try {
    const a = await load();
    if (seq !== loadSeq) return a.dispose();
    avatarBusy = false;
    applyAvatar(a);
  } catch (e) {
    if (seq !== loadSeq) return;
    avatarBusy = false;
    const problems = e instanceof AvatarLoadError ? e.problems : [errorText(e)];
    setStatus(`Could not load avatar:\n• ${problems.join("\n• ")}`, true);
  } finally {
    if (seq === loadSeq) {
      avatarBusy = false;
      updateButtons();
    }
  }
}

function loadFiles(files: File[]): void {
  if (!files.length) return;
  const photo = files.length === 1 && files[0].type.startsWith("image/");
  void loadAvatar(() => loadAvatarFromFiles(files), photo ? "Finding the face in the photo…" : "Loading avatar…");
}

ui.avatarFolder.addEventListener("change", () => {
  loadFiles([...(ui.avatarFolder.files ?? [])]);
  ui.avatarFolder.value = "";
});
ui.avatarZip.addEventListener("change", () => {
  loadFiles([...(ui.avatarZip.files ?? [])]);
  ui.avatarZip.value = "";
});
ui.avatarPhoto.addEventListener("change", () => {
  loadFiles([...(ui.avatarPhoto.files ?? [])]);
  ui.avatarPhoto.value = "";
});
ui.avatarBuiltin.value = settings.avatar;
ui.avatarBuiltin.addEventListener("change", () => {
  settings.avatar = ui.avatarBuiltin.value as typeof settings.avatar;
  saveSettings(settings);
  void loadAvatar(() => loadAvatarFromUrl(builtinAvatar()));
});

// Drag and drop: a .zip, or loose files from a folder
ui.stage.addEventListener("dragover", (e) => {
  e.preventDefault();
  ui.stage.classList.add("dragging");
});
ui.stage.addEventListener("dragleave", () => ui.stage.classList.remove("dragging"));
ui.stage.addEventListener("drop", (e) => {
  e.preventDefault();
  ui.stage.classList.remove("dragging");
  void collectDropped(e.dataTransfer).then(loadFiles);
});

async function collectDropped(dt: DataTransfer | null): Promise<File[]> {
  if (!dt) return [];
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  const dir = entries.find((e) => e.isDirectory) as FileSystemDirectoryEntry | undefined;
  if (!dir) return [...dt.files];
  const children = await new Promise<FileSystemEntry[]>((res, rej) => dir.createReader().readEntries(res, rej));
  return Promise.all(
    children
      .filter((c): c is FileSystemFileEntry => c.isFile)
      .map((c) => new Promise<File>((res, rej) => c.file(res, rej))),
  );
}

// ---------- background ----------

function applyBackground(): void {
  const mode = ui.bgMode.value as typeof settings.bgMode;
  settings.bgMode = mode;
  settings.bgColor = ui.bgColor.value;
  renderer.background = mode === "transparent" ? null : mode === "chroma" ? "#00b140" : ui.bgColor.value;
  ui.bgColor.hidden = mode !== "color";
  saveSettings(settings);
}
ui.bgMode.value = settings.bgMode;
ui.bgColor.value = settings.bgColor;
ui.bgMode.addEventListener("change", applyBackground);
ui.bgColor.addEventListener("input", applyBackground);

// ---------- debug visemes ----------

function renderVisemeButtons(): void {
  const make = (label: string, v: Viseme | null) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-pressed", String(renderer.manualViseme === v));
    b.addEventListener("click", () => {
      renderer.manualViseme = v;
      renderVisemeButtons();
    });
    return b;
  };
  ui.visemeButtons.replaceChildren(make("Auto", null), ...VISEMES.map((v) => make(v, v)));
}

setInterval(() => (ui.fps.textContent = `${renderer.fps.toFixed(0)} fps`), 1000);

// ---------- engine & voices ----------

const engine = () => engines[settings.engine];

function renderVoices(): void {
  const list = engine().voices();
  const wanted = settings.voice[settings.engine];
  ui.voice.replaceChildren();
  if (!list.length) {
    ui.voice.append(new Option("No voices found", ""));
    ui.voice.disabled = true;
    return;
  }
  ui.voice.disabled = false;
  // Group by language so long voice lists stay navigable
  const groups = new Map<string, HTMLOptGroupElement>();
  const sorted = [...list].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  for (const v of sorted) {
    let g = groups.get(v.lang);
    if (!g) {
      g = Object.assign(document.createElement("optgroup"), { label: v.lang || "Other" });
      groups.set(v.lang, g);
      ui.voice.append(g);
    }
    g.append(new Option(v.name, v.id));
  }
  const fallback =
    list.find((v) => v.lang.toLowerCase().startsWith(navigator.language.slice(0, 2))) ??
    list.find((v) => v.id.includes("Nanami")) ??
    list[0];
  ui.voice.value = list.some((v) => v.id === wanted) ? wanted : fallback.id;
}

function renderEngine(): void {
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="engine"]')) {
    r.checked = r.value === settings.engine;
  }
  ui.record.title =
    settings.engine === "webspeech"
      ? "OS browser voices cannot be captured: the video will have no sound"
      : "Speak and download a video of the avatar (with audio)";
  renderVoices();
  updateButtons();
}

for (const r of document.querySelectorAll<HTMLInputElement>('input[name="engine"]')) {
  r.addEventListener("change", () => {
    stopSpeaking();
    settings.engine = r.value as EngineId;
    saveSettings(settings);
    renderEngine();
  });
}

ui.voice.addEventListener("change", () => {
  settings.voice[settings.engine] = ui.voice.value;
  saveSettings(settings);
});

ui.speed.value = String(settings.speed);
const renderSpeed = () => (ui.speedOut.textContent = `${Number(ui.speed.value).toFixed(1)}×`);
ui.speed.addEventListener("input", () => {
  settings.speed = Number(ui.speed.value);
  renderSpeed();
  saveSettings(settings);
});

// ---------- speaking ----------

function updateButtons(): void {
  const active = !!session;
  const ready = avatarReady();
  ui.speak.disabled = active || !ready;
  ui.record.disabled = active || !ready || !Recorder.supported;
  ui.markMouth.disabled = avatarBusy;
  ui.pause.disabled = !active;
  ui.stop.disabled = !active;
  ui.pause.textContent = paused ? "Resume" : "Pause";
}

function stopSpeaking(): void {
  session?.stop();
}

async function speak(record: boolean): Promise<void> {
  stopSpeaking();
  const text = ui.text.value;
  if (!text.trim()) return setStatus("Type some text first.");
  settings.text = text;
  saveSettings(settings);

  let s: SpeechSession;
  try {
    s = engine().speak(text, { voice: ui.voice.value, speed: settings.speed });
  } catch (e) {
    return setStatus(errorText(e), true);
  }
  session = s;
  paused = false;

  const isEdge = settings.engine === "edge";
  const eventSync = new EventLipSync(text, settings.speed);
  let audioSync: AudioLipSync | null = null;

  renderer.lipSync = eventSync;
  setStatus(isEdge ? "Generating AI speech…" : "Speaking…");

  s.on("start", () => {
    if (isEdge && (s as EdgeSession).analyser) {
      audioSync = new AudioLipSync((s as EdgeSession).analyser);
      renderer.lipSync = audioSync;
    } else {
      eventSync.start(now());
      renderer.lipSync = eventSync;
    }
    renderer.talking = true;

    if (record) {
      try {
        recorder = new Recorder(ui.canvas, s.audioNode);
        recorder.start();
        setStatus("Speaking and recording…");
      } catch (e) {
        recorder = null;
        setStatus(`Recording unavailable: ${errorText(e)}`, true);
      }
    } else {
      setStatus("Speaking…");
    }
    updateButtons();
  });

  s.on("sentence", (ev) => {
    highlighter.highlight(ev.charIndex, ev.text.length);
    renderer.nod();
  });
  s.on("word", (w) => {
    if (!audioSync) eventSync.word(w.charIndex, w.charLength, now());
  });
  s.on("error", (e) => setStatus(errorText(e), true));
  s.on("end", () => {
    eventSync.end();
    renderer.talking = false;
    highlighter.clear();
    if (session === s) {
      session = null;
      paused = false;
    }
    updateButtons();
    if (recorder) void finishRecording();
    else if (!ui.status.classList.contains("error")) setStatus("");
  });
  updateButtons();
}

async function finishRecording(): Promise<void> {
  const rec = recorder!;
  recorder = null;
  await new Promise((r) => setTimeout(r, 300));
  const blob = await rec.stop();
  if (!blob.size) return setStatus("Recording was empty.", true);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  download(blob, `avatar-${stamp}.${extensionFor(rec.mimeType)}`);
  setStatus(`Video saved (${(blob.size / 1024 / 1024).toFixed(1)} MB, ${extensionFor(rec.mimeType)}).`);
}

ui.speak.addEventListener("click", () => void speak(false));
ui.record.addEventListener("click", () => void speak(true));
ui.stop.addEventListener("click", stopSpeaking);
ui.pause.addEventListener("click", () => {
  if (!session) return;
  paused = !paused;
  if (paused) session.pause();
  else session.resume();
  if (renderer.lipSync instanceof EventLipSync) renderer.lipSync.setPaused(paused);
  updateButtons();
});
// Ctrl/Cmd+Enter speaks
ui.text.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !ui.speak.disabled) void speak(false);
});

// ---------- boot ----------

async function boot(): Promise<void> {
  ui.text.value = settings.text;
  renderSpeed();
  applyBackground();
  renderVisemeButtons();
  renderer.start();
  await loadAvatar(() => loadAvatarFromUrl(builtinAvatar()));

  // Initialize both engines
  const initPromises: Promise<void>[] = [];
  initPromises.push(edge.init().catch(() => undefined));
  if (WebSpeechEngine.supported) {
    initPromises.push(webspeech.init().catch(() => undefined));
  }

  await Promise.all(initPromises);
  renderEngine();
  updateButtons();
}

void boot();

// Hook for integration tests
Object.assign(window, { __talkingAvatar: { renderer, edge, webspeech } });
