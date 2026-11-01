// Renders a motion file.
//   node scripts/render.mjs <motion.html> --sheet        6 frames per scene + sheet.png in <name>-review/
//   node scripts/render.mjs <motion.html> --mp4 [--fps 30]   <name>.mp4 with narration clips mixed in (needs ffmpeg)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openMotion, fail } from './lib.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && /\.html?$/.test(a));
const mp4 = args.includes('--mp4');
const fps = +(args[args.indexOf('--fps') + 1] || 0) || 30;
if (!file) fail('usage: node scripts/render.mjs <motion.html> --sheet | --mp4 [--fps 30]');
const base = join(dirname(resolve(file)), basename(file).replace(/\.html?$/, ''));
if (mp4) { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { fail('ffmpeg not found (macOS: brew install ffmpeg)'); } }

const { browser, page, meta } = await openMotion(file);
const shot = async (t, path) => { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path }); };

if (!mp4) {
  const dir = `${base}-review`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const cells = [];
  for (const [i, sc] of meta.scenes.entries()) {
    const a = i === 0 ? 0.5 : sc.s[0] + 0.7, b = Math.max(a, sc.s[1] - 0.5);
    for (let k = 0; k < 6; k++) {
      const t = +(a + (b - a) * k / 5).toFixed(2), name = `s${i}-${t.toFixed(2)}.png`;
      await shot(t, join(dir, name));
      cells.push(`<figure><img src="${pathToFileURL(join(dir, name)).href}"><figcaption>S${i} · ${t.toFixed(2)} s</figcaption></figure>`);
    }
  }
  const sheet = join(dir, 'sheet.html');
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#fff;font:12px monospace;color:#666}
main{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}img{width:100%;border:1px solid #ccc;display:block}figure{margin:0}</style><main>${cells.join('')}</main>`);
  const p = await browser.newPage({ viewport: { width: 6 * 340, height: 600 } });
  await p.goto(pathToFileURL(sheet).href);
  await p.waitForLoadState('load');
  await p.screenshot({ path: join(dir, 'sheet.png'), fullPage: true });
  rmSync(sheet);
  console.log(`${meta.scenes.length * 6} frames and sheet.png in ${dir}`);
} else {
  const dir = `${base}-frames`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const n = Math.round(meta.T * fps);
  for (let i = 0; i <= n; i++) await shot(i / fps, join(dir, `${String(i).padStart(5, '0')}.png`));
  const voice = meta.scenes.filter(sc => sc.vo);
  const ff = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, '%05d.png')];
  voice.forEach(sc => ff.push('-i', resolve(dirname(file), sc.vo)));
  if (voice.length) {
    const delays = voice.map((sc, k) => `[${k + 1}:a]adelay=${Math.round(sc.s[0] * 1000)}:all=1[a${k}]`).join(';');
    ff.push('-filter_complex', `${delays};${voice.map((_, k) => `[a${k}]`).join('')}amix=inputs=${voice.length}:normalize=0[aout]`, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  }
  ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-t', String(meta.T), `${base}.mp4`);
  execFileSync('ffmpeg', ff, { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  console.log(`${base}.mp4 (${meta.T}s, ${fps} fps, ${voice.length} narration clips)`);
}
await browser.close();
