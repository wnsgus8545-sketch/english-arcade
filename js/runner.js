// 게임 한 판을 돌리는 틀 — 타이머 · 점수/콤보 · 아이템 · 결과 화면
import * as S from './store.js';
import { ITEMS, GENERIC_ITEMS, QUICK_ITEMS } from './items.js';
import { h, esc, sleep, countUp } from './util.js';
import { sfx } from './sfx.js';
import { toast, floatText, shake, bump, confetti, burst } from './fx.js';

export function runGame(game, { root, words, getEvent, onExit, onShop }) {
  const st = { score: 0, correct: 0, wrong: 0, combo: 0, maxCombo: 0, writing: 0, doubleUntil: 0, goldUntil: 0, shield: false, started: false, ended: false };
  const supports = (id) => GENERIC_ITEMS.includes(id) || game.items.includes(id);
  const el = h(`<div class="game" style="--c:${game.color}">
    <header class="g-top">
      <button class="btn ghost g-quit">✕ 그만</button>
      <div class="g-name"><span>${game.emoji}</span>${esc(game.title)}</div>
      <div class="g-score"><small>점수</small><b>0</b></div>
    </header>
    <div class="g-meter"><div class="timebar"><i></i></div><span class="g-time">${game.time}</span></div>
    <div class="g-badges"></div>
    <main class="g-stage"></main>
    <footer class="itembar"></footer>
  </div>`);
  root.replaceChildren(el);
  const q = (s) => el.querySelector(s);
  const stage = q('.g-stage'), scoreEl = q('.g-score b'), bar = q('.timebar i'), timeEl = q('.g-time'), badges = q('.g-badges'), itembar = q('.itembar');

  // ── 아이템 버튼 (한 번 만들고 숫자만 바꾼다) ──
  const itemBtns = {};
  for (const [id, it] of Object.entries(ITEMS)) {
    const ok = supports(id);
    const b = h(`<button class="item ${ok ? '' : 'na'} ${it.hot ? 'hot' : ''}" title="${esc(it.desc)}"><span class="ie">${it.emoji}</span><span class="in">${esc(it.short)}</span><b class="ic">0</b></button>`);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); useItem(id, b); }); // click 보다 빠르게 반응
    itembar.append(b);
    itemBtns[id] = b;
  }
  function updateItems() {
    for (const [id, b] of Object.entries(itemBtns)) {
      const n = S.me.data.items[id] || 0;
      b.querySelector('.ic').textContent = n;
      b.classList.toggle('empty', n <= 0);
    }
  }
  updateItems();

  // ── 타이머 (한 개의 rAF 루프로 게임 애니메이션까지 같이 돌린다) ──
  const tickers = new Set();
  const timer = {
    total: game.time, left: game.time, rate: 1,
    add(s) { this.left += s; this.total = Math.max(this.total, this.left); floatText(timeEl, `+${s}초`, 't'); bump(timeEl); },
  };
  let raf = 0, last = 0, lastSec = -1;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (!st.started || st.ended) return;
    timer.left -= dt * timer.rate;
    for (const f of tickers) { f(dt); if (st.ended) return; }
    const p = Math.max(0, timer.left / timer.total);
    bar.style.transform = `scaleX(${p})`;
    el.classList.toggle('hurry', timer.left < 10);
    const sec = Math.max(0, Math.ceil(timer.left));
    if (sec !== lastSec) { timeEl.textContent = sec; if (sec <= 5 && sec > 0) sfx.tick(); lastSec = sec; }
    renderBadges();
    if (timer.left <= 0) end('⏰ 시간 끝!');
  }
  raf = requestAnimationFrame(loop);

  // ── 점수 ──
  const eventOn = () => { const e = getEvent?.(); return !!(e && e.type === 'double' && e.until > S.now()); };
  const comboMult = () => 1 + Math.min(Math.floor(st.combo / 5), 4) * 0.5;
  function award(base, { writing = false, el: at = null } = {}) {
    if (st.ended) return 0;
    st.combo++;
    st.maxCombo = Math.max(st.maxCombo, st.combo);
    st.correct++;
    if (writing) st.writing++;
    let m = comboMult();
    if (performance.now() < st.doubleUntil) m *= 2;
    if (performance.now() < st.goldUntil) m *= 3;
    if (eventOn()) m *= 2;
    if (writing) m *= 2;
    const pts = Math.round(base * m);
    st.score += pts;
    S.addPoints(pts);
    scoreEl.textContent = st.score.toLocaleString();
    bump(scoreEl);
    floatText(at || scoreEl, `+${pts}${writing ? ' ✍️×2' : ''}`, writing ? 'w' : '');
    if (!writing) sfx.good(st.combo);
    if (st.combo % 5 === 0) comboPop();
    renderBadges(true);
    return pts;
  }
  function miss(at) {
    if (st.ended) return true;
    if (st.shield) {
      st.shield = false;
      toast('🛡️ 방패가 막아 줬어요! 콤보 유지', 'good');
      sfx.item();
      renderBadges(true);
      return true;
    }
    st.combo = 0;
    st.wrong++;
    sfx.bad();
    shake(at || stage);
    renderBadges(true);
    return false;
  }
  /** 보너스 점수 — 아이템·연쇄 같은 덤. 콤보·정확도에는 들어가지 않는다 (2배·황금 효과만 적용) */
  function bonus(base, at, label = '') {
    if (st.ended) return 0;
    let m = 1;
    if (performance.now() < st.doubleUntil) m *= 2;
    if (performance.now() < st.goldUntil) m *= 3;
    if (eventOn()) m *= 2;
    const pts = Math.round(base * m);
    st.score += pts;
    S.addPoints(pts);
    scoreEl.textContent = st.score.toLocaleString();
    bump(scoreEl);
    floatText(at || scoreEl, `${label}+${pts}`, 'b');
    return pts;
  }
  /** 감점 — 이번 판 점수는 0 아래로 내려가지 않는다 */
  function penalty(n, at) {
    if (st.ended) return 0;
    const cut = Math.min(n, st.score);
    if (!cut) return 0;
    st.score -= cut;
    S.addPoints(-cut);
    scoreEl.textContent = st.score.toLocaleString();
    floatText(at || scoreEl, `−${cut}`, 'minus');
    return cut;
  }
  function comboPop() {
    sfx.combo();
    const c = h(`<div class="combo-pop">🔥 ${st.combo} COMBO! <small>×${comboMult().toFixed(1)}</small></div>`);
    el.append(c);
    setTimeout(() => c.remove(), 900);
  }
  let badgeKey = '';
  function renderBadges(force) {
    const dbl = Math.max(0, Math.ceil((st.doubleUntil - performance.now()) / 1000));
    const gold = Math.max(0, Math.ceil((st.goldUntil - performance.now()) / 1000));
    const ev = eventOn();
    const key = `${st.combo}|${dbl}|${gold}|${st.shield}|${ev}|${timer.rate}`;
    if (!force && key === badgeKey) return;
    badgeKey = key;
    const out = [];
    if (st.combo >= 2) out.push(`<span class="badge combo">🔥 ${st.combo}콤보 ×${comboMult().toFixed(1)}</span>`);
    if (gold) out.push(`<span class="badge gold">🌟 황금 3배 ${gold}초</span>`);
    if (dbl) out.push(`<span class="badge dbl">✨ 2배 ${dbl}초</span>`);
    if (ev) out.push(`<span class="badge ev">⚡ 선생님 2배 타임</span>`);
    if (st.shield) out.push(`<span class="badge shield">🛡️ 방패 ON</span>`);
    if (timer.rate < 1) out.push(`<span class="badge slow">⏳ 쓰기 중 · 시간 천천히</span>`);
    badges.innerHTML = out.join('');
    el.classList.toggle('doubled', !!dbl || ev);
    el.classList.toggle('golden', !!gold);
  }

  // ── 아이템 사용 — 서버를 기다리지 않는다 ──
  function useItem(id, btn) {
    if (st.ended || !st.started) return;
    if (!supports(id)) { toast('이 게임에선 못 쓰는 아이템이에요'); return; }
    if (!S.useItem(id)) { toast('아이템이 없어요 · 판이 끝나면 결과 화면에서 바로 살 수 있어요'); shake(btn); return; }
    let ok = true, msg = '지금은 쓸 수 없어요';
    if (id === 'time') timer.add(10);
    else if (id === 'double') st.doubleUntil = Math.max(performance.now(), st.doubleUntil) + 20000;
    else if (id === 'gold') { st.goldUntil = Math.max(performance.now(), st.goldUntil) + 15000; floatText(scoreEl, '🌟 ×3', 'w'); }
    else if (id === 'combo') { st.combo += 10; st.maxCombo = Math.max(st.maxCombo, st.combo); comboPop(); }
    else if (id === 'shield') { if (st.shield) { ok = false; msg = '방패는 이미 켜져 있어요'; } else st.shield = true; }
    else ok = ctx.activeWrite ? ctx.activeWrite.item(id) : !!inst?.onItem?.(id);
    if (!ok) { S.refundItem(id); toast(msg); updateItems(); return; }
    sfx.item();
    burst(btn, 12);
    btn.classList.remove('used'); void btn.offsetWidth; btn.classList.add('used');
    updateItems();
    renderBadges(true);
  }

  // ── 게임에 넘겨주는 도구 ──
  const ctx = {
    stage, words, timer, award, miss, penalty, bonus, st,
    end: (r) => end(r),
    onTick(f) { tickers.add(f); return () => tickers.delete(f); },
    get ended() { return st.ended; },
    activeWrite: null,
  };
  let inst = null;

  async function end(reason = '⏰ 시간 끝!') {
    if (st.ended) return;
    st.ended = true;
    ctx.activeWrite?.close();
    try { inst?.destroy?.(); } catch {}
    const coins = st.score > 0 ? Math.max(1, Math.round(st.score / 5)) : 0;
    if (coins) S.addCoins(coins);
    const best = S.recordGame(game.id, st.score);
    if (st.score > 0) S.pushFeed({ name: S.me.data.name, num: S.me.num, game: game.title, emoji: game.emoji, score: st.score, best });
    await sleep(250);
    showResult(reason, coins, best);
  }

  function showResult(reason, coins, best) {
    const tries = st.correct + st.wrong;
    const acc = tries ? Math.round((st.correct / tries) * 100) : 0;
    const r = h(`<div class="result-wrap"><div class="result pop-in">
      <div class="r-reason">${esc(reason)}</div>
      <div class="r-emoji">${game.emoji}</div>
      ${best ? '<div class="r-best">🏆 내 최고 기록!</div>' : ''}
      <div class="r-score" data-v="0">0</div><div class="r-unit">점</div>
      <div class="r-grid">
        <div><b>${st.correct}</b><small>맞힘</small></div>
        <div class="${acc < 70 ? 'low' : ''}"><b>${acc}%</b><small>정확도</small></div>
        <div class="w"><b>${st.writing}</b><small>✍️ 쓰기 성공</small></div>
        <div class="c"><b>+${coins}</b><small>🪙 코인</small></div>
      </div>
      <div class="quick">
        <div class="quick-h">⚡ 다음 판 준비 <span>내 코인 🪙 <b class="qc">${S.me.data.coins}</b></span></div>
        <div class="quick-row">${QUICK_ITEMS.map((id) => `<button class="qbuy" data-id="${id}"><span>${ITEMS[id].emoji}</span><b>${esc(ITEMS[id].name)}</b><small>가진 것 <i data-own="${id}">${S.me.data.items[id] || 0}</i></small><em>🪙 ${ITEMS[id].price}</em></button>`).join('')}</div>
        <button class="btn ghost more-shop">🛒 상점 · 🎁 행운 상자 · 꾸미기</button>
      </div>
      <div class="r-btns"><button class="btn big primary again">🔁 한 판 더</button><button class="btn big ghost back">🏠 대기실로</button></div>
    </div></div>`);
    el.append(r);
    countUp(r.querySelector('.r-score'), st.score, 900);
    if (st.score > 0) { sfx.win(); if (best) confetti(); }
    const refresh = () => {
      r.querySelector('.qc').textContent = S.me.data.coins;
      r.querySelectorAll('.qbuy').forEach((b) => {
        const id = b.dataset.id;
        b.querySelector('[data-own]').textContent = S.me.data.items[id] || 0;
        b.classList.toggle('poor', S.me.data.coins < ITEMS[id].price);
      });
    };
    refresh();
    r.querySelectorAll('.qbuy').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const id = b.dataset.id;
      if (S.buy(id, ITEMS[id].price)) { sfx.coin(); burst(b, 12); b.classList.remove('used'); void b.offsetWidth; b.classList.add('used'); }
      else { shake(b); toast('코인이 부족해요'); }
      refresh();
    }));
    r.querySelector('.more-shop').onclick = () => onShop?.(refresh);
    r.querySelector('.again').onclick = () => onExit(true);
    r.querySelector('.back').onclick = () => onExit(false);
  }

  q('.g-quit').onclick = () => { if (st.started && !st.ended) end('그만했어요'); else if (!st.started) { stopped = true; onExit(false); } };

  let stopped = false;
  (async () => {
    const c = h('<div class="countdown"></div>');
    el.append(c);
    for (const t of ['3', '2', '1', 'GO!']) {
      if (stopped) return;
      c.textContent = t;
      c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
      t === 'GO!' ? sfx.go() : sfx.tick();
      await sleep(t === 'GO!' ? 420 : 560);
    }
    c.remove();
    if (stopped) return;
    st.started = true;
    inst = game.start(ctx) || {};
  })();

  return {
    destroy() {
      stopped = true;
      st.ended = true;
      cancelAnimationFrame(raf);
      ctx.activeWrite?.close();
      try { inst?.destroy?.(); } catch {}
    },
  };
}
