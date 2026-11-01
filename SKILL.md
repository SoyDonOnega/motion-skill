---
name: motion
description: >-
  Turns any topic (a rule, a process, an algorithm, an architecture, a concept) into an explainer
  motion: one self-contained, deterministic HTML video with sourced claims, optional free
  voice-over and MP4 export. Black-and-white house style by default, configurable. Use when the
  user runs /motion <topic> [sources] [--format 16:9|9:16|1:1] [--voice] [--style <brand or tokens>].
license: MIT
compatibility: Node 18+. check and render download Playwright once into a private cache; --mp4 needs ffmpeg; --voice needs uv and network for edge-tts (default), or macOS `say` or Piper (local).
argument-hint: "<topic> [sources] [--format 16:9|9:16|1:1] [--voice] [--style <brand>]"
disable-model-invocation: true
---

# Motion

Builds an explainer motion of 30 to 90 seconds from a topic and its sources: one HTML page whose every frame is a pure function of time `t`, so preview, screenshots and MP4 always match. All domain knowledge comes from the sources, never from the skill. It does not edit live footage, add music or sound effects, or burn in captions.
Paths in this file are relative to the skill root (the folder that contains this SKILL.md).

## Inputs

1. **Topic**: required. If missing, ask for it and stop.
2. **Sources**: files, URLs or text the user gives. Optional; without them, research (step 2).
3. **Format**: `16:9` (1920x1080, default), `9:16` (1080x1920) or `1:1` (1080x1080).
4. **Voice**: off by default. `--voice` adds narration with a free engine. Default: edge-tts (Microsoft neural voices, online) with a neural voice in the output language; for Spanish, `es-ES-AlvaroNeural`. Local `say` or Piper when the user asks for local narration or edge is not available.
5. **Style**: black and white by default. `--style` takes a brand name, a brand guide, a stored brand profile or explicit colors and fonts.
6. **Saving**: nothing is saved by default. Build in the system temp folder and show the result. When the user asks to save it, save it in the current project, under `motions/<topic>/` (HTML, `voice/`, MP4 if any).

## When invoked

1. **Fix the idea.** Write in one sentence the idea the viewer must understand by the end, the audience and the output language (the language the user writes in, unless they ask for another).
2. **Gather sources.** Use, in order: what the user gave; then search the web or any connected source; never memory. Note each claim with its source and pinpoint (section, article, page, URL). If a figure cannot be verified, leave it out or mark it illustrative.
3. **Offer three storylines.** Read `references/explainer.md`. Write three short, different storylines (hook, worked example, peak, close; three to five lines each). Ask the user to pick one. Skip only if the user asked for no questions; then pick the strongest and say why.
4. **Write the shot script.** A table, one row per scene: `[start, end]` seconds, seam (`left`, `up`, `zoom`), what moves, on-screen text, source, and the narration line if `--voice`. Usually 5 to 7 scenes: hook, context, mechanics, worked example or consequence, peak, close. Show it to the user before building.
5. **Voice (only with `--voice`).** Write `vo.json` next to the output with one line per scene (`id`: `s0`, `s1`…) at about 2.5 words per second of scene, plus `engine` and `voice` (format in the header of `scripts/voice.mjs`). With `edge`, use the default voice for the output language (Spanish: `es-ES-AlvaroNeural`; others: a neural voice in that language, e.g. `en-GB-RyanNeural`) unless the user names one, and tell the user once that the script text goes to Microsoft. Run `node scripts/voice.mjs <vo.json>`; it prints each clip's length and the scene length that gives about 90% fill. Retime the scenes to those lengths: lengthen a scene, never speed up the voice.
6. **Build.** Copy `assets/template.html` into the working folder (the system temp folder unless the user asked to save). Change only: `<title>`, `lang`, `data-format`, the scenes, the constant `T`, the slider `max`, the UI strings (`L`, the hint, the `aria-label`) and, for a custom style, the style tokens. Never edit below the `Engine` line. Add `data-vo="voice/sN.wav"` to each narrated scene.
7. **Check.** Run `node scripts/check.mjs <file.html>`. Fix every error (contract, timing, overflow, overlap, voice overrun); weigh every warning (pacing, voice fill). Repeat until 0 errors.
8. **Review.** Run `node scripts/render.mjs <file.html> --sheet` and look at `sheet.png`: does each scene read on its own, does the diagram grow one part at a time, do figures and citations match the sources? Fix and re-check.
9. **Deliver.** Open the HTML for the user to watch and give its path. List the sources used, what is illustrative and what could not be verified. Offer to save it in the project and to export the MP4 (`node scripts/render.mjs <file.html> --mp4`); do either only when the user asks.

