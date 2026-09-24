# Talking Avatar Desktop (macOS & Windows)

**Talking Avatar Desktop** は、テキストを入力するだけで2Dアバターが高品質な音声合成・リップシンク・まばたき・自然な頭部動作とともに喋るデスクトップアプリケーション（macOS / Windows対応）です。

Rust 製の軽量・高速フレームワーク **Tauri 2.0** を基盤に採用し、低リソース消費・高速起動・ローカル処理（プライバシー保護）を実現しています。

---

## 主な機能

- **2種類の音声合成エンジン**:
  - **Kokoro (AI Voice / ONNX 82M)**: 自然な抑揚の高品質 AI 音声合成（英語・WebGPU / WASM 高速化）。
  - **システムネイティブ音声 (System / Web Speech)**: OS 内蔵の多言語音声エンジン（日本語をはじめとする世界各国の言語に対応）。
- **音声連動リアルタイム・リップシンク**:
  - 母音・音素（Phoneme / Viseme）および音響周波数（FFTバンド）解析による滑らかな口パク。
- **フォト・アバター対応**:
  - 写真1枚（ポートレート）をドラッグ＆ドロップするだけで、MediaPipe Face Landmarker により自動顔認識＆WebGLメッシュワープで自然に発話・瞬き。
- **カスタムイラスト・2Dアバター対応**:
  - 独自パーツ（目・口の各母音画像・顔）を含むフォルダや ZIP ファイルを読み込み可能。
- **動画エクスポート**:
  - アバターの読み上げアニメーションと音声を `.webm` / `.mp4` 形式でワンクリック保存（クロマキー合成用グリーンバック対応）。

---

## インストールと起動

### macOS (.dmg)
1. リリースページまたは Artifacts から `Talking-Avatar_x.x.x_aarch64.dmg`（Apple Silicon）または `Talking-Avatar_x.x.x_x64.dmg`（Intel Mac）をダウンロードします。
2. `.dmg` ファイルを開き、`Talking Avatar.app` を `Applications`（アプリケーション）フォルダにドラッグ＆ドロップします。
3. 初回起動時に「開発元が未確認」の警告が出た場合は、**Finderで右クリック（control + クリック）→「開く」**を選択して実行してください。

### Windows (.exe / .msi)
1. リリースページまたは Artifacts から `Talking-Avatar_x.x.x_x64-setup.exe` または `.msi` をダウンロードします。
2. インストーラーを起動し、画面の指示に従ってインストールします。
3. Windows Defender SmartScreen の警告が表示された場合は、**「詳細情報」→「実行」**をクリックしてください。

---

## 開発とビルド

### 必要環境
- **Node.js**: v20 以上
- **Rust**: 1.77.2 以上 (`rustup`, `cargo`)
- **OS**: macOS または Windows

### コマンド一覧

```bash
# 依存関係のインストール
npm install

# 開発モード起動 (ホットリロード)
npm run tauri dev

# フロントエンド単体ビルド
npm run build

# デスクトップアプリのパッケージング (.dmg / .exe / .msi)
npm run tauri build
```

---

## GitHub Actions 自動ビルド

本リポジトリに push されると、GitHub Actions (`.github/workflows/build-desktop.yml`) により自動的に以下がビルドされます：
- **Windows (x64)**: `.exe` (NSIS インストーラー), `.msi`
- **macOS (Apple Silicon & Intel)**: `.dmg` パッケージ

タグ（例: `v0.1.0`）を push すると、自動的に GitHub Releases に各バイナリが公開されます。
