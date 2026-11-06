// 📦 단어 블록 — 떨어지는 블록을 쌓아 줄을 지우는 퍼즐 + «다음 블록 고르기» 단어 퀴즈
// (장르만 같은 독자 게임: 다음 블록을 단어 문제로 고르고, 틀리면 이상한 «고물 블록» 이 온다)
import { h, esc, shuffle, sample, deck, pick } from '../util.js';
import { sfx } from '../sfx.js';
import { bump, shake } from '../fx.js';
import { writePrompt } from '../write.js';

const COLS = 10, ROWS = 18;
const GOOD = [
  { m: [[1, 1, 1, 1]], c: '#3ee0ff' },
  { m: [[1, 1], [1, 1]], c: '#ffd23f' },
  { m: [[0, 1, 0], [1, 1, 1]], c: '#a78bfa' },
  { m: [[0, 1, 1], [1, 1, 0]], c: '#4ade80' },
  { m: [[1, 1, 0], [0, 1, 1]], c: '#ff6b81' },
  { m: [[1, 0, 0], [1, 1, 1]], c: '#60a5fa' },
  { m: [[0, 0, 1], [1, 1, 1]], c: '#fb923c' },
];
const JUNK = [
  { m: [[0, 1, 0], [1, 1, 1], [0, 1, 0]], c: '#64748b' },
  { m: [[1, 0, 1], [1, 1, 1]], c: '#64748b' },
  { m: [[1, 0, 0], [1, 1, 0], [0, 1, 1]], c: '#64748b' },
  { m: [[1, 0, 1], [0, 1, 0], [1, 0, 1]], c: '#64748b' },
];
const LINE_PTS = [0, 15, 40, 80, 130];
const rot = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());

