const CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  // Safari only records mp4
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
];

export function pickMimeType(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string | undefined {
  return CANDIDATES.find(isSupported);
}

export function extensionFor(mime: string): "webm" | "mp4" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

/**
 * Records the avatar canvas, plus an optional audio node, into a video Blob.
 * Audio is tapped via a MediaStreamDestination on the node's own AudioContext.
 */
export class Recorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private audioDest: MediaStreamAudioDestinationNode | null = null;
  readonly mimeType: string;

  static get supported(): boolean {
    return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
  }

  constructor(
    canvas: HTMLCanvasElement,
    private audio?: AudioNode,
    fps = 30,
  ) {
    const mime = pickMimeType();
    if (!mime) throw new Error("This browser cannot record video");
    this.mimeType = mime;
    const tracks = canvas.captureStream(fps).getVideoTracks();
    // Only add an audio track when there is real audio: an idle track can stall some muxers
    if (audio) {
      this.audioDest = (audio.context as AudioContext).createMediaStreamDestination();
      audio.connect(this.audioDest);
      tracks.push(...this.audioDest.stream.getAudioTracks());
    }
    this.recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
  }

  start(): void {
    this.chunks = [];
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    const rec = this.recorder;
    if (rec.state === "inactive") return Promise.resolve(new Blob(this.chunks, { type: this.mimeType }));
    return new Promise((resolve) => {
      rec.onstop = () => {
        if (this.audio && this.audioDest) {
          try {
            this.audio.disconnect(this.audioDest);
          } catch {
            /* already disconnected when the session ended */
          }
        }
        rec.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(this.chunks, { type: this.mimeType }));
      };
      rec.stop();
    });
  }
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
