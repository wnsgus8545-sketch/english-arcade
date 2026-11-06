export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (a) => a[(Math.random() * a.length) | 0];

/** a 에서 exclude 를 뺀 n 개 (뜻이 같은 것도 뺀다) */
export function sample(a, n, exclude = []) {
  const ko = new Set(exclude.map((w) => w && w.ko));
  return shuffle(a.filter((x) => !exclude.includes(x) && !ko.has(x.ko))).slice(0, n);
}

/** 영어 답 비교용: 소문자 · 앞뒤 공백 · 문장부호 무시 */
export const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 겹치지 않게 돌아가며 하나씩 뽑는 카드 덱 */
export function deck(list) {
  let pool = [];
  let last = null;
  return () => {
    if (!pool.length) {
      pool = shuffle(list);
      if (pool.length > 1 && pool[pool.length - 1] === last) pool.unshift(pool.pop());
    }
    last = pool.pop();
    return last;
  };
}

export function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

const AV = ['🦊', '🐼', '🐯', '🐸', '🐵', '🐧', '🐨', '🦁', '🐰', '🐻', '🐹', '🦄', '🐙', '🐳', '🦉', '🐢', '🦖', '🐝', '🐶', '🐱', '🐷', '🐮', '🦋', '🐬', '🦜'];
export const avatar = (n) => AV[(Math.abs(+n || 1) - 1) % AV.length];

export function countUp(el, to, ms = 500) {
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  if (from === to) { el.textContent = to.toLocaleString(); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString();
    if (p < 1 && el.dataset.v == to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