## Scene rules

- Every scene with substantive content carries `.src` (bottom left): source + pinpoint, in the output language.
- Every illustrative element carries `.tag` (bottom right): `Example data`, `Diagram, not data`, `Simplified` (in the output language).
- Short sentences on screen, one idea per headline, no em dashes as punctuation.
- Number and date formats follow the output language.
- Retrieval date in the last scene when sources were fetched online.

## Style

- **Default (black and white):** background `#FAFAF8`, ink `#0A0A0A`, gray `#666666`, lines `#CCCCCC`, paper `#FFFFFF`; Inter for text, JetBrains Mono for sources, numbers and labels; no accent color, no gradients, no shadows, no rounded corners. Highlight = inversion (`.inv`). Boxes have a 2px ink border (`.box`).
- **Custom:** change only the `:root` style tokens and the font link. Map the brand to `--bg`, `--ink`, `--mute`, `--line`, `--paper`, `--sans`, `--mono`; one accent may replace `--ink` in highlights only. Layout, grid, motion and accuracy rules do not change. Check text contrast (4.5:1 against `--bg` and `--paper`).
- **Grid:** the engine sets it per format through `--mx` (side), `--top` (eyebrow), `--rule` and `--foot` (`.src`/`.tag` from the bottom): 16:9 140/96/140/84px, 1:1 90/96/140/84px, 9:16 90/140/190/130px. Headline about 95px below the eyebrow (`top:190px` at 16:9, `240px` at 9:16). Everything stays inside the 90% safe area.
- **Type scale:** hook up to 380px, `.big` 150px, `.h1` 64px, body 26 to 34px, labels 18 to 20px in small caps with `.2em` tracking. In 9:16, keep headlines to 3 lines at 64px.

## Engine API

- `<section class="scene" data-s="start,end" data-seam="left|up|zoom" data-vo="voice/s1.wav">`: scene window in seconds; the vector it enters with (the previous scene exits along the same one); its narration clip.
- `<div class="m" data-t="t0"><div>…</div></div>`: text that rises masked from `t0`.
- `data-a='[["prop",t0,t1,v0,v1,"unit"], …]'`: per-property animation. `prop` is `opacity`, `x`, `y` (px, combined into `translate`) or any CSS property (`width` with `"px"`). Several rows for one property chain: a later row takes over once it starts.
- `data-allow-overlap` / `data-allow-overflow` on an element: tells `check.mjs` the overlap or overflow is intended (the overlap is the lesson).
- `window.seek(t)` draws instant `t`; `window.ready` is `true` once fonts load; `window.motion` exposes `T`, size and scenes. `?render` removes the controls and fixes the stage at native size.
- Determinism: no `Date.now`, `Math.random`, timers, network requests, CSS animations or transitions. For repeated elements, generate them in the script block before the engine collects them.
- Player: space plays or pauses, arrows step one frame, R restarts; respects reduced motion.

## Rules

- No claim, figure or date without a source; never from memory. Mark illustrative content.
- Show the storylines and the shot script before building.
- Never edit the engine block; never change layout or motion rules to fit a style.
- Voice uses only free engines: `edge` by default (the script text goes to Microsoft through an unofficial client that may stop working; say so once), local `say` or Piper on request. Never a paid service. Never speed up a clip to fit a scene.
- Save nothing unless the user asks; then only in the current project.
- Do not deliver with errors from `check.mjs`.

## Resources

- `references/explainer.md`: spine, devices, tells to avoid, pacing, seam law. Read at step 3.
- `assets/template.html`: the engine and a two-scene template. Copy at step 6.
- `scripts/check.mjs`: contract, timing, layout every 0.5 s, pacing and voice fill.
- `scripts/render.mjs`: `--sheet` (review frames + contact sheet) or `--mp4` (video with narration).
- `scripts/voice.mjs`: narration clips from `vo.json` with macOS `say`, Piper or edge-tts.
- `scripts/lib.mjs`: shared helpers (pinned Playwright loader, WAV duration).

## Harness notes

- Claude Code desktop: show the motion in the built-in browser pane through a local server started in the motion's folder (`python3 -m http.server <port> --bind 127.0.0.1`); a `file://` page there renders as a static snapshot without its script. Stop the server afterwards.
- A stored brand profile can come from the `brand-dna` skill when it is installed.
