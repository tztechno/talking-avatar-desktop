# Talking Avatar Desktop (macOS & Windows)

**Talking Avatar Desktop** は、テキストを入力するだけで2Dアバターが高品質な音声合成・リップシンク・まばたき・自然な頭部動作とともに喋るデスクトップアプリケーション（macOS / Windows対応）です。

Rust 製の軽量・高速フレームワーク **Tauri 2.0** を基盤に採用し、低リソース消費・高速起動・ローカル処理（プライバシー保護）を実現しています。

---

## 主な機能

- **ハイブリッド音声合成システム (Edge Neural Voice & OS System Voice)**:
  - **Edge Neural Voice（メイン / 高品質 AI 音声）**:
    - 日本語（Nanami, Keita, Aoi, Daichi, Mayu, Naoki, Shiori 等）および英語（Jenny, Guy, Aria 等）を含む **50種類近い最高峰の Neural 音声** を無料・APIキー不要で即座に利用可能。
    - 音声付き動画エクスポートに対応。
  - **OS System Voice（サブ / オフライン）**:
    - オフライン時やOS内蔵のシステム音声を使用可能。
- **音声連動リアルタイム・リップシンク**:
  - 音声波形解析（FFTスペクトラム・音量）および単語境界イベントによる高精度で自然な口パク。
- **フォト・アバター対応**:
  - 写真1枚（ポートレート）をドラッグ＆ドロップするだけで、MediaPipe Face Landmarker により自動顔認識＆WebGLメッシュワープで自然に発話・瞬き。
- **カスタムイラスト・2Dアバター対応**:
  - 独自パーツ（目・口の各母音画像・顔）を含むフォルダや ZIP ファイルを読み込み可能。
- **音声付き動画エクスポート**:
  - アバターの読み上げアニメーションと合成音声を `.webm` / `.mp4` 形式でワンクリック保存（クロマキー合成用グリーンバック対応）。

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
