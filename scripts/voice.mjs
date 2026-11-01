// Generates narration with a free text-to-speech engine: edge-tts (online, default) or macOS `say` or Piper (local).
// Usage: node scripts/voice.mjs <vo.json>
// vo.json: { "engine": "edge" | "say" | "piper" (optional; auto picks edge when uv is installed, else say, else piper),
//            "voice": "Monica" (say) | "es-ES-ElviraNeural" (edge; defaults to es-ES-AlvaroNeural when "lang" is "es"),
//            "lang": "es" (optional), "model": "/path/voice.onnx" (piper),
//            "rate": 175 (say, words per minute) | "+5%" (edge), "lines": [ { "id": "s0", "text": "…" }, … ] }
// edge sends the text to Microsoft's Edge read-aloud service through the unofficial edge-tts client (needs uv and network).
// Writes voice/<id>.wav next to vo.json and prints each clip's length and the scene length that gives ~90% fill.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { wavDuration, fail } from './lib.mjs';

const file = process.argv[2];
if (!file) fail('usage: node scripts/voice.mjs <vo.json>');
const cfg = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(cfg.lines) || !cfg.lines.length) fail('vo.json needs a non-empty "lines" array');
const has = cmd => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const engine = cfg.engine || (has('uvx') ? 'edge' : has('say') ? 'say' : has('piper') ? 'piper' : null);
if (!engine) fail('no local TTS engine: on macOS `say` is built in; elsewhere install Piper (https://github.com/rhasspy/piper) and set "model"');
if (engine === 'piper' && !cfg.model) fail('Piper needs "model": the path to a voice .onnx file');
const DEFAULT_EDGE = { es: 'es-ES-AlvaroNeural' };
if (engine === 'edge' && !cfg.voice) cfg.voice = DEFAULT_EDGE[cfg.lang] || null;
if (engine === 'edge' && !cfg.voice) fail('edge needs "voice", e.g. es-ES-ElviraNeural (list: uvx --from edge-tts==7.3.1 edge-tts --list-voices)');
if (engine === 'edge' && !has('uvx')) fail('edge needs uv (https://docs.astral.sh/uv/)');

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
  } else if (engine === 'piper') {
    execFileSync('piper', ['--model', cfg.model, '--output_file', wav], { input: text });
  } else if (engine === 'edge') {
    const mp3 = join(out, `${id}.mp3`);
    const a = ['--from', 'edge-tts==7.3.1', 'edge-tts', '--voice', cfg.voice, '--text', text, '--write-media', mp3];
    if (cfg.rate) a.push(`--rate=${cfg.rate}`);
    execFileSync('uvx', a, { stdio: ['ignore', 'ignore', 'inherit'] });
    if (has('ffmpeg')) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    else if (has('afconvert')) execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', mp3, wav]);
    else fail('edge returns MP3: install ffmpeg to convert it to WAV');
    rmSync(mp3);
  } else fail(`unknown engine "${engine}" (say, piper or edge)`);
  const dur = wavDuration(readFileSync(wav));
  const words = text.trim().split(/\s+/).length;
  rows.push({ id, file: `voice/${id}.wav`, seconds: +dur.toFixed(2), words, scene: Math.ceil(dur / 0.9 * 10) / 10 });
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ engine, voice: cfg.voice || cfg.model || null, clips: rows }, null, 2) + '\n');
console.log('id\tclip s\twords\tscene s (90% fill)');
for (const r of rows) console.log(`${r.id}\t${r.seconds}\t${r.words}\t${r.scene}`);
console.log(`${rows.length} clips in ${out} (engine: ${engine})`);
