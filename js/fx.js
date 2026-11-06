// 화면 효과 — 토스트 · 떠오르는 점수 · 흔들기 · 폭죽

export function toast(msg, type = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.classList.add('out'), 1900);
  setTimeout(() => t.remove(), 2300);
}

export function floatText(target, text, cls = '') {
  const r = target.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'floaty ' + cls;
  d.textContent = text;
  d.style.left = r.left + r.width / 2 + 'px';
  d.style.top = r.top + Math.min(r.height / 2, 40) + 'px';
  document.body.append(d);
  setTimeout(() => d.remove(), 1000);
}

export function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 450);
}

export function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const COLORS = ['#ff5fa2', '#ffd23f', '#3ee0ff', '#7c5cff', '#4ade80', '#ff8a3d'];

/** 요소 자리에서 반짝이 터뜨리기 */
export function burst(target, n = 14) {
  const r = target.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const d = 40 + Math.random() * 50;
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
    s.style.background = COLORS[i % COLORS.length];
    s.style.setProperty('--dx', Math.cos(a) * d + 'px');
    s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    document.body.append(s);
    setTimeout(() => s.remove(), 650);
  }
}

/** 전체 화면 색종이 */
export function confetti(n = 140) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.append(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: COLORS[(Math.random() * COLORS.length) | 0],
  }));
  const t0 = performance.now();
  const frame = (t) => {
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
