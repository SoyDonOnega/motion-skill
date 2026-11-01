// Generates narration with a free local text-to-speech engine: macOS `say` or Piper.
// Usage: node scripts/voice.mjs <vo.json>
// vo.json: { "engine": "say" | "piper" (optional, auto), "voice": "Monica" (say), "model": "/path/voice.onnx" (piper),
//            "rate": 175 (say, words per minute, optional), "lines": [ { "id": "s0", "text": "…" }, … ] }
// Writes voice/<id>.wav next to vo.json and prints each clip's length and the scene length that gives ~90% fill.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { wavDuration, fail } from './lib.mjs';

const file = process.argv[2];
if (!file) fail('usage: node scripts/voice.mjs <vo.json>');
const cfg = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(cfg.lines) || !cfg.lines.length) fail('vo.json needs a non-empty "lines" array');
const has = cmd => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const engine = cfg.engine || (has('say') ? 'say' : has('piper') ? 'piper' : null);
if (!engine) fail('no local TTS engine: on macOS `say` is built in; elsewhere install Piper (https://github.com/rhasspy/piper) and set "model"');
if (engine === 'piper' && !cfg.model) fail('Piper needs "model": the path to a voice .onnx file');

const out = join(dirname(resolve(file)), 'voice');
mkdirSync(out, { recursive: true });
const rows = [];
for (const { id, text } of cfg.lines) {
  if (!id || !text) fail(`each line needs "id" and "text" (got ${JSON.stringify({ id, text })})`);
  const wav = join(out, `${id}.wav`);
  if (engine === 'say') {
    const a = ['-o', wav, '--file-format=WAVE', '--data-format=LEI16@22050'];
    if (cfg.voice) a.push('-v', cfg.voice);
    if (cfg.rate) a.push('-r', String(cfg.rate));
    execFileSync('say', [...a, text]);
  } else {
    execFileSync('piper', ['--model', cfg.model, '--output_file', wav], { input: text });
  }
  const dur = wavDuration(readFileSync(wav));
  const words = text.trim().split(/\s+/).length;
  rows.push({ id, file: `voice/${id}.wav`, seconds: +dur.toFixed(2), words, scene: Math.ceil(dur / 0.9 * 10) / 10 });
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ engine, voice: cfg.voice || cfg.model || null, clips: rows }, null, 2) + '\n');
console.log('id\tclip s\twords\tscene s (90% fill)');
for (const r of rows) console.log(`${r.id}\t${r.seconds}\t${r.words}\t${r.scene}`);
console.log(`${rows.length} clips in ${out} (engine: ${engine})`);
