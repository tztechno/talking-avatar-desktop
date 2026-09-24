# Talking Avatar Desktop User Manual

[日本語版はこちら](MANUAL.ja.md)

**Talking Avatar** is a desktop application for macOS and Windows that brings 2D avatars and portraits to life as they speak your text aloud.
The avatar naturally syncs its mouth movements with speech audio, blinks, and sways smoothly.
You can use built-in avatars, load your own photo portrait, or import custom 2D illustration avatars, and export the resulting performance as a video file (WebM / MP4).

All processing is executed locally on your computer — no text, voice, or photo data is uploaded to external servers.

---

## 1. Installation & Launch

### macOS
1. Open the downloaded DMG file (e.g. `Talking-Avatar_0.1.0_aarch64.dmg` for Apple Silicon or `_x64.dmg` for Intel).
2. Drag and drop the `Talking Avatar` icon into your `Applications` folder.
3. Launch `Talking Avatar` from Applications.
   - *Note: If an unidentified developer security prompt appears, right-click (or Control-click) the app in Finder, select "Open", and confirm.*

### Windows
1. Open the downloaded installer (e.g. `Talking-Avatar_0.1.0_x64-setup.exe` or `.msi`).
2. Follow the on-screen setup wizard to complete installation.
3. Launch from the Desktop or Start Menu.
   - *Note: If Windows Defender SmartScreen displays a warning, click "More info" and select "Run anyway".*

---

## 2. Interface Overview

| Area | Description |
|---|---|
| **Stage (Left)** | Displays the animated avatar. Drag & drop portrait photos or avatar ZIP files directly onto this area. |
| **Background** | Select background mode: **Transparent**, **Colour** (custom color picker), or **Chroma green** (for video overlay). |
| **Load photo** | Import your own portrait image (JPG / PNG / WebP). |
| **Load folder / Load .zip** | Import custom multi-layer avatar illustration folders or ZIP packages. |
| **Avatar Selector** | Switch between built-in presets: **Sample photo** or **Illustration**. |
| **Mark mouth** | Re-mark the mouth corners manually if photo automatic face detection requires adjustment. |
| **Mouth shapes (debug)** | Test mouth visemes manually (A, I, U, E, O, X) and monitor rendering FPS. |
| **Speech Engine (Top Right)** | Switch between **Kokoro (AI voice, English)** (neural ONNX model) and **Browser / System voice** (native OS speech, supports Japanese and all system languages). |
| **Voice / Speed** | Select speaker voice and playback rate (0.5x to 2.0x). |
| **Text Area** | Enter or paste the text to speak. Active sentences are highlighted in real time. |
| **Speak / Pause / Stop** | Start, pause, or cancel speech playback. |
| **Speak & record video** | Animate and record video & audio output, saving directly as a video file. |
| **Status Bar** | Displays download progress, notifications, and status messages. |

---

## 3. Features & Usage

### 3.1 Japanese & Multilingual Speech
1. Select **"Browser voice"** engine.
2. Choose your preferred language voice (e.g. Japanese voices like Kyoko or Otoya).
3. Type text into the text area and click **"Speak"**.

### 3.2 High-Quality AI Voice (Kokoro English)
1. Select **"Kokoro (AI voice, English)"**.
2. Click **"Download & load model"** on first launch (downloads the compact ~90 MB ONNX model once; cached for future offline use).
3. Select from 28+ natural voice profiles and click **"Speak"**.

### 3.3 Photo Avatar
- Drop any clear front-facing portrait photo.
- MediaPipe automatically detects facial landmarks (eyes, lips, chin).
- WebGL GPU mesh deformation creates smooth jaw movement, lip articulation, and eyelid blinks.

### 3.4 Custom 2D Illustration Avatars
- Import a folder or ZIP containing `avatar.json`, `base.png`, blink eye images (`eyes_open.png`, `eyes_closed.png`), and viseme mouth shapes (`mouth_A.png`, `mouth_I.png`, etc.).

### 3.5 Video Export
- Choose **Chroma green** background.
- Click **"Speak & record video"** to automatically record and download `.webm` / `.mp4` footage for video editing and streaming.
