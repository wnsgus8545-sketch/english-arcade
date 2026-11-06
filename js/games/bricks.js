import { h, shuffle, sample, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { bump } from '../fx.js';
import { writePrompt } from '../write.js';

const COLS = 5, ROWS = 3;
const COLORS = ['#ff5fa2', '#7c5cff', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

export default {
  id: 'bricks', title: '단어 벽돌깨기', emoji: '🧱', color: '#f97316', time: 90, isNew: true,
  desc: '공을 튕겨 뜻에 맞는 영어 벽돌만 깨요! 다른 벽돌은 안 깨지니까 잘 조준해요.',
  tags: ['🏓 조준', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="bricks">
      <div class="bk-hud"><div class="bk-prompt"><small>이 뜻의 벽돌을 깨라!</small><b></b></div><div class="bk-lives"></div></div>
      <canvas class="bk-cv"></canvas>
      <div class="bk-help">마우스·손가락으로 받침대 움직이기 · ← → 키 · 클릭/스페이스로 발사</div>
    </div>`);
    ctx.stage.append(box);
    const cv = box.querySelector('.bk-cv'), g = cv.getContext('2d');
    const promptEl = box.querySelector('.bk-prompt b'), livesEl = box.querySelector('.bk-lives');
    const next = deck(ctx.words);
    let W = 0, H = 0, dpr = 1, bricks = [], target = null, alive = true, busy = false, lives = 3, hits = 0, hintUntil = 0;
    const pad = { x: 0, w: 120, h: 14, vx: 0 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 9, stuck: true, speed: 330 };
    const keys = {};

    const renderLives = () => { livesEl.innerHTML = '⚪'.repeat(lives) + `<span class="lost">${'⚫'.repeat(3 - lives)}</span>`; };
    renderLives();

    function resize() {
      const r = cv.getBoundingClientRect();
      if (!r.width || (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1)) return;
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      pad.w = Math.max(90, Math.min(150, W * 0.2));
      if (!pad.x) pad.x = W / 2;
      layout();
    }
    function layout() {
      const gap = 8, side = 12, top = 16, bh = Math.max(30, Math.min(40, H * 0.08));
      const bw = (W - side * 2 - gap * (COLS - 1)) / COLS;
      bricks.forEach((b) => { b.x = side + b.c * (bw + gap); b.y = top + b.r * (bh + gap); b.w = bw; b.h = bh; });
    }
    function newWall() {
      bricks = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bricks.push({ r, c, alive: true, flash: 0, color: COLORS[(r * 2 + c) % COLORS.length] });
      layout();
    }
    function newPrompt() {
      if (!alive) return;
      const live = bricks.filter((b) => b.alive);
      if (live.length < 5) { newWall(); return newPrompt(); }
      target = next();
      // 정답은 «공이 닿을 수 있는» 벽돌에만 — 바로 아래에 다른 벽돌이 없는 벽돌 (각 열의 맨 아랫줄)
      const open = live.filter((b) => !live.some((o) => o.c === b.c && o.r > b.r));
      const tb = open[(Math.random() * open.length) | 0];
      const others = sample(ctx.words, live.length - 1, [target]);
      let k = 0;
      live.forEach((b) => { b.word = b === tb ? target : others[k++ % Math.max(1, others.length)]; });
      promptEl.textContent = target.ko;
      bump(promptEl);
    }
    function resetBall() { ball.stuck = true; ball.vx = 0; ball.vy = 0; }
    function launch() {
      if (!ball.stuck || busy) return;
      ball.stuck = false;
      const a = (Math.random() - 0.5) * 0.8;
      ball.vx = Math.sin(a) * ball.speed;
      ball.vy = -Math.cos(a) * ball.speed;
    }

    function step(dt) {
      // 받침대
      if (keys.ArrowLeft) pad.x -= 620 * dt;
      if (keys.ArrowRight) pad.x += 620 * dt;
      pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x));
      const py = H - 28;
      if (ball.stuck) { ball.x = pad.x; ball.y = py - ball.r - 1; return; }
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      // 벽
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      // 받침대 — 맞은 위치에 따라 튕기는 각도가 달라진다 (조준)
      if (ball.vy > 0 && ball.y + ball.r >= py && ball.y + ball.r <= py + pad.h + 8 && Math.abs(ball.x - pad.x) <= pad.w / 2 + ball.r) {
        const rel = Math.max(-1, Math.min(1, (ball.x - pad.x) / (pad.w / 2)));
        const a = rel * 1.05;
        ball.vx = Math.sin(a) * ball.speed;
        ball.vy = -Math.cos(a) * ball.speed;
        ball.y = py - ball.r;
        sfx.click();
      }
      // 벽돌
      for (const b of bricks) {
        if (!b.alive) continue;
        const nx = Math.max(b.x, Math.min(ball.x, b.x + b.w)), ny = Math.max(b.y, Math.min(ball.y, b.y + b.h));
        const dx = ball.x - nx, dy = ball.y - ny;
        if (dx * dx + dy * dy > ball.r * ball.r) continue;
        if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        hitBrick(b);
        break;
      }
      // 떨어짐
      if (ball.y - ball.r > H) {
        resetBall();
        if (!ctx.miss(cv)) {
          lives--;
          renderLives();
          if (lives <= 0) ctx.end('⚫ 공을 다 놓쳤어요');
        }
      }
    }

    function hitBrick(b) {
      if (b.word === target) {
        b.alive = false;
        hits++;
        const fake = { getBoundingClientRect: () => { const r = cv.getBoundingClientRect(); return { left: r.left + b.x, top: r.top + b.y, width: b.w, height: b.h }; } };
        ctx.award(12, { el: fake });
        ball.speed = Math.min(560, ball.speed + 10);
        if (hits % 5 === 0) {
          busy = true;
          resetBall();
          promptEl.textContent = '🏅 보너스!';
          writePrompt(ctx, next(), { label: '🧱 보너스 벽돌 · 쓰기 찬스', base: 15 }).then(() => { busy = false; newPrompt(); });
        } else newPrompt();
      } else {
        b.flash = 0.35; // 틀린 벽돌은 깜빡이고 안 깨진다
        sfx.tick();
      }
    }

    function draw() {
      g.clearRect(0, 0, W, H);
      const glow = performance.now() < hintUntil;
      for (const b of bricks) {
        if (!b.alive) continue;
        const isT = b.word === target;
        g.fillStyle = b.flash > 0 ? '#94a3b8' : b.color;
        roundRect(b.x, b.y, b.w, b.h, 9);
        g.fill();
        if (glow && isT) { g.strokeStyle = '#fde047'; g.lineWidth = 4; g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.22)';
        roundRect(b.x + 3, b.y + 3, b.w - 6, b.h * 0.35, 6);
        g.fill();
        if (b.word) {
          g.fillStyle = '#fff';
          let fs = Math.min(18, b.h * 0.5);
          g.font = `700 ${fs}px Fredoka, sans-serif`;
          while (g.measureText(b.word.en).width > b.w - 10 && fs > 9) { fs--; g.font = `700 ${fs}px Fredoka, sans-serif`; }
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(b.word.en, b.x + b.w / 2, b.y + b.h / 2 + 1);
        }
      }
      // 받침대
      const py = H - 28;
      const gr = g.createLinearGradient(0, py, 0, py + pad.h);
      gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#c4b5fd');
      g.fillStyle = gr;
      roundRect(pad.x - pad.w / 2, py, pad.w, pad.h, 7);
      g.fill();
      // 공
      g.beginPath();
      g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      g.fillStyle = '#ffd23f';
      g.shadowColor = '#ffd23f'; g.shadowBlur = 14;
      g.fill();
      g.shadowBlur = 0;
      if (ball.stuck && !busy) {
        g.fillStyle = 'rgba(255,255,255,.8)';
        g.font = '600 15px Pretendard, sans-serif';
        g.textAlign = 'center';
        g.fillText('클릭 또는 스페이스로 발사!', W / 2, H * 0.62);
      }
    }
    function roundRect(x, y, w, hh, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    ctx.onTick((dt) => {
      if (!alive) return;
      resize();
      if (!W) return;
      for (const b of bricks) if (b.flash > 0) b.flash -= dt;
      if (!busy) {
        const n = Math.ceil((ball.speed * dt) / 5); // 빠를 때 벽돌을 뚫고 지나가지 않게 잘게 나눈다
        for (let i = 0; i < n && alive; i++) step(dt / n);
      }
      draw();
    });

    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); pad.x = e.clientX - r.left; });
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); pad.x = e.clientX - r.left; launch(); });
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = e.type === 'keydown'; e.preventDefault(); }
      if (e.type === 'keydown' && e.code === 'Space') { e.preventDefault(); launch(); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    newWall();
    newPrompt();
    box._dbg = () => ({ bricks, target }); // 점검용 (화면에는 안 보임)

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') { hintUntil = performance.now() + 3000; return true; }
        if (id === 'skip') { newPrompt(); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); },
    };
  },
};
