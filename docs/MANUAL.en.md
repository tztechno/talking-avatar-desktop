# Talking Avatar Desktop User Manual

[日本語版はこちら](MANUAL.ja.md)

**Talking Avatar** is a desktop application for macOS and Windows that brings 2D avatars and portraits to life as they speak your text aloud.
The avatar naturally syncs its mouth movements with speech audio, blinks, and sways smoothly.
You can use built-in avatars, load your own photo portrait, or import custom 2D illustration avatars, and export the resulting performance as a video file (WebM / MP4).

All processing is executed locally on your computer — no text, voice, or photo data is uploaded to external servers. With zero model download waiting time, you can launch the app and start generating speech immediately.

---

## 1. Installation & Launch

### macOS
1. Open the downloaded DMG file (e.g. `Talking Avatar_0.1.0_aarch64.dmg` for Apple Silicon or `_x64.dmg` for Intel).
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
| **Voice / Speed** | Select speaker voice and playback rate (0.5x to 2.0x). Supports Japanese (Kyoko, Otoya, Siri, etc.), English, and all OS-installed system languages. |
| **Text Area** | Enter or paste the text to speak. Active sentences are highlighted in real time. |
| **Speak / Pause / Stop** | Start, pause, or cancel speech playback. |
| **Speak & record video** | Animate and record video & audio output, saving directly as a video file. |
| **Status Bar** | Displays application status, notifications, and messages. |

---

## 3. Basic Usage

### 3.1 Speaking Text
1. Choose your preferred language voice from the **Voice** dropdown (e.g. Japanese voices like `Kyoko` or `Otoya`, or English voices).
2. Adjust the playback rate with the **Speed** slider.
3. Type or paste your text into the text area.
4. Click **"Speak"** to start speech immediately with real-time avatar mouth animation.

---

## 4. Photo Avatar

Turn any front-facing portrait photo into a talking avatar in seconds.

1. Click **"Load photo"** or drag and drop an image onto the stage.
2. MediaPipe automatically detects facial landmarks (eyes, lips, chin).
3. The avatar naturally articulates its mouth and blinks along with speech.
4. *Note: If automatic detection is inaccurate due to lighting or angle, click "Mark mouth" and click the left and right mouth corners.*

---

## 5. Custom 2D Illustration Avatars

Import a folder or ZIP containing layered parts for custom 2D characters.

### Required File Structure
- `avatar.json` (configuration)
- `base.png` (face base without eyes and mouth)
- `eyes_open.png`, `eyes_half.png` (optional), `eyes_closed.png` (blinking states)
- `mouth_X.png` (closed/neutral), `mouth_A.png`, `mouth_I.png`, `mouth_U.png`, `mouth_E.png`, `mouth_O.png` (viseme shapes)

All images must share the same canvas dimensions (e.g. 512x512).

---

## 6. Video Export

1. Set the background to **"Chroma green"** (or another desired background).
2. Enter your script and click **"Speak & record video"**.
3. Once speech finishes, the video file (`.webm`) will be saved automatically.
4. Import into video editors (Premiere, DaVinci Resolve, Final Cut Pro, OBS) for chroma key compositing.
