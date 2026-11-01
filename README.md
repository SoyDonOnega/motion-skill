# motion

Agent skill `/motion`: turn any topic into a sourced, deterministic HTML explainer video, with optional free local voice-over. Part of OneStack.

## What it does

Takes a topic and its sources (files, URLs, text, or web research) and builds a 30 to 90 second explainer: one self-contained HTML page where every frame is a pure function of time, so the preview, the review frames and the MP4 always match. It offers three storylines, writes a shot script, builds from a fixed engine, then checks the result: determinism, timing, text overflow and overlap every 0.5 s, pacing and narration fill. Every substantive scene cites its source; illustrative content is tagged. Scenes join by the seam law (exit and entry on the same vector). Black-and-white house style by default; a brand or explicit tokens can replace it.

Ideas adapted from [HyperFrames](https://github.com/heygen-com/hyperframes) (storylines, explainer doctrine, seam law, check before render), [animated-explainer-skills](https://github.com/BusyBee3333/animated-explainer-skills) (pacing and overlap audits) and [Videowright](https://github.com/scosman/videowright) (voice-timed scenes, reusable styles). No code from them.

## Usage

```text
/motion <topic> [sources] [--format 16:9|9:16|1:1] [--voice] [--style <brand>]
```

Output: `<topic>.html` (plus `voice/` with `--voice`), a review sheet, the list of sources and illustrative parts; on request `<topic>.mp4`.

```bash
node scripts/check.mjs motion.html          # 0 errors before delivery
node scripts/render.mjs motion.html --sheet # review frames + sheet.png
node scripts/render.mjs motion.html --mp4   # video with narration (ffmpeg)
node scripts/voice.mjs vo.json              # narration clips (macOS say or Piper)
```

## Install

From OneStack: `./sync-install.sh` — or copy this folder as `<skills dir>/motion/`.

## Requirements

- Node 18+.
- `check` and `render`: Playwright 1.64.1, installed once into `~/.cache/motion-skill/` (never globally), with its Chromium.
- `--mp4`: ffmpeg (`brew install ffmpeg`).
- `--voice`: macOS `say` (built in) or [Piper](https://github.com/rhasspy/piper) with a voice model. No paid service.

## Layout

- `SKILL.md` — the skill.
- `references/explainer.md` — spine, devices, tells, pacing, seam law.
- `assets/template.html` — the engine and a two-scene template.
- `scripts/check.mjs` — contract, timing, layout, pacing and voice checks.
- `scripts/render.mjs` — review sheet or MP4.
- `scripts/voice.mjs` — narration clips from `vo.json`.
- `scripts/lib.mjs` — shared helpers.

## License

MIT — see `LICENSE`.
