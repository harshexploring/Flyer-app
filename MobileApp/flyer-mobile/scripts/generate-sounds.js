// Generates the game's sound effects as small WAV files, using the
// same synthesis recipes as the web app's js/sfx.js (which uses the
// Web Audio API live — React Native can't, so we bake the sounds).
//
// Run:  node scripts/generate-sounds.js
// Output: assets/sounds/*.wav

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

function osc(type, phase) {
  switch (type) {
    case 'sine': return Math.sin(2 * Math.PI * phase);
    case 'triangle': return 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1;
    case 'sawtooth': return 2 * (phase - Math.floor(phase + 0.5));
    case 'square': return phase % 1 < 0.5 ? 1 : -1;
    default: return 0;
  }
}

// One tone gliding freq→freqTo with linear attack + exponential decay.
function tone(buf, { freq, freqTo = freq, duration, type = 'sine', gain = 0.15, delay = 0, attack = 0.012 }) {
  const start = Math.floor(delay * SAMPLE_RATE);
  const n = Math.floor(duration * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = freq * Math.pow(freqTo / freq, t); // exponential glide
    phase += f / SAMPLE_RATE;
    const attackSamples = attack * SAMPLE_RATE;
    const env = i < attackSamples
      ? i / attackSamples
      : Math.pow(0.001, (i - attackSamples) / (n - attackSamples));
    if (start + i < buf.length) buf[start + i] += osc(type, phase) * gain * env;
  }
}

// Filtered-ish noise burst (for the pop).
function noiseBurst(buf, { duration, gain = 0.2, delay = 0 }) {
  const start = Math.floor(delay * SAMPLE_RATE);
  const n = Math.floor(duration * SAMPLE_RATE);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const env = Math.pow(0.001, i / n);
    // one-pole lowpass over white noise = soft "poof"
    last = last * 0.92 + (Math.random() * 2 - 1) * 0.08;
    if (start + i < buf.length) buf[start + i] += last * gain * env * 8;
  }
}

function writeWav(name, buf) {
  const pcm = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(-1, Math.min(1, buf[i]));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);           // PCM
  header.writeUInt16LE(1, 22);           // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(OUT_DIR, name), Buffer.concat([header, pcm]));
  console.log(`  ${name} (${((44 + pcm.length) / 1024).toFixed(0)} KB)`);
}

function make(seconds) {
  return new Float32Array(Math.ceil(seconds * SAMPLE_RATE));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('Generating sounds…');

// appear — a new word pops in
let b = make(0.1);
tone(b, { freq: 620, freqTo: 740, duration: 0.07, type: 'triangle', gain: 0.1 });
writeWav('appear.wav', b);

// fly — soft warm chime (correct FLY)
b = make(0.7);
tone(b, { freq: 523.25, duration: 0.3, type: 'sine', gain: 0.2, attack: 0.05 });
tone(b, { freq: 659.25, duration: 0.36, type: 'sine', gain: 0.18, delay: 0.1, attack: 0.05 });
tone(b, { freq: 1046.5, duration: 0.45, type: 'sine', gain: 0.08, delay: 0.19, attack: 0.08 });
writeWav('fly.wav', b);

// sit — cheerful chime + soft ground thump (correct SIT)
b = make(0.45);
tone(b, { freq: 523, duration: 0.12, type: 'triangle', gain: 0.22 });
tone(b, { freq: 784, duration: 0.18, type: 'triangle', gain: 0.22, delay: 0.09 });
tone(b, { freq: 170, freqTo: 80, duration: 0.16, type: 'sine', gain: 0.3 });
writeWav('sit.wav', b);

// wrong — sad slide + burst pop
b = make(0.5);
tone(b, { freq: 240, freqTo: 110, duration: 0.35, type: 'sawtooth', gain: 0.18 });
tone(b, { freq: 90, freqTo: 40, duration: 0.2, type: 'square', gain: 0.15 });
noiseBurst(b, { duration: 0.25, gain: 0.25 });
writeWav('wrong.wav', b);

// over — three descending notes
b = make(0.75);
tone(b, { freq: 392, duration: 0.16, type: 'triangle', gain: 0.2 });
tone(b, { freq: 330, duration: 0.16, type: 'triangle', gain: 0.2, delay: 0.16 });
tone(b, { freq: 262, duration: 0.3, type: 'triangle', gain: 0.2, delay: 0.32 });
writeWav('over.wav', b);

// start — rising arpeggio
b = make(0.5);
[262, 330, 392, 523].forEach((freq, i) =>
  tone(b, { freq, duration: 0.12, type: 'triangle', gain: 0.18, delay: i * 0.08 }));
writeWav('start.wav', b);

// click — tiny UI blip
b = make(0.08);
tone(b, { freq: 900, freqTo: 700, duration: 0.05, type: 'square', gain: 0.08 });
writeWav('click.wav', b);

console.log('Done →', OUT_DIR);
