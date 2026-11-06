// 🫧 단어 버블팡 — 거품을 쏴서 «뜻에 맞는 단어» 몬스터만 가두고 터뜨리는 한 화면 플랫폼 게임
// 캐릭터·맵·이름은 모두 이 게임만의 독자 디자인.
//  · 스테이지: 정답 몬스터를 4마리 잡으면 다음 판 (판마다 발판 모양이 바뀌고 몬스터가 빨라짐)
//  · 거품 타기: 떠다니는 빈 거품을 위에서 밟으면 높이 튕겨 오른다
//  · 연쇄 터뜨리기: 가둔 거품을 터뜨릴 때 가까이 있는 빈 거품도 줄줄이 터지며 보너스
//  · 보너스 아이템: 터뜨리면 과일·사탕·신발·시계·별·하트가 떨어진다
import { h, shuffle, sample, deck, pick } from '../util.js';
import { sfx } from '../sfx.js';
import { bump, toast } from '../fx.js';
import { writePrompt } from '../write.js';

const VW = 800, VH = 480;
const G = 1500, JUMP = 640, RUN = 230;
const PER_STAGE = 4;
const PENALTY = 3;
const MONS = ['👾', '👻', '🦇', '🐌', '🦀', '🐙'];
const FRUITS = ['🍒', '🍓', '🍉', '🍌', '🍇', '🍑', '🍍'];

// 판마다 다른 발판 (모두 아래에서 뛰어 올라갈 수 있다). hole = 바닥 구멍 → 떨어지면 맨 위에서 다시 나온다
const STAGES = [
  { name: '바닷가 계단', plats: [[0, 450, 800], [60, 350, 250], [490, 350, 250], [230, 250, 340], [40, 150, 220], [540, 150, 220]] },
  { name: '구멍 난 바닥', plats: [[0, 450, 330], [470, 450, 330], [140, 355, 520], [0, 260, 260], [540, 260, 260], [250, 165, 300]] },
  { name: '지그재그', plats: [[0, 450, 800], [0, 365, 300], [500, 300, 300], [0, 230, 300], [500, 160, 300], [300, 100, 200]] },
  { name: '섬 다섯 개', plats: [[0, 450, 360], [440, 450, 360], [80, 360, 160], [560, 360, 160], [320, 290, 160], [100, 200, 160], [540, 200, 160], [320, 120, 160]] },
  { name: '탑 꼭대기', plats: [[0, 450, 800], [330, 370, 140], [180, 300, 140], [480, 300, 140], [40, 220, 160], [600, 220, 160], [300, 150, 200]] },
];
const ITEMS = {
  candy: { e: '🍬', name: '사탕 — 거품 연사', dur: 8 },
  shoe:  { e: '👟', name: '신발 — 빨라짐', dur: 8 },
  clock: { e: '⏰', name: '시계 — 시간 +5초' },
  star:  { e: '⭐', name: '별 — 몬스터 얼음', dur: 4 },
  heart: { e: '💙', name: '하트 — 목숨 +1' },
};

