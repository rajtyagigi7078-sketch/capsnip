# Capsnip local desktop app

Capsnip is a Windows-first, local-first caption editor. This folder contains the Electron desktop shell, the reference-inspired UI, 62 caption themes (35 typography themes, 15 Snip AI FFmpeg presets, and 12 Motion Graphic Caption styles), a Python `faster-whisper` adapter, local project save/open, and subtitle/video export. The template browser uses lightweight, muted, looped previews that load near the viewport.

## Start the desktop app

1. Install Python 3.11 or 3.12.
2. Double-click `Setup-Capsnip-Engine.cmd` once. It creates the project `.venv` and installs the local speech engine; it does not require `npm` on PATH.
3. Double-click `Start-Capsnip.cmd` to open the desktop app. The Electron runtime is already in this project; `npm start` is only needed for development when Node.js/npm are on PATH.
4. Capsnip runs transcription on the CPU. CUDA and GPU driver packages are not included or required. The first transcription downloads the selected Whisper model to Hugging Face's local user cache. Internet is needed for initial model download; media and transcription remain local afterward. If needed, set `CAPSNIP_PYTHON` to `.venv\Scripts\python.exe` before launching.

Speech models are downloaded to the user's local model cache on first use. English uses faster-whisper with the CPU int8 backend. Hinglish uses Snip AI's `ishaan-g/whisper-hinglish-swift_timestamped` model, speech-only VAD windows, and word timestamps on CPU. Users can edit the transcript. The worker groups word timestamps into short caption cards; Motion Graphic templates enforce up to four words on line one and two on line two. The desktop UI includes all 62 styles.

## Current integration status

- Desktop window: Electron with context isolation, Node integration disabled, and a small allow-listed preload API.
- Media: native file picker and local video preview.
- Projects: save/open `.capsnip.json` files with caption segments and selected theme.
- Speech: English uses local faster-whisper. Hinglish uses the bundled timestamp-enabled Swift model from Snip AI with speech-region VAD, short caption cards, local CPU/DirectML execution, and automatic CPU fallback. The Swift model, Transformers.js/ONNX runtime, and Node runtime are included locally; no model download is needed on first Hinglish transcription.
- Device choice: detect system RAM and CPU threads once on first launch; the profile is saved in Electron user data. English transcription uses the selected CPU model with int8 compute. GPU and CUDA are intentionally not used by this release.
- Caption themes: all 62 styles can be browsed and selected. The 15 Snip AI presets use the renderer copied from the installed Snip AI folder and export through FFmpeg `drawtext`. Twelve Motion Graphic Caption styles use a Windows-installed heavy font, supplied motion-fill clips, `4+2` word chunking, and template-specific entrance animations.
- Template previews: the editor sidebar and Templates gallery show compact, muted, looping MP4 previews. The 35 typography themes use caption-only black-background loops, the 15 Snip AI loops use the FFmpeg caption renderer, and the 12 Motion Graphic styles show moving footage inside the letters. In the editor, an HTML5 video and Canvas mask provide a lightweight live preview synchronized to word timings.
- Export: standard templates keep their current local-render path. Snip AI presets render H.264 MP4 using the bundled FFmpeg caption filter engine and preset font, color, and animation settings. Motion Graphic templates render H.264 MP4 through a background FFmpeg worker using the source video and assigned motion-fill footage. FFmpeg exports report progress and support cancellation.
- Branding: `assets/capsnip-mark.svg` is used for the app icon mark; `assets/capsnip-wordmark.svg` is the reusable full lockup for splash screens, installers, and product pages.

## Folder map

- `index.html` — app UI and interactions.
- `main.cjs`, `preload.cjs` — desktop window, safe file dialogs and native APIs.
- `engine/transcribe.py` — local CPU-only English/Hinglish transcription adapter.
- `engine/swift-node/` — bundled timestamp-enabled Hinglish model/runtime and portable Node binary.
- `engine/requirements.txt` — Python dependencies.
- `scripts/install-engine.ps1` — one-time local engine setup.
- `assets/catalog-source.ts`, `assets/motion-graphic-templates.js` — original typography catalog and shared 12-style motion-graphic catalog.
- `assets/caption-preview-loops-v2/` — 35 typography previews plus 12 video-filled motion previews.
- `assets/snip-ai-preview-loops/` — 15 FFmpeg-rendered Snip AI preset previews.
- `assets/snip-ai-ffmpeg-renderer.cjs` — caption filter engine copied from the local Snip AI installation.
- `assets/snip-ai-caption-templates.js` — the 15 presets and Capsnip display metadata.
- `assets/motion-fill/` — twelve compressed, muted fill-video clips made from the supplied footage.
- `scripts/render-motion-graphic-previews.ps1` — regenerates the twelve Motion Graphic gallery loops with FFmpeg.
- `assets/capsnip-mark.svg`, `assets/capsnip-wordmark.svg` — Capsnip logo artwork.

Template inventory and evidence: `../Capsnip-caption-template-spec.md`.
