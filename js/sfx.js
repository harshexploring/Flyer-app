// ============================================================
// Sound effects — everything is synthesized with the Web Audio
// API, so the game needs zero audio files. Each effect is a
// small recipe of oscillators / filtered noise.
// ============================================================

let ctx = null;
let muted = false;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

// One tone that can glide from `freq` to `freqTo`.
function tone({ freq, freqTo = freq, duration, type = 'sine', gain = 0.15, delay = 0 }) {
  if (muted) return;
  const ac = audio();
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t0 + duration);

  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// A short burst of filtered white noise (pops, whooshes).
function noise({ duration, gain = 0.2, delay = 0, filterFrom = 800, filterTo = 800, filterType = 'bandpass' }) {
  if (muted) return;
  const ac = audio();
  const t0 = ac.currentTime + delay;

  const buffer = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(filterFrom, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(filterTo, 1), t0 + duration);

  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  // A new word pops in.
  appear() {
    tone({ freq: 620, freqTo: 740, duration: 0.07, type: 'triangle', gain: 0.08 });
  },

  // Right answer: cheerful two-note chime.
  correct() {
    tone({ freq: 523, duration: 0.12, type: 'triangle', gain: 0.18 });
    tone({ freq: 784, duration: 0.18, type: 'triangle', gain: 0.18, delay: 0.09 });
  },

  // The word soars into the sky.
  whoosh() {
    noise({ duration: 0.4, gain: 0.16, filterFrom: 400, filterTo: 2400 });
  },

  // The word settles safely on the ground.
  thump() {
    tone({ freq: 170, freqTo: 80, duration: 0.16, type: 'sine', gain: 0.25 });
  },

  // Wrong answer: sad slide + burst.
  wrong() {
    tone({ freq: 240, freqTo: 110, duration: 0.35, type: 'sawtooth', gain: 0.14 });
  },

  // The word explodes.
  pop() {
    noise({ duration: 0.25, gain: 0.3, filterFrom: 1400, filterTo: 250, filterType: 'lowpass' });
    tone({ freq: 90, freqTo: 40, duration: 0.2, type: 'square', gain: 0.12 });
  },

  // Game over jingle: three descending notes.
  gameOver() {
    tone({ freq: 392, duration: 0.16, type: 'triangle', gain: 0.16 });
    tone({ freq: 330, duration: 0.16, type: 'triangle', gain: 0.16, delay: 0.16 });
    tone({ freq: 262, duration: 0.3, type: 'triangle', gain: 0.16, delay: 0.32 });
  },

  // Game starts: rising arpeggio.
  start() {
    [262, 330, 392, 523].forEach((freq, i) =>
      tone({ freq, duration: 0.12, type: 'triangle', gain: 0.15, delay: i * 0.08 }),
    );
  },

  click() {
    tone({ freq: 900, freqTo: 700, duration: 0.05, type: 'square', gain: 0.05 });
  },
};