export default {
  id: 'bubble', title: '단어 버블팡', emoji: '🫧', color: '#0ea5e9', time: 120, isNew: true,
  desc: '거품으로 뜻에 맞는 몬스터를 가두고 펑! 거품을 밟아 높이 뛰고, 연쇄로 터뜨리고, 아이템을 모아 스테이지를 깨요.',
  tags: ['🕹️ 액션', '🏆 스테이지', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="bubble">
      <div class="bb-hud"><div class="bb-stage"></div><div class="bb-prompt"><small>이 뜻의 몬스터를 거품에 가둬라!</small><b></b></div><div class="bb-side"><div class="bb-lives"></div><div class="bb-buffs"></div></div></div>
      <div class="bb-wrap"><canvas class="bb-cv"></canvas><div class="bb-banner hidden"></div></div>
      <div class="bb-pad"><button data-k="L">◀</button><button data-k="R">▶</button><span></span><button data-k="J" class="jp">⤒ 점프</button><button data-k="F" class="fire">🫧 거품</button></div>
      <div class="bb-help">← → 이동 · ↑/스페이스 점프 · Z/F 거품 · 거품을 위에서 밟으면 높이 점프! · 가둔 거품 근처에 빈 거품을 모아 두고 터뜨리면 연쇄 보너스</div>
    </div>`);
    ctx.stage.append(box);
    const cv = box.querySelector('.bb-cv'), g = cv.getContext('2d');
    const promptEl = box.querySelector('.bb-prompt b'), livesEl = box.querySelector('.bb-lives'), stageEl = box.querySelector('.bb-stage');
    const buffsEl = box.querySelector('.bb-buffs'), banner = box.querySelector('.bb-banner');
    const next = deck(ctx.words);
    const keys = { L: false, R: false };
    let alive = true, busy = false, target = null, lives = 3, caught = 0, stageCaught = 0, stageNo = 0, hintUntil = 0;
    let scale = 1, ox = 0, oy = 0, W = 0, H = 0, tAll = 0, plats = [];
    const buff = { candy: 0, shoe: 0, star: 0 };
    const me = { x: 380, y: 400, vx: 0, vy: 0, w: 36, h: 40, face: 1, onGround: false, inv: 0, cool: 0 };
    let mons = [], shots = [], items = [], fx = [];

    const renderLives = () => { livesEl.innerHTML = '💙'.repeat(lives) + `<span class="lost">${'🤍'.repeat(Math.max(0, 3 - lives))}</span>`; };
    const renderBuffs = () => {
      buffsEl.innerHTML = Object.entries(buff).filter(([, v]) => v > 0).map(([k, v]) => `<span>${ITEMS[k].e}${Math.ceil(v)}</span>`).join('');
    };
    renderLives();
    const speedUp = () => 1 + stageNo * 0.15;

    // ── 스테이지 ──
    function loadStage(n) {
      stageNo = n;
      const s = STAGES[n % STAGES.length];
      plats = s.plats.map(([x, y, w]) => ({ x, y, w }));
      mons = []; shots = []; items = [];
      Object.assign(me, { x: 380, y: 300, vx: 0, vy: 0, inv: 1.5 });
      stageCaught = 0;
      stageEl.innerHTML = `<b>STAGE ${n + 1}</b><small>${s.name}</small><i>${'●'.repeat(stageCaught)}${'○'.repeat(PER_STAGE)}</i>`;
    }
    const renderStage = () => { stageEl.querySelector('i').textContent = '●'.repeat(stageCaught) + '○'.repeat(PER_STAGE - stageCaught); };
    async function showBanner(html, ms = 1500) {
      banner.innerHTML = html;
      banner.classList.remove('hidden');
      await new Promise((r) => setTimeout(r, ms));
      banner.classList.add('hidden');
    }
    async function clearStage() {
      busy = true;
      sfx.win();
      ctx.bonus(30 + stageNo * 10, cv, `STAGE ${stageNo + 1} 클리어! `);
      await showBanner(`🎉 <b>STAGE ${stageNo + 1} CLEAR!</b><small>다음 판은 몬스터가 더 빨라요</small>`);
      if (!alive) return;
      loadStage(stageNo + 1);
      await showBanner(`<b>STAGE ${stageNo + 1}</b><small>${STAGES[stageNo % STAGES.length].name}</small>`, 1000);
      busy = false;
      newPrompt();
    }

    // ── 몬스터 · 문제 ──
    function spawnMon() {
      const p = pick(plats.slice(1));
      mons.push({ x: p.x + 10 + Math.random() * Math.max(10, p.w - 50), y: -40, vx: (Math.random() < 0.5 ? -1 : 1) * (55 + Math.random() * 30) * speedUp(),
        vy: 0, w: 38, h: 38, word: null, face: pick(MONS), state: 'walk', angry: 0, t: 0, onGround: false, plat: null });
    }
    function newPrompt() {
      if (!alive) return;
      target = next();
      promptEl.textContent = target.ko;
      bump(promptEl);
      const free = mons.filter((m) => m.state === 'walk');
      while (free.length < 4) { spawnMon(); free.push(mons.at(-1)); }
      const words = shuffle([target, ...sample(ctx.words, free.length - 1, [target])]);
      free.forEach((m, i) => { m.word = words[i] || pick(ctx.words); });
      if (!free.some((m) => m.word === target)) free[0].word = target;
    }

    // ── 물리 ──
    function land(o, prevBottom) {
      o.onGround = false;
      if (o.vy < 0) return null;
      for (const p of plats) {
        const bottom = o.y + o.h;
        if (prevBottom <= p.y + 1 && bottom >= p.y && o.x + o.w > p.x + 4 && o.x < p.x + p.w - 4) {
          o.y = p.y - o.h; o.vy = 0; o.onGround = true; return p;
        }
      }
      return null;
    }
    const overlap = (a, b, pad = 0) => a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;
    const wrapY = (o) => { if (o.y > VH + 10) o.y = -o.h; }; // 바닥 구멍으로 떨어지면 위에서 다시

    function step(dt) {
      tAll += dt;
      for (const k in buff) buff[k] = Math.max(0, buff[k] - dt);
      // 나
      const run = RUN * (buff.shoe ? 1.5 : 1);
      me.vx = (keys.R ? run : 0) - (keys.L ? run : 0);
      if (me.vx) me.face = Math.sign(me.vx);
      me.vy += G * dt;
      const pb = me.y + me.h;
      me.x = Math.max(0, Math.min(VW - me.w, me.x + me.vx * dt));
      me.y += me.vy * dt;
      land(me, pb);
      wrapY(me);
      me.inv = Math.max(0, me.inv - dt);
      me.cool = Math.max(0, me.cool - dt);

      // 거품: 날아가다가 → 떠오르는 빈 거품이 된다
      for (const s of shots) {
        s.t += dt;
        if (s.t < 0.5) s.x += s.vx * dt;
        else { s.float = true; s.y = Math.max(28, s.y - 45 * dt); s.x += Math.sin(s.t * 2 + s.seed) * 18 * dt; }
        s.x = Math.max(s.r, Math.min(VW - s.r, s.x));
        // 몬스터 맞히기 (날아가는 동안만)
        if (!s.float) {
          for (const m of mons) {
            if (s.dead || m.state !== 'walk' || m.y < 0) continue;
            if (Math.abs(s.x - (m.x + m.w / 2)) < s.r + m.w / 2 && Math.abs(s.y - (m.y + m.h / 2)) < s.r + m.h / 2) {
              s.dead = true;
              if (m.word === target) { m.state = 'bubble'; m.t = 0; sfx.pop(); }
              else {
                m.angry = 3; m.vx = Math.sign(m.vx || 1) * 150 * speedUp();
                const at = fakeEl(m.x, m.y, m.w, m.h);
                if (!ctx.miss(at)) ctx.penalty(PENALTY, at);
              }
            }
          }
        }
        // 거품 타기: 떨어지면서 빈 거품 위를 밟으면 튕겨 오른다
        if (s.float && !s.dead && me.vy > 0) {
          const footY = me.y + me.h, cx = me.x + me.w / 2;
          if (Math.abs(cx - s.x) < s.r + 10 && footY >= s.y - s.r - 4 && footY <= s.y + 4) {
            me.vy = -JUMP * 1.05;
            s.dead = true;
            fx.push({ x: s.x, y: s.y, t: 0, e: '💦' });
            sfx.pop();
          }
        }
        if (s.t > 7) s.dead = true;
      }
      shots = shots.filter((s) => !s.dead);

      // 몬스터
      const frozen = buff.star > 0;
      for (const m of mons) {
        m.t += dt;
        if (m.state === 'bubble') {
          m.y = Math.max(24, m.y - 40 * dt);
          m.x += Math.sin(m.t * 3) * 20 * dt;
          if (overlap(me, m, 4)) { popTrapped(m); continue; }
          if (m.t > 7) { m.state = 'walk'; m.angry = 2; m.vy = 0; m.vx = Math.sign(m.vx || 1) * 130 * speedUp(); }
          continue;
        }
        if (m.state !== 'walk') continue;
        if (!frozen) {
          m.angry = Math.max(0, m.angry - dt);
          if (!m.angry && Math.abs(m.vx) > 100 * speedUp()) m.vx = Math.sign(m.vx) * 70 * speedUp();
          if (m.onGround && m.plat && m.plat !== plats[0] && m.plat.w < 790) {
            const nx = m.x + m.vx * dt;
            if (nx < m.plat.x + 2 || nx + m.w > m.plat.x + m.plat.w - 2) m.vx *= -1;
          }
          m.x += m.vx * dt;
        }
        m.vy += G * dt;
        const mb = m.y + m.h;
        m.y += m.vy * dt;
        const p = land(m, mb);
        if (p) m.plat = p;
        if (m.x < 0 || m.x + m.w > VW) { m.vx *= -1; m.x = Math.max(0, Math.min(VW - m.w, m.x)); }
        wrapY(m);
        if (!frozen && !me.inv && overlap(me, m, 8)) {
          me.inv = 1.6;
          me.vy = -380;
          if (!ctx.miss(fakeEl(me.x, me.y, me.w, me.h))) {
            lives--;
            renderLives();
            if (lives <= 0) { ctx.end('💥 몬스터에게 다 잡혔어요'); return; }
          }
        }
      }

      // 떨어지는 아이템
      for (const it of items) {
        it.t += dt;
        it.vy += G * 0.6 * dt;
        const ib = it.y + it.h;
        it.y += it.vy * dt;
        land(it, ib);
        wrapY(it);
        if (overlap(me, it, 2)) { collect(it); it.dead = true; }
        if (it.t > 8) it.dead = true;
      }
      items = items.filter((i) => !i.dead);
      fx.forEach((p) => { p.t += dt; p.y -= 50 * dt; });
      fx = fx.filter((p) => p.t < 0.9);
    }

    // 가둔 거품 터뜨리기 + 연쇄
    function popTrapped(m) {
      m.state = 'gone';
      mons = mons.filter((x) => x !== m);
      const at = fakeEl(m.x, m.y, m.w, m.h);
      ctx.award(14, { el: at });
      // 연쇄: 터진 자리에서 가까운 빈 거품이 줄줄이 터진다
      let frontier = [{ x: m.x + m.w / 2, y: m.y + m.h / 2 }], chain = 0;
      while (frontier.length) {
        const nxt = [];
        for (const p of frontier) for (const s of shots) {
          if (s.dead || !s.float) continue;
          if (Math.hypot(s.x - p.x, s.y - p.y) < 100) { s.dead = true; chain++; nxt.push(s); fx.push({ x: s.x, y: s.y, t: 0, e: '💥' }); }
        }
        frontier = nxt;
      }
      shots = shots.filter((s) => !s.dead);
      if (chain) {
        ctx.bonus(chain * 6 + (chain >= 3 ? 10 : 0), at, `연쇄 ${chain}! `);
        sfx.combo();
      }
      // 아이템 떨어뜨리기 (과일은 늘, 특별 아이템은 가끔 · 연쇄가 크면 더 자주)
      dropItem(m.x, m.y, { kind: 'fruit', e: pick(FRUITS) });
      if (Math.random() < 0.35 + chain * 0.12) {
        const r = Math.random();
        const kind = r < 0.3 ? 'candy' : r < 0.55 ? 'shoe' : r < 0.75 ? 'clock' : r < 0.92 ? 'star' : 'heart';
        dropItem(m.x + 20, m.y - 10, { kind, e: ITEMS[kind].e });
      }
      caught++;
      stageCaught++;
      renderStage();
      if (stageCaught >= PER_STAGE) { clearStage(); return; }
      if (caught % 5 === 0) {
        busy = true;
        promptEl.textContent = '🌟 보너스!';
        writePrompt(ctx, next(), { label: '🫧 보너스 거품 · 쓰기 찬스', base: 15 }).then(() => { busy = false; newPrompt(); });
      } else newPrompt();
    }
    function dropItem(x, y, it) { items.push({ ...it, x, y, w: 30, h: 30, vy: -220, t: 0 }); }
    function collect(it) {
      const at = fakeEl(it.x, it.y, it.w, it.h);
      sfx.coin();
      if (it.kind === 'fruit') { ctx.bonus(5, at); return; }
      const info = ITEMS[it.kind];
      if (it.kind === 'clock') ctx.timer.add(5);
      else if (it.kind === 'heart') { if (lives < 3) { lives++; renderLives(); } else ctx.bonus(15, at); }
      else buff[it.kind] = info.dur;
      fx.push({ x: it.x, y: it.y, t: 0, e: info.e });
      toast(`${info.e} ${info.name}`, 'good');
    }
    function shoot() {
      if (busy || me.cool > 0) return;
      me.cool = buff.candy ? 0.16 : 0.38;
      shots.push({ x: me.x + me.w / 2 + me.face * 26, y: me.y + me.h / 2 + 4, vx: me.face * (buff.candy ? 560 : 470), r: 16, t: 0, seed: Math.random() * 6 });
      sfx.click();
    }
    function jump() { if (busy || !me.onGround) return; me.vy = -JUMP; me.onGround = false; }

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
    }
    function emoji(ch, x, y, size, flip) {
      g.save();
      g.translate(x, y);
      if (flip) g.scale(-1, 1);
      g.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ch, 0, 0);
      g.restore();
    }
    // 주인공 «방울이» — 기기마다 방향이 다른 이모지 대신 직접 그린다. 눈·입이 있는 쪽 = 거품이 나가는 쪽
    function drawHero(cx, cy, face) {
      g.save();
      g.translate(cx, cy);
      g.scale(face, 1); // 오른쪽(1) 기준으로 그리고, 왼쪽이면 통째로 뒤집는다
      const bob = Math.sin(tAll * 8) * (me.onGround && me.vx ? 1.5 : 0);
      g.translate(0, bob);
      // 꼬리 지느러미 (등 쪽)
      g.fillStyle = '#38bdf8';
      g.beginPath(); g.moveTo(-14, 2); g.lineTo(-26, -8); g.lineTo(-24, 10); g.closePath(); g.fill();
      // 몸
      const body = g.createRadialGradient(-5, -8, 4, 0, 0, 22);
      body.addColorStop(0, '#e0f7ff'); body.addColorStop(0.55, '#7dd3fc'); body.addColorStop(1, '#0ea5e9');
      g.fillStyle = body;
      g.beginPath(); g.ellipse(0, 0, 19, 18, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0369a1'; g.lineWidth = 2; g.stroke();
      // 머리 위 물방울 더듬이
      g.fillStyle = '#bae6fd';
      g.beginPath(); g.arc(-2, -22, 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#0369a1'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-1, -18); g.lineTo(-1, -16); g.stroke();
      // 눈 (앞쪽)
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(8, -5, 6, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0f172a'; g.beginPath(); g.arc(10, -4, 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(11, -5.5, 1.1, 0, Math.PI * 2); g.fill();
      // 볼
      g.fillStyle = 'rgba(244,114,182,.55)'; g.beginPath(); g.ellipse(4, 6, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
      // 입 (앞쪽 끝 — 여기서 거품이 나간다)
      g.fillStyle = '#0369a1'; g.beginPath(); g.ellipse(17, 5, 3, 2.6, 0, 0, Math.PI * 2); g.fill();
      // 쏜 직후엔 입 앞에 작은 거품
      if (me.cool > 0.2) { g.strokeStyle = '#e0f2fe'; g.lineWidth = 2; g.beginPath(); g.arc(25, 4, 4, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      // 바라보는 쪽을 알려 주는 작은 화살표 (발밑)
      g.fillStyle = 'rgba(253,224,71,.85)';
      g.beginPath();
      const ay = cy + 23, ax = cx + face * 12;
      g.moveTo(ax + face * 7, ay); g.lineTo(ax - face * 3, ay - 5); g.lineTo(ax - face * 3, ay + 5); g.closePath(); g.fill();
    }
    function label(text, x, y, color) {
      g.font = '700 15px Fredoka, sans-serif';
      const w = g.measureText(text).width + 14;
      g.fillStyle = color || '#fff';
      g.beginPath(); g.roundRect(x - w / 2, y - 10, w, 20, 8); g.fill();
      g.fillStyle = '#1d1640'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, x, y + 1);
    }
    function bubbleShape(x, y, r, fill) {
      g.fillStyle = fill; g.strokeStyle = '#e0f2fe'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.4, r * 0.18, 0, 7); g.fill();
    }
    function draw() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.save();
      g.translate(ox, oy);
      g.scale(scale, scale);
      const hue = (stageNo * 47) % 360;
      const bg = g.createLinearGradient(0, 0, 0, VH);
      bg.addColorStop(0, `hsl(${200 + hue * 0.2}, 70%, 24%)`); bg.addColorStop(1, '#1e1b4b');
      g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, VW, VH, 18); g.fill();
      for (let i = 0; i < 14; i++) {
        const bx = (i * 97 + tAll * 12 * (i % 3 + 1)) % VW, by = VH - ((tAll * 25 * (i % 4 + 1) + i * 53) % VH);
        g.strokeStyle = 'rgba(186,230,253,.16)'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 4 + (i % 4) * 2, 0, 7); g.stroke();
      }
      for (const p of plats) {
        const pg = g.createLinearGradient(0, p.y, 0, p.y + 18);
        pg.addColorStop(0, `hsl(${170 + hue}, 70%, 65%)`); pg.addColorStop(1, `hsl(${170 + hue}, 70%, 30%)`);
        g.fillStyle = pg; g.beginPath(); g.roundRect(p.x, p.y, p.w, 18, 9); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        for (let x = p.x + 10; x < p.x + p.w - 10; x += 24) { g.beginPath(); g.arc(x, p.y + 6, 3, 0, 7); g.fill(); }
      }
      // 빈 거품 (밟을 수 있음 · 사라지기 전엔 깜빡)
      for (const s of shots) {
        if (s.t > 5.5 && Math.floor(s.t * 8) % 2) continue;
        bubbleShape(s.x, s.y, s.r, s.float ? 'rgba(125,211,252,.28)' : 'rgba(186,230,253,.45)');
      }
      const glow = performance.now() < hintUntil, frozen = buff.star > 0;
      for (const m of mons) {
        const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
        if (m.state === 'bubble') {
          bubbleShape(cx, cy, 30, 'rgba(125,211,252,.4)');
          emoji(m.face, cx, cy + 2, 30);
          if (m.t > 5 && Math.floor(m.t * 6) % 2) { g.strokeStyle = '#f87171'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 33, 0, 7); g.stroke(); }
          continue;
        }
        if (m.angry && !frozen) { g.fillStyle = 'rgba(239,68,68,.35)'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill(); }
        if (frozen) { g.fillStyle = 'rgba(186,230,253,.45)'; g.beginPath(); g.roundRect(m.x - 4, m.y - 2, m.w + 8, m.h + 6, 8); g.fill(); }
        emoji(m.face, cx, cy, 34);
        if (m.word) label(m.word.en, cx, m.y - 12, glow && m.word === target ? '#fde047' : m.angry ? '#fecaca' : '#fff');
      }
      for (const it of items) {
        if (it.t > 6 && Math.floor(it.t * 8) % 2) continue;
        emoji(it.e, it.x + it.w / 2, it.y + it.h / 2, 28);
      }
      if (!me.inv || Math.floor(me.inv * 10) % 2) {
        if (buff.shoe) { g.fillStyle = 'rgba(253,224,71,.3)'; g.beginPath(); g.ellipse(me.x + me.w / 2, me.y + me.h, 22, 6, 0, 0, 7); g.fill(); }
        drawHero(me.x + me.w / 2, me.y + me.h / 2, me.face);
      }
      for (const p of fx) { g.globalAlpha = Math.max(0, 1 - p.t); emoji(p.e, p.x, p.y, 28); g.globalAlpha = 1; }
      g.restore();
    }

    let buffTick = 0;
    ctx.onTick((dt) => {
      if (!alive) return;
      resize();
      if (!W) return;
      if (!busy) { const n = dt > 0.03 ? 2 : 1; for (let i = 0; i < n && alive; i++) step(dt / n); }
      buffTick += dt;
      if (buffTick > 0.25) { buffTick = 0; renderBuffs(); }
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

    loadStage(0);
    newPrompt();
    box._dbg = () => ({ me, mons, target, shots, items, buff, plats, get stage() { return stageNo; }, get stageCaught() { return stageCaught; } }); // 점검용

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
