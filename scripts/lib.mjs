// Shared helpers. openMotion loads a pinned Playwright (installed once into a private cache, never globally)
// and opens a motion file in render mode at its native size.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PW = '1.64.1';
const CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'motion-skill');

export function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }

async function playwright() {
  try { return await import('playwright'); } catch {}
  const pkg = join(CACHE, 'node_modules', 'playwright', 'package.json');
  if (!existsSync(pkg)) {
    console.error(`motion: installing playwright@${PW} into ${CACHE} (once)…`);
    mkdirSync(CACHE, { recursive: true });
    execFileSync('npm', ['install', '--prefix', CACHE, '--no-audit', '--no-fund', `playwright@${PW}`], { stdio: 'inherit' });
  }
  return createRequire(pkg)('playwright');
}

export async function openMotion(file) {
  if (!file || !existsSync(file)) fail(`motion file not found: ${file}`);
  const { chromium } = await playwright();
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) {
    if (!/Executable doesn't exist|install/i.test(e.message)) throw e;
    console.error('motion: installing Chromium for Playwright (once)…');
    execFileSync('npx', ['-y', `playwright@${PW}`, 'install', 'chromium'], { stdio: 'inherit', cwd: CACHE });
    browser = await chromium.launch();
  }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1920 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(resolve(file)).href + '?render');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 }).catch(() => fail('page never set window.ready (fonts or script error)'));
  const meta = await page.evaluate(() => window.motion);
  if (!meta) fail('window.motion missing: the engine block was changed or not copied');
  await page.setViewportSize({ width: meta.W, height: meta.H });
  return { browser, page, meta, errors };
}

// Duration in seconds of a PCM WAV file, read from its header (no ffprobe needed).
export function wavDuration(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let off = 12, byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') return byteRate ? size / byteRate : null;
    off += 8 + size + (size % 2);
  }
  return null;
}
