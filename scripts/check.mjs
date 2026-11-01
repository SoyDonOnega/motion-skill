// Checks a motion file: determinism contract, timing, layout (overflow and text overlap every 0.5 s),
// pacing and narration fill. Errors exit 1; warnings are printed and do not fail.
// Usage: node scripts/check.mjs <motion.html> [--step 0.5]
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openMotion, wavDuration, fail } from './lib.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const step = +(args[args.indexOf('--step') + 1] || 0) || 0.5;
if (!file) fail('usage: node scripts/check.mjs <motion.html> [--step 0.5]');
const errors = [], warnings = [];

// 1. Determinism contract (static).
const html = readFileSync(file, 'utf8');
for (const [re, what] of [[/Date\.now\(/, 'Date.now()'], [/Math\.random\(/, 'Math.random()'], [/setTimeout\(|setInterval\(/, 'timers'],
  [/@keyframes|animation\s*:/, 'CSS animations'], [/transition\s*:/, 'CSS transitions'], [/fetch\(|XMLHttpRequest/, 'network requests']])
  if (re.test(html)) errors.push(`contract: ${what} found; every frame must be a pure function of t`);

const { browser, page, meta, errors: pageErrors } = await openMotion(file);
pageErrors.forEach(e => errors.push(`script error: ${e}`));

// 2. Timing.
const { T, W, H, seam, lead, scenes } = meta;
const end = Math.max(...scenes.map(s => s.s[1]));
if (Math.abs(end - T) > 1e-6) errors.push(`timing: T = ${T} but the last scene ends at ${end}`);
const max = await page.evaluate(() => +document.getElementById('scrub').max);
if (Math.abs(max - T) > 1e-6) errors.push(`timing: slider max = ${max}, T = ${T}`);
scenes.forEach((sc, i) => {
  if (sc.s[1] <= sc.s[0]) errors.push(`timing: scene ${i} ends before it starts (${sc.s})`);
  const next = scenes[i + 1];
  if (next && Math.abs(next.s[0] - sc.s[1]) > 1e-6) warnings.push(`timing: gap or overlap between scene ${i} and ${i + 1} (${sc.s[1]} → ${next.s[0]})`);
});

// 3. Layout: sample every `step` seconds outside seam windows.
const inSeam = t => scenes.some((sc, i) => (i > 0 && t >= sc.s[0] - lead && t < sc.s[0] - lead + seam) || (i < scenes.length - 1 && t >= sc.s[1] - seam && t <= sc.s[1]));
const seen = new Set();
for (let t = 0; t <= T + 1e-9; t = +(t + step).toFixed(3)) {
  if (inSeam(t)) continue;
  const found = await page.evaluate(([t, W, H]) => {
    window.seek(t);
    const stage = document.getElementById('stage'), o = stage.getBoundingClientRect(), issues = [];
    const desc = el => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.') : ''} "${el.textContent.trim().slice(0, 40)}"`;
    const boxes = [];
    for (const scene of stage.querySelectorAll('.scene')) {
      if (+getComputedStyle(scene).opacity < 0.5) continue;
      for (const el of scene.querySelectorAll('*')) {
        const texts = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
        if (!texts.length) continue;
        let op = 1, clip = [-1e9, -1e9, 1e9, 1e9];
        for (let a = el; a && a !== scene; a = a.parentElement) {
          const cs = getComputedStyle(a);
          op *= +cs.opacity;
          if (a !== el && cs.overflow !== 'visible') {
            const r = a.getBoundingClientRect();
            clip = [Math.max(clip[0], r.left), Math.max(clip[1], r.top), Math.min(clip[2], r.right), Math.min(clip[3], r.bottom)];
          }
        }
        if (op < 0.05) continue;
        // Text height is the element's content box (line boxes), not the font's taller content area.
        const er = el.getBoundingClientRect(), cs = getComputedStyle(el);
        clip[1] = Math.max(clip[1], er.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth));
        clip[3] = Math.min(clip[3], er.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth));
        for (const n of texts) {
          const range = document.createRange(); range.selectNodeContents(n);
          const r = range.getBoundingClientRect();
          const b = [Math.max(r.left, clip[0]) - o.left, Math.max(r.top, clip[1]) - o.top, Math.min(r.right, clip[2]) - o.left, Math.min(r.bottom, clip[3]) - o.top];
          if (b[2] - b[0] < 1 || b[3] - b[1] < 1) continue;
          boxes.push({ el, b });
          if (!el.closest('[data-allow-overflow]') && (b[0] < W * 0.05 - 1 || b[1] < H * 0.05 - 1 || b[2] > W * 0.95 + 1 || b[3] > H * 0.95 + 1))
            issues.push(`overflow: ${desc(el)} leaves the 90% safe area [${b.map(Math.round)}]`);
        }
      }
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i], q = boxes[j];
      if (p.el === q.el || p.el.contains(q.el) || q.el.contains(p.el)) continue;
      if (p.el.closest('[data-allow-overlap]') || q.el.closest('[data-allow-overlap]')) continue;
      const w = Math.min(p.b[2], q.b[2]) - Math.max(p.b[0], q.b[0]), h = Math.min(p.b[3], q.b[3]) - Math.max(p.b[1], q.b[1]);
      if (w > 2 && h > 2) issues.push(`overlap: ${desc(p.el)} and ${desc(q.el)}`);
    }
    return issues;
  }, [t, W, H]);
  for (const f of found) {
    const key = f.replace(/ \[[^\]]*\]$/, '');
    if (!seen.has(key)) { seen.add(key); errors.push(`${f} at t=${t}s`); }
  }
}

// 4. Pacing: beat starts per scene (masked rises and data-a animations).
const beats = await page.evaluate(() => [...document.querySelectorAll('.scene')].map(sc => [
  ...[...sc.querySelectorAll('.m[data-t]')].map(e => +e.dataset.t),
  ...[...sc.querySelectorAll('[data-a]')].flatMap(e => JSON.parse(e.dataset.a).map(r => r[1])),
].sort((a, b) => a - b)));
scenes.forEach((sc, i) => {
  const [s0, s1] = sc.s, b = beats[i], d = s1 - s0;
  if (!b.length) { warnings.push(`pacing: scene ${i} has no beats`); return; }
  if (i === 0 && b[0] > 0.5) warnings.push(`pacing: first beat at ${b[0]}s; something should land by 0.5s`);
  const lastAt = (b[b.length - 1] - s0) / d;
  if (lastAt < 0.7) warnings.push(`pacing: scene ${i} last beat at ${Math.round(lastAt * 100)}% of its duration (dead tail; aim for 70-85%)`);
  if (lastAt > 0.85 && i < scenes.length - 1) warnings.push(`pacing: scene ${i} last beat at ${Math.round(lastAt * 100)}% (lands on the exit seam; aim for 70-85%)`);
  const marks = [s0, ...b, s1];
  for (let k = 1; k < marks.length; k++) if (marks[k] - marks[k - 1] > 4) { warnings.push(`pacing: scene ${i} has a ${(marks[k] - marks[k - 1]).toFixed(1)}s gap with no beat after ${marks[k - 1]}s`); break; }
});

// 5. Narration fill: clip length against scene length.
scenes.forEach((sc, i) => {
  if (!sc.vo) return;
  const p = resolve(dirname(file), sc.vo);
  if (!existsSync(p)) { errors.push(`voice: scene ${i} clip not found: ${sc.vo}`); return; }
  const dur = wavDuration(readFileSync(p));
  if (dur == null) { warnings.push(`voice: scene ${i} clip is not a PCM WAV; fill not checked`); return; }
  const fill = dur / (sc.s[1] - sc.s[0]);
  if (fill > 1) errors.push(`voice: scene ${i} clip (${dur.toFixed(2)}s) overruns the scene (${(sc.s[1] - sc.s[0]).toFixed(2)}s)`);
  else if (fill < 0.85 || fill > 0.94) warnings.push(`voice: scene ${i} narrated ${Math.round(fill * 100)}% (aim for 85-94%)`);
});

await browser.close();
for (const e of errors) console.log(`ERROR  ${e}`);
for (const w of warnings) console.log(`WARN   ${w}`);
console.log(`${file}: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
