// 🫧 단어 버블팡 — 거품을 쏴서 «뜻에 맞는 단어» 몬스터만 가두고 터뜨리는 한 화면 플랫폼 게임 (독자 캐릭터·디자인)
import { h, shuffle, sample, deck, pick } from '../util.js';
import { sfx } from '../sfx.js';
import { bump } from '../fx.js';
import { writePrompt } from '../write.js';

const VW = 800, VH = 480;            // 게임 세계 크기 (화면에 맞춰 늘리고 줄인다)
const G = 1500, JUMP = 640, RUN = 230;
const PLATS = [                       // 아래에서 뛰어 올라갈 수 있는 발판
  { x: 0, y: 450, w: 800 },           // 바닥
  { x: 60, y: 350, w: 250 }, { x: 490, y: 350, w: 250 },
  { x: 230, y: 250, w: 340 },
  { x: 40, y: 150, w: 220 }, { x: 540, y: 150, w: 220 },
];
const MONS = ['👾', '👻', '🦇', '🐌', '🦀', '🐙'];
const FRUITS = ['🍒', '🍓', '🍉', '🍌', '🍇', '🍑', '🍍'];
const PENALTY = 3;

export default {
  id: 'bubble', title: '단어 버블팡', emoji: '🫧', color: '#0ea5e9', time: 90, isNew: true,
  desc: '점프하며 거품을 쏴서 뜻에 맞는 몬스터만 가두고 터뜨려요! 엉뚱한 몬스터를 쏘면 화나요.',
  tags: ['🕹️ 액션', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="bubble">
      <div class="bb-hud"><div class="bb-prompt"><small>이 뜻의 몬스터를 거품에 가둬라!</small><b></b></div><div class="bb-lives"></div></div>
      <canvas class="bb-cv"></canvas>
      <div class="bb-pad"><button data-k="L">◀</button><button data-k="R">▶</button><span></span><button data-k="J" class="jp">⤒ 점프</button><button data-k="F" class="fire">🫧 거품</button></div>
      <div class="bb-help">← → 이동 · ↑ / 스페이스 점프 · Z / F 거품 쏘기 · 가둔 몬스터에 몸으로 닿으면 펑!</div>
    </div>`);
    ctx.stage.append(box);
    const cv = box.querySelector('.bb-cv'), g = cv.getContext('2d');
    const promptEl = box.querySelector('.bb-prompt b'), livesEl = box.querySelector('.bb-lives');
    const next = deck(ctx.words);
    const keys = { L: false, R: false };
    let alive = true, busy = false, target = null, lives = 3, caught = 0, hintUntil = 0, scale = 1, ox = 0, oy = 0, W = 0, H = 0, tAll = 0;
    const me = { x: 380, y: 400, vx: 0, vy: 0, w: 36, h: 40, face: 1, onGround: false, inv: 0, cool: 0 };
    let mons = [], shots = [], pops = [];

    const renderLives = () => { livesEl.innerHTML = '💙'.repeat(lives) + `<span class="lost">${'🤍'.repeat(3 - lives)}</span>`; };
    renderLives();

    // ── 몬스터 · 문제 ──
    function spawnMon(word) {
      const p = pick(PLATS.slice(1));
      mons.push({ x: p.x + 20 + Math.random() * (p.w - 60), y: -40, vx: (Math.random() < 0.5 ? -1 : 1) * (55 + Math.random() * 30), vy: 0, w: 38, h: 38,
        word, face: pick(MONS), state: 'walk', angry: 0, t: 0, onGround: false });
    }
    function newPrompt() {
      if (!alive) return;
      target = next();
      promptEl.textContent = target.ko;
      bump(promptEl);
      const free = mons.filter((m) => m.state === 'walk');
      while (free.length < 4) { spawnMon(null); free.push(mons.at(-1)); }
      const words = shuffle([target, ...sample(ctx.words, free.length - 1, [target])]);
      free.forEach((m, i) => { m.word = words[i] || pick(ctx.words); });
      if (!free.some((m) => m.word === target)) free[0].word = target;
    }

    // ── 물리 ──
    function land(o, prevBottom) {
      o.onGround = false;
      if (o.vy < 0) return;
      for (const p of PLATS) {
        const bottom = o.y + o.h;
        if (prevBottom <= p.y + 1 && bottom >= p.y && o.x + o.w > p.x + 4 && o.x < p.x + p.w - 4) {
          o.y = p.y - o.h; o.vy = 0; o.onGround = true; return p;
        }
      }
      return null;
    }
    const overlap = (a, b, pad = 0) => a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;

    function step(dt) {
      tAll += dt;
      // 나
      me.vx = (keys.R ? RUN : 0) - (keys.L ? RUN : 0);
      if (me.vx) me.face = Math.sign(me.vx);
      me.vy += G * dt;
      const pb = me.y + me.h;
      me.x = Math.max(0, Math.min(VW - me.w, me.x + me.vx * dt));
      me.y += me.vy * dt;
      land(me, pb);
      if (me.y > VH) { me.y = 0; } // 아래로 빠지면 위에서 다시
      me.inv = Math.max(0, me.inv - dt);
      me.cool = Math.max(0, me.cool - dt);

      // 거품
      for (const s of shots) {
        s.t += dt;
        if (s.t < 0.55) s.x += s.vx * dt; else { s.y -= 60 * dt; s.r += 6 * dt; }
        for (const m of mons) {
          if (s.dead || m.state !== 'walk' || m.y < 0) continue;
          if (Math.abs(s.x - (m.x + m.w / 2)) < s.r + m.w / 2 && Math.abs(s.y - (m.y + m.h / 2)) < s.r + m.h / 2 && s.t < 0.6) {
            s.dead = true;
            if (m.word === target) { m.state = 'bubble'; m.t = 0; m.vy = -40; sfx.pop(); }
            else {
              // 엉뚱한 몬스터 — 거품이 터지고 몬스터가 화나서 빨라진다
              m.angry = 3; m.vx = Math.sign(m.vx || 1) * 150;
              const at = fakeEl(m.x, m.y, m.w, m.h);
              if (!ctx.miss(at)) ctx.penalty(PENALTY, at);
            }
          }
        }
        if (s.t > 1.6) s.dead = true;
      }
      shots = shots.filter((s) => !s.dead);

      // 몬스터
      for (const m of mons) {
        m.t += dt;
        if (m.state === 'bubble') {
          m.y = Math.max(20, m.y + m.vy * dt);
          m.x += Math.sin(m.t * 3) * 20 * dt;
          if (overlap(me, m, 4)) { popMon(m); continue; }
          if (m.t > 7) { m.state = 'walk'; m.angry = 2; m.vy = 0; } // 너무 오래 두면 탈출
          continue;
        }
        if (m.state !== 'walk') continue;
        m.angry = Math.max(0, m.angry - dt);
        if (!m.angry && Math.abs(m.vx) > 100) m.vx = Math.sign(m.vx) * 70;
        // 발판 끝에 오면 떨어지지 않고 돌아선다
        if (m.onGround && m.plat && m.plat !== PLATS[0]) {
          const nx = m.x + m.vx * dt;
          if (nx < m.plat.x + 2 || nx + m.w > m.plat.x + m.plat.w - 2) m.vx *= -1;
        }
        m.vy += G * dt;
        const mb = m.y + m.h;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const p = land(m, mb);
        if (p) m.plat = p;
        if (m.x < 0 || m.x + m.w > VW) { m.vx *= -1; m.x = Math.max(0, Math.min(VW - m.w, m.x)); }
        if (m.y > VH) m.y = -40;
        // 나와 부딪힘
        if (!me.inv && overlap(me, m, 8)) {
          me.inv = 1.6;
          me.vy = -380;
          if (!ctx.miss(fakeEl(me.x, me.y, me.w, me.h))) {
            lives--;
            renderLives();
            if (lives <= 0) { ctx.end('💥 몬스터에게 다 잡혔어요'); return; }
          }
        }
      }
      // 과일 효과
      pops.forEach((p) => { p.t += dt; p.y -= 50 * dt; });
      pops = pops.filter((p) => p.t < 1);
    }

    function popMon(m) {
      m.state = 'gone';
      mons = mons.filter((x) => x !== m);
      pops.push({ x: m.x, y: m.y, t: 0, f: pick(FRUITS) });
      caught++;
      ctx.award(14, { el: fakeEl(m.x, m.y, m.w, m.h) });
      if (caught % 5 === 0) {
        busy = true;
        promptEl.textContent = '🌟 보너스!';
        writePrompt(ctx, next(), { label: '🫧 보너스 거품 · 쓰기 찬스', base: 15 }).then(() => { busy = false; newPrompt(); });
      } else newPrompt();
    }
    function shoot() {
      if (busy || me.cool > 0) return;
      me.cool = 0.38;
      shots.push({ x: me.x + me.w / 2 + me.face * 20, y: me.y + me.h / 2, vx: me.face * 470, r: 14, t: 0 });
      sfx.click();
    }
    function jump() { if (busy || !me.onGround) return; me.vy = -JUMP; me.onGround = false; }

    // 화면 좌표로 바꾼 가짜 요소 (점수 글자 띄우기용)
    function fakeEl(x, y, w, hh) {
      return { getBoundingClientRect: () => { const r = cv.getBoundingClientRect(); return { left: r.left + ox + x * scale, top: r.top + oy + y * scale, width: w * scale, height: hh * scale }; }, classList: { add() {}, remove() {} }, offsetWidth: 0 };
    }

    // ── 그리기 ──
    function resize() {
      const r = cv.getBoundingClientRect();
      if (!r.width || (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1)) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      scale = Math.min(W / VW, H / VH);
      ox = (W - VW * scale) / 2; oy = (H - VH * scale) / 2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function emoji(ch, x, y, size, flip) {
      g.save();
      g.translate(x, y);
      if (flip) g.scale(-1, 1);
      g.font = `${size}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 0, 0);
      g.restore();
    }
    function label(text, x, y, color) {
      g.font = '700 15px Fredoka, sans-serif';
      const w = g.measureText(text).width + 14;
      g.fillStyle = color || '#fff';
      g.beginPath(); g.roundRect(x - w / 2, y - 10, w, 20, 8); g.fill();
      g.fillStyle = '#1d1640'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, x, y + 1);
    }
    function draw() {
      g.setTransform(Math.min(2, devicePixelRatio || 1), 0, 0, Math.min(2, devicePixelRatio || 1), 0, 0);
      g.clearRect(0, 0, W, H);
      g.save();
      g.translate(ox, oy);
      g.scale(scale, scale);
      // 배경
      const bg = g.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, '#0c4a6e'); bg.addColorStop(1, '#1e1b4b');
      g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, VW, VH, 18); g.fill();
      for (let i = 0; i < 14; i++) { // 떠다니는 작은 거품
        const bx = (i * 97 + tAll * 12 * (i % 3 + 1)) % VW, by = VH - ((tAll * 25 * (i % 4 + 1) + i * 53) % VH);
        g.strokeStyle = 'rgba(186,230,253,.18)'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 4 + (i % 4) * 2, 0, 7); g.stroke();
      }
      // 발판
      for (const p of PLATS) {
        const pg = g.createLinearGradient(0, p.y, 0, p.y + 18);
        pg.addColorStop(0, '#5eead4'); pg.addColorStop(1, '#0f766e');
        g.fillStyle = pg; g.beginPath(); g.roundRect(p.x, p.y, p.w, 18, 9); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        for (let x = p.x + 10; x < p.x + p.w - 10; x += 24) { g.beginPath(); g.arc(x, p.y + 6, 3, 0, 7); g.fill(); }
      }
      const glow = performance.now() < hintUntil;
      // 몬스터
      for (const m of mons) {
        const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
        if (m.state === 'bubble') {
          g.fillStyle = 'rgba(125,211,252,.35)'; g.strokeStyle = '#bae6fd'; g.lineWidth = 3;
          g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill(); g.stroke();
          emoji(m.face, cx, cy, 30);
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(cx - 11, cy - 12, 5, 0, 7); g.fill();
          if (m.t > 5 && Math.floor(m.t * 6) % 2) { g.strokeStyle = '#f87171'; g.beginPath(); g.arc(cx, cy, 33, 0, 7); g.stroke(); }
          continue;
        }
        if (m.angry) { g.fillStyle = 'rgba(239,68,68,.35)'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill(); }
        emoji(m.face, cx, cy, 34, m.vx > 0);
        if (m.word) label(m.word.en, cx, m.y - 12, glow && m.word === target ? '#fde047' : m.angry ? '#fecaca' : '#fff');
      }
      // 거품 탄
      for (const s of shots) {
        g.fillStyle = 'rgba(186,230,253,.4)'; g.strokeStyle = '#e0f2fe'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); g.stroke();
      }
      // 나 (깜빡임 = 무적)
      if (!me.inv || Math.floor(me.inv * 10) % 2) {
        emoji('🐳', me.x + me.w / 2, me.y + me.h / 2, 40, me.face < 0);
      }
      // 과일
      for (const p of pops) { g.globalAlpha = 1 - p.t; emoji(p.f, p.x + 19, p.y, 34); g.globalAlpha = 1; }
      g.restore();
    }

    ctx.onTick((dt) => {
      if (!alive) return;
      resize();
      if (!W) return;
      if (!busy) { const n = dt > 0.03 ? 2 : 1; for (let i = 0; i < n && alive; i++) step(dt / n); }
      draw();
    });

    // ── 조작 ──
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const down = e.type === 'keydown', k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.L = down;
      else if (k === 'arrowright' || k === 'd') keys.R = down;
      else if (down && (k === 'arrowup' || k === 'w' || e.code === 'Space')) jump();
      else if (down && (k === 'z' || k === 'f' || k === 'j' || k === 'x')) shoot();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    const pad = box.querySelector('.bb-pad');
    const press = (e, down) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      const k = b.dataset.k;
      if (k === 'L' || k === 'R') keys[k] = down;
      else if (down && k === 'J') jump();
      else if (down && k === 'F') shoot();
    };
    pad.addEventListener('pointerdown', (e) => press(e, true));
    pad.addEventListener('pointerup', (e) => press(e, false));
    pad.addEventListener('pointerleave', () => { keys.L = keys.R = false; });
    pad.addEventListener('pointercancel', () => { keys.L = keys.R = false; });

    newPrompt();
    box._dbg = () => ({ me, mons, target, shots }); // 점검용

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') { hintUntil = performance.now() + 4000; return true; }
        if (id === 'skip') { newPrompt(); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); },
    };
  },
};
