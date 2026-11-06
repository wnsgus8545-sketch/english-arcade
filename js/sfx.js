// 효과음 — 파일 없이 브라우저에서 바로 만든다 (WebAudio)
let ac = null;
let muted = localStorage.getItem('ea_mute') === '1';

function audio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, when = 0, slide = 0) {
  if (muted) return;
  try {
    const a = audio();
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {}
}

export const sfx = {
  good(combo = 0) {
    const b = 523 + Math.min(combo, 15) * 28;
    tone(b, 0.1, 'triangle', 0.16);
    tone(b * 1.5, 0.16, 'triangle', 0.12, 0.07);
  },
  write() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.13, i * 0.05));
  },
  bad() { tone(200, 0.28, 'sawtooth', 0.07, 0, 0.55); },
  coin() { tone(988, 0.08, 'square', 0.05); tone(1319, 0.2, 'square', 0.05, 0.07); },
  item() { [660, 880, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'sine', 0.12, i * 0.035)); },
  pop() { tone(320, 0.09, 'sine', 0.16, 0, 2.2); },
  tick() { tone(880, 0.05, 'square', 0.04); },
  go() { tone(1320, 0.18, 'square', 0.05); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.14, i * 0.09)); },
  click() { tone(720, 0.04, 'sine', 0.06); },
  combo() { [784, 988, 1175].forEach((f, i) => tone(f, 0.1, 'square', 0.04, i * 0.06)); },
  isMuted: () => muted,
  toggle() {
    muted = !muted;
    localStorage.setItem('ea_mute', muted ? '1' : '0');
    return muted;
  },
};