export default {
  id: 'blocks', title: '단어 블록', emoji: '📦', color: '#6366f1', time: 120, isNew: true,
  desc: '떨어지는 블록을 쌓아 줄을 지워요. 다음 블록은 단어 문제로! 틀리면 고물 블록이 와요.',
  tags: ['🧩 퍼즐', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="blocks">
      <div class="bl-side">
        <div class="bl-q"><small>다음 블록 고르기 — 이 뜻은?</small><b class="bl-ko"></b><div class="bl-opts"></div><div class="bl-state"></div></div>
        <div class="bl-info"><span>지운 줄 <b class="bl-lines">0</b></span></div>
      </div>
      <canvas class="bl-cv"></canvas>
      <div class="bl-pad"><button data-a="L">◀</button><button data-a="R">⟳</button><button data-a="D">⬇</button><button data-a="Rt">▶</button><button data-a="H" class="bl-drop">⤓ 떨구기</button></div>
      <div class="bl-help">← → 이동 · ↑ 돌리기 · ↓ 천천히 · 스페이스 바로 떨구기 · 1 2 3 으로 단어 고르기</div>
    </div>`);
    ctx.stage.append(box);
    const cv = box.querySelector('.bl-cv'), g = cv.getContext('2d');
    const koEl = box.querySelector('.bl-ko'), optsEl = box.querySelector('.bl-opts'), stateEl = box.querySelector('.bl-state'), linesEl = box.querySelector('.bl-lines');
    const next = deck(ctx.words);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let cur = null, queued = null, q = null, alive = true, busy = false, fall = 0, lines = 0, cell = 20, W = 0, H = 0;

    // ── 단어 문제로 다음 블록 고르기 ──
    function newQuestion() {
      const w = next();
      const opts = shuffle([w, ...sample(ctx.words, 2, [w])]);
      q = { w, opts, answered: false };
      koEl.textContent = w.ko;
      bump(koEl);
      optsEl.innerHTML = opts.map((o, i) => `<button class="bl-opt" data-i="${i}"><i>${i + 1}</i>${esc(o.en)}</button>`).join('');
      stateEl.textContent = '고르지 않으면 보통 블록이 와요';
      stateEl.className = 'bl-state';
    }
    function answer(i) {
      if (!q || q.answered || busy) return;
      q.answered = true;
      const btn = optsEl.children[i];
      if (q.opts[i] === q.w) {
        btn.classList.add('right');
        ctx.award(8, { el: btn });
        const s = pick(GOOD);
        queued = { ...s, gold: true };
        stateEl.textContent = '✨ 다음은 황금 블록! (줄 점수 2배)';
        stateEl.className = 'bl-state good';
      } else {
        btn.classList.add('wrong');
        optsEl.children[q.opts.indexOf(q.w)].classList.add('right');
        const shielded = ctx.miss(btn);
        queued = shielded ? { ...pick(GOOD) } : { ...pick(JUNK), junk: true };
        stateEl.textContent = shielded ? '🛡️ 방패 덕분에 보통 블록' : '💀 다음은 고물 블록…';
        stateEl.className = 'bl-state bad';
      }
    }
    optsEl.addEventListener('pointerdown', (e) => { const b = e.target.closest('.bl-opt'); if (b) { e.preventDefault(); answer(+b.dataset.i); } });

    // ── 블록 엔진 ──
    function spawn() {
      const s = queued || { ...pick(GOOD) };
      queued = null;
      cur = { m: s.m.map((r) => [...r]), c: s.c, gold: !!s.gold, junk: !!s.junk, x: 0, y: 0 };
      cur.x = Math.floor((COLS - cur.m[0].length) / 2);
      newQuestion();
      if (hits(cur.m, cur.x, cur.y)) ctx.end('📦 블록이 꼭대기까지 쌓였어요');
    }
    function hits(m, x, y) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
      return false;
    }
    const move = (dx, dy) => { if (!cur || busy) return false; if (hits(cur.m, cur.x + dx, cur.y + dy)) return false; cur.x += dx; cur.y += dy; return true; };
    function rotate() {
      if (!cur || busy) return;
      const m = rot(cur.m);
      for (const k of [0, -1, 1, -2, 2]) if (!hits(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; sfx.click(); return; }
    }
    function lock() {
      cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) grid[cur.y + r][cur.x + c] = { c: cur.c, gold: cur.gold }; }));
      sfx.pop();
      // 줄 지우기
      let n = 0, gold = false;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r].every(Boolean)) {
          gold = gold || grid[r].some((x) => x.gold);
          grid.splice(r, 1);
          grid.unshift(Array(COLS).fill(null));
          n++;
          r++;
        }
      }
      cur = null;
      if (n) {
        lines += n;
        linesEl.textContent = lines;
        bump(linesEl);
        ctx.award(LINE_PTS[n] * (gold ? 2 : 1), { el: cv });
        if (n >= 2) sfx.combo();
        if (lines >= 4 && Math.floor((lines - n) / 4) < Math.floor(lines / 4)) {
          busy = true;
          writePrompt(ctx, next(), { label: '📦 보너스 · 쓰기 찬스', base: 15 }).then(() => { busy = false; spawn(); });
          return;
        }
      }
      spawn();
    }
    function hardDrop() { if (!cur || busy) return; while (move(0, 1)); fall = 0; lock(); }

    // ── 그리기 ──
    function resize() {
      const r = cv.getBoundingClientRect();
      if (!r.width || (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1)) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.floor(Math.min(W / COLS, H / ROWS));
    }
    function block(x, y, color, gold, ghost) {
      const ox = (W - cell * COLS) / 2, oy = (H - cell * ROWS) / 2;
      const px = ox + x * cell, py = oy + y * cell;
      if (ghost) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(px + 2, py + 2, cell - 4, cell - 4); return; }
      g.fillStyle = color;
      g.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      g.fillStyle = 'rgba(255,255,255,.3)';
      g.fillRect(px + 1, py + 1, cell - 2, Math.max(3, cell * 0.22));
      if (gold) { g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5; g.strokeRect(px + 2, py + 2, cell - 4, cell - 4); }
    }
    function draw() {
      g.clearRect(0, 0, W, H);
      const ox = (W - cell * COLS) / 2, oy = (H - cell * ROWS) / 2;
      g.fillStyle = 'rgba(10,6,30,.55)';
      g.fillRect(ox, oy, cell * COLS, cell * ROWS);
      g.strokeStyle = 'rgba(255,255,255,.05)';
      for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(ox + x * cell, oy); g.lineTo(ox + x * cell, oy + ROWS * cell); g.stroke(); }
      for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(ox, oy + y * cell); g.lineTo(ox + COLS * cell, oy + y * cell); g.stroke(); }
      grid.forEach((row, y) => row.forEach((v, x) => v && block(x, y, v.c, v.gold)));
      if (cur) {
        let gy = cur.y;
        while (!hits(cur.m, cur.x, gy + 1)) gy++;
        cur.m.forEach((row, r) => row.forEach((v, c) => v && block(cur.x + c, gy + r, null, false, true)));
        cur.m.forEach((row, r) => row.forEach((v, c) => v && cur.y + r >= 0 && block(cur.x + c, cur.y + r, cur.c, cur.gold)));
      }
    }

    ctx.onTick((dt) => {
      if (!alive) return;
      resize();
      if (!busy && cur) {
        fall += dt;
        const speed = Math.max(0.18, 0.75 - lines * 0.025);
        if (fall >= speed) { fall = 0; if (!move(0, 1)) lock(); }
      }
      if (W) draw();
    });

    const act = { L: () => move(-1, 0), Rt: () => move(1, 0), R: rotate, D: () => { move(0, 1); fall = 0; }, H: hardDrop };
    box.querySelector('.bl-pad').addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); act[b.dataset.a](); } });
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'ArrowLeft') act.L();
      else if (k === 'ArrowRight') act.Rt();
      else if (k === 'ArrowUp' || k.toLowerCase() === 'x') act.R();
      else if (k === 'ArrowDown') act.D();
      else if (e.code === 'Space') { if (!e.repeat) act.H(); }
      else if (/^[1-3]$/.test(k)) answer(+k - 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    spawn();

    return {
      onItem(id) {
        if (busy || !q) return false;
        if (id === 'hint') {
          if (q.answered) return false;
          const wrong = [...optsEl.children].filter((b, i) => q.opts[i] !== q.w && !b.disabled);
          if (!wrong.length) return false;
          wrong[0].disabled = true; wrong[0].classList.add('gone');
          return true;
        }
        if (id === 'skip') {
          // 패스 = 지금 블록을 버리고 새 블록 (쌓인 게 위험할 때)
          if (!cur) return false;
          cur = null; spawn(); return true;
        }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
