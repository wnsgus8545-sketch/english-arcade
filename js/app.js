// 학생 화면 — 입장 · 대기실(게임 고르기·순위·소식) · 상점
import * as S from './store.js';
import { GAMES } from './games/index.js';
import { ITEMS, COSMETICS, LUCKY_PRICE } from './items.js';
import { DEFAULT_WORDS } from './words.js';
import { h, esc, countUp, pick, sleep } from './util.js';
import { avaOf, nameHtml } from './look.js';
import { sfx } from './sfx.js';
import { toast, burst, shake, confetti } from './fx.js';
import { runGame } from './runner.js';

const app = document.getElementById('app');
let words = DEFAULT_WORDS, customWords = false, players = [], feed = [], event = null;
let subs = [], game = null, eventTimer = 0;
const getEvent = () => event;

boot();

async function boot() {
  try {
    await S.init();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="loading">서버에 연결하지 못했어요 😢<br><small>인터넷 연결을 확인하고 새로고침(F5) 해 주세요</small></div>`;
    return;
  }
  const ses = JSON.parse(localStorage.getItem('ea_session') || 'null');
  const qcode = new URLSearchParams(location.search).get('code');
  if (ses && (!qcode || qcode.toUpperCase() === ses.code)) {
    try { await S.join(ses.code, ses.num, ses.name); return enterHub(); } catch {}
  }
  showLogin(qcode || ses?.code || '');
}

// ── 입장 ─────────────────────────────────────────────
function showLogin(code = '') {
  stopSubs();
  const demo = !S.ONLINE;
  const v = h(`<div class="login">
    <div class="logo"><span class="l1">ENGLISH</span><span class="l2">ARCADE</span><div class="logo-sub">🎮 우리 반 영어 오락실</div></div>
    ${demo ? '<div class="note">🧪 체험 모드 — 이 컴퓨터에만 저장돼요. 반 코드는 <b>DEMO</b></div>' : ''}
    <form class="card login-card">
      <label>반 코드<input name="code" maxlength="8" placeholder="선생님이 알려 준 코드" value="${esc(code || (demo ? 'DEMO' : ''))}" required autocomplete="off" autocapitalize="characters"></label>
      <div class="row">
        <label class="num">번호<input name="num" type="number" min="1" max="99" required inputmode="numeric" placeholder="7"></label>
        <label class="grow">닉네임<input name="name" maxlength="8" required placeholder="8글자까지" autocomplete="off"></label>
      </div>
      <button class="btn big primary">입장하기 ▶</button>
      <div class="err"></div>
    </form>
    <div class="marquee"><div>${GAMES.map((g) => `${g.emoji} ${g.title}`).join(' · ')} · ${GAMES.map((g) => `${g.emoji} ${g.title}`).join(' · ')}</div></div>
  </div>`);
  app.replaceChildren(v);
  const f = v.querySelector('form'), err = v.querySelector('.err');
  if (code) setTimeout(() => f.num.focus(), 50); // QR로 들어오면 반 코드는 채워져 있으니 번호부터
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    sfx.click();
    const c = f.code.value.trim().toUpperCase(), n = +f.num.value, name = f.name.value.trim();
    if (!c || !(n >= 1 && n <= 99) || !name) { err.textContent = '세 칸을 모두 채워 주세요'; return; }
    const btn = f.querySelector('button');
    btn.disabled = true; btn.textContent = '들어가는 중…';
    try {
      await S.join(c, n, name);
      enterHub();
    } catch (ex) {
      btn.disabled = false; btn.textContent = '입장하기 ▶';
      shake(f);
      err.textContent =
        ex.message === 'NO_CLASS' ? '없는 반 코드예요. 선생님께 다시 확인해 주세요.'
        : ex.message === 'TAKEN' ? '그 번호는 다른 기기에서 쓰고 있어요. 선생님께 «자리 비우기»를 부탁하세요.'
        : '들어가지 못했어요. 잠시 뒤 다시 눌러 주세요.';
      console.error(ex);
    }
  });
}

// ── 대기실 ───────────────────────────────────────────
function stopSubs() { subs.forEach((f) => f()); subs = []; clearInterval(eventTimer); }

function enterHub() {
  stopSubs();
  const c = S.me.code;
  showHub();
  subs.push(S.subWords(c, (w, custom) => { words = w; customWords = custom; renderWordNote(); }));
  subs.push(S.subPlayers(c, (p) => { players = p; renderBoard(); }));
  subs.push(S.subFeed(c, (f) => { feed = f; renderFeed(); }));
  subs.push(S.subEvent(c, (e) => { event = e; renderEvent(); }));
  subs.push(S.subMine(() => { toast('선생님이 자리를 비웠어요. 다시 입장해 주세요.'); logout(false); }));
  subs.push(S.onMe(renderMe));
  eventTimer = setInterval(renderEvent, 1000);
}

function showHub() {
  const me = S.me;
  const v = h(`<div class="hub">
    <header class="topbar">
      <div class="me-box"><span class="ava"></span><div><b class="me-name"></b><small>${esc(me.className || me.code)} · ${me.num}번</small></div></div>
      <div class="stats">
        <div class="stat score"><small>총점</small><b id="meScore">0</b></div>
        <div class="stat coin"><small>🪙 코인</small><b id="meCoins">0</b></div>
      </div>
      <div class="actions">
        <button class="btn shop-btn">🛒 상점</button>
        <button class="btn ghost icon mute" title="소리">${sfx.isMuted() ? '🔇' : '🔊'}</button>
        <button class="btn ghost icon out" title="나가기">🚪</button>
      </div>
    </header>
    <div class="event-banner hidden"></div>
    <div class="inv"></div>
    <div class="hub-main">
      <section class="games">
        <h2>오늘은 뭐 할까? <small>✍️ 쓰기 문제는 언제나 <b>점수 2배</b> · 5콤보마다 배수 UP</small></h2>
        <div class="game-grid"></div>
        <div class="word-note"></div>
      </section>
      <aside class="side">
        <div class="panel"><h3>🏆 실시간 순위</h3><ol class="board"></ol></div>
        <div class="panel"><h3>📣 우리 반 소식</h3><ul class="feed"></ul></div>
      </aside>
    </div>
  </div>`);
  app.replaceChildren(v);
  renderGames();
  v.querySelector('.shop-btn').onclick = openShop;
  v.querySelector('.inv').onclick = openShop;
  v.querySelector('.mute').onclick = (e) => { e.currentTarget.textContent = sfx.toggle() ? '🔇' : '🔊'; };
  v.querySelector('.out').onclick = () => { if (confirm('나갈까요? (점수는 저장돼 있어요)')) logout(); };
  renderMe(me.data);
}

function renderGames() {
  const grid = app.querySelector('.game-grid');
  if (!grid) return;
  grid.innerHTML = GAMES.map((g) => `<button class="gcard" style="--c:${g.color}" data-id="${g.id}">
      ${g.isNew ? '<span class="ribbon">NEW</span>' : ''}
      <div class="gicon">${g.emoji}</div>
      <div class="gtitle">${esc(g.title)}</div>
      <div class="gdesc">${esc(g.desc)}</div>
      <div class="gfoot"><span class="gtags">${g.tags.map((t) => `<i class="${t.startsWith('✍️') ? 'w' : ''}">${esc(t)}</i>`).join('')}</span><span class="gtime">⏱ ${g.time}초</span></div>
      <div class="gbest">내 최고 <b>${(S.me.data.best[g.id] || 0).toLocaleString()}</b></div>
    </button>`).join('');
  grid.querySelectorAll('.gcard').forEach((b) => (b.onclick = () => playGame(GAMES.find((g) => g.id === b.dataset.id))));
}

function renderWordNote() {
  const n = app.querySelector('.word-note');
  if (n) n.textContent = customWords ? `📚 선생님이 넣은 단어 ${words.length}개로 문제가 나와요` : `📚 기본 단어 ${words.length}개로 문제가 나와요`;
}

function renderMe(d) {
  if (!d) return;
  const sc = document.getElementById('meScore'), co = document.getElementById('meCoins');
  if (sc) countUp(sc, d.score);
  if (co) countUp(co, d.coins);
  const inv = app.querySelector('.inv');
  if (inv) inv.innerHTML = '<span>내 아이템</span>' + Object.entries(ITEMS).map(([id, it]) => `<b class="${d.items[id] ? '' : 'zero'}">${it.emoji} ${d.items[id] || 0}</b>`).join('') + '<em>＋ 사러 가기</em>';
  const me = { ...d, num: S.me.num };
  const ava = app.querySelector('.me-box .ava'), nm = app.querySelector('.me-box .me-name');
  if (ava) ava.textContent = avaOf(me);
  if (nm) nm.innerHTML = nameHtml(me);
  // 살 수 있는 게 생기면 상점 버튼이 반짝인다
  const sb = app.querySelector('.shop-btn');
  if (sb) {
    const cheapCos = Math.min(...Object.entries(COSMETICS).flatMap(([k, g]) => Object.entries(g.list).filter(([id]) => !S.ownsCos(k, id)).map(([, c]) => c.price)));
    const can = d.coins >= LUCKY_PRICE;
    sb.classList.toggle('glow', can);
    sb.innerHTML = can ? `🛒 상점 <span class="sb-tip">${d.coins >= cheapCos ? '꾸미기 살 수 있어요!' : '🎁 행운 상자!'}</span>` : '🛒 상점';
  }
  if (!game) app.querySelectorAll('.gcard').forEach((b) => { const v = b.querySelector('.gbest b'); if (v) v.textContent = (d.best[b.dataset.id] || 0).toLocaleString(); });
}

function renderBoard() {
  const ol = app.querySelector('.board');
  if (!ol) return;
  const sorted = [...players].sort((a, b) => b.score - a.score || a.num - b.num);
  if (!sorted.length) { ol.innerHTML = '<li class="empty">아직 아무도 없어요</li>'; return; }
  const before = new Map([...ol.children].map((li) => [li.dataset.k, li.getBoundingClientRect().top]));
  const lis = sorted.map((p, i) => {
    let li = ol.querySelector(`li[data-k="${p.num}"]`) || h(`<li data-k="${p.num}"></li>`);
    li.className = (p.num === S.me.num ? 'me ' : '') + (i < 3 ? 'top' + (i + 1) : '');
    li.innerHTML = `<span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="ava">${avaOf(p)}</span><span class="nm">${nameHtml(p)}</span><b class="sc">${(p.score || 0).toLocaleString()}</b>`;
    return li;
  });
  ol.replaceChildren(...lis);
  lis.forEach((li) => {
    const t = before.get(li.dataset.k);
    if (t == null) return;
    const d = t - li.getBoundingClientRect().top;
    if (Math.abs(d) > 1) li.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`;
}
function renderFeed() {
  const ul = app.querySelector('.feed');
  if (!ul) return;
  ul.innerHTML = feed.length
    ? feed.map((f) => f.kind === 'lucky'
      ? `<li class="lucky"><span class="fe">🎁</span><span><b>${esc(f.name)}</b> 행운 상자에서 <b class="fs">${esc(f.game)}</b> 뽑음!</span><small>${ago(f.ts)}</small></li>`
      : `<li><span class="fe">${f.emoji || '🎮'}</span><span><b>${esc(f.name)}</b> ${esc(f.game)} <b class="fs">${(+f.score).toLocaleString()}점</b>${f.best ? ' 🏆' : ''}</span><small>${ago(f.ts)}</small></li>`).join('')
    : '<li class="empty">첫 기록의 주인공이 되어 보세요!</li>';
}

function renderEvent() {
  const b = app.querySelector('.event-banner');
  if (!b) return;
  const left = event && event.type === 'double' ? Math.ceil((event.until - S.now()) / 1000) : 0;
  if (left > 0) {
    b.classList.remove('hidden');
    b.innerHTML = `⚡ 선생님의 <b>2배 타임!</b> 지금 얻는 점수가 모두 2배 <span>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>`;
  } else b.classList.add('hidden');
}

// ── 게임 ─────────────────────────────────────────────
function playGame(g) {
  sfx.click();
  const holder = h('<div class="game-holder"></div>');
  document.body.append(holder);
  document.body.classList.add('in-game');
  game = runGame(g, {
    root: holder, words, getEvent,
    onShop: (after) => openShop(after),
    onExit(again) {
      game?.destroy();
      holder.remove();
      document.body.classList.remove('in-game');
      game = null;
      renderMe(S.me.data);
      if (again) playGame(g);
    },
  });
}

// ── 상점 ─────────────────────────────────────────────
// 행운 상자 — 무엇이 나올지 모른다 (꾸미기는 갖고 있지 않은 것만 나온다)
function rollLucky() {
  const unowned = (rare) => Object.entries(COSMETICS).flatMap(([k, g]) =>
    Object.entries(g.list).filter(([id, c]) => !!c.rare === rare && !S.ownsCos(k, id)).map(([id, c]) => ({ k, id, c })));
  const r = Math.random();
  if (r < 0.05) { const l = unowned(true); if (l.length) return { type: 'cos', ...pick(l), rare: true }; }
  if (r < 0.2) { const l = unowned(false); if (l.length) return { type: 'cos', ...pick(l) }; }
  if (r < 0.25) return { type: 'coins', n: 150, jackpot: true };
  if (r < 0.55) return { type: 'coins', n: 15 + Math.floor(Math.random() * 12) * 5 };
  const pool = ['gold', 'gold', 'combo', 'combo', 'double', 'double', 'time', 'shield', 'hint', 'skip'];
  const n = 2 + (Math.random() < 0.4 ? 1 : 0);
  return { type: 'items', list: Array.from({ length: n }, () => pick(pool)) };
}

function openShop(after) {
  sfx.click();
  const m = h(`<div class="modal"><div class="sheet pop-in">
    <header><h2>🛒 상점</h2><div class="coins">🪙 <b>0</b></div><button class="btn ghost icon x">✕</button></header>
    <nav class="tabs"><button data-t="items" class="on">⚔️ 게임 아이템</button><button data-t="lucky">🎁 행운 상자</button><button data-t="cos">✨ 꾸미기</button></nav>
    <section data-p="items">
      <div class="shop-grid">${Object.entries(ITEMS).map(([id, it]) => `<div class="shop-item ${it.hot ? 'hot' : ''}">
        ${it.hot ? '<span class="ribbon">NEW</span>' : ''}
        <div class="si-e">${it.emoji}</div><b>${esc(it.name)}</b><p>${esc(it.desc)}</p>
        <div class="si-own">가진 개수 <b data-own="${id}">0</b></div>
        <button class="btn primary buy" data-id="${id}">🪙 ${it.price}</button></div>`).join('')}</div>
      <p class="shop-tip">💡 판이 끝나면 결과 화면에서도 바로 살 수 있어요. 🌟황금 + 🔥콤보를 같이 쓰면 점수가 폭발해요!</p>
    </section>
    <section data-p="lucky" class="hidden">
      <div class="lucky-box">
        <div class="lb-gift">🎁</div>
        <div class="lb-odds">아이템 2~3개 · 코인 · <b>꾸미기</b> · ✨희귀 꾸미기 · 💰잭팟 150코인</div>
        <button class="btn big primary open-lucky">🎁 열기 · 🪙 ${LUCKY_PRICE}</button>
        <div class="lb-result"></div>
      </div>
    </section>
    <section data-p="cos" class="hidden">
      <div class="cos-preview"></div>
      ${Object.entries(COSMETICS).map(([k, g]) => `<h3 class="cos-h">${g.label}</h3><div class="cos-grid">${Object.entries(g.list).map(([id, c]) => `
        <button class="cos-item ${c.rare ? 'rare' : ''}" data-k="${k}" data-id="${id}">
          <div class="ci-v">${k === 'avatar' ? c.v : k === 'fx' ? `<span class="pname ${c.v}">이름</span>` : `<small class="ptitle">${esc(c.v)}</small>`}</div>
          <b>${esc(c.name)}</b><em></em></button>`).join('')}</div>`).join('')}
      <p class="shop-tip">꾸미기는 한 번 사면 계속 내 것이에요. <b>순위표와 TV 화면</b>에 그대로 보여요. 산 것을 다시 누르면 끼웠다 뺐다 해요.</p>
    </section>
  </div></div>`);
  document.body.append(m);
  const tabs = m.querySelectorAll('.tabs button');
  tabs.forEach((t) => (t.onclick = () => {
    sfx.click();
    tabs.forEach((x) => x.classList.toggle('on', x === t));
    m.querySelectorAll('section[data-p]').forEach((p) => p.classList.toggle('hidden', p.dataset.p !== t.dataset.t));
  }));

  const upd = (d) => {
    countUp(m.querySelector('.coins b'), d.coins, 300);
    for (const [id, it] of Object.entries(ITEMS)) {
      m.querySelector(`[data-own="${id}"]`).textContent = d.items[id] || 0;
      m.querySelector(`.buy[data-id="${id}"]`).classList.toggle('poor', d.coins < it.price);
    }
    m.querySelector('.open-lucky').classList.toggle('poor', d.coins < LUCKY_PRICE);
    m.querySelectorAll('.cos-item').forEach((b) => {
      const { k, id } = b.dataset, c = COSMETICS[k].list[id];
      const own = S.ownsCos(k, id), on = d.cos[k] === id;
      b.classList.toggle('own', own);
      b.classList.toggle('on', on);
      b.classList.toggle('poor', !own && d.coins < c.price);
      b.querySelector('em').textContent = on ? '✅ 끼는 중' : own ? '끼기' : `🪙 ${c.price}`;
    });
    m.querySelector('.cos-preview').innerHTML = `<span class="ava">${avaOf({ ...d, num: S.me.num })}</span><span class="nm">${nameHtml(d)}</span><small>순위표에 이렇게 보여요</small>`;
  };
  const off = S.onMe(upd);
  const close = () => { off(); m.remove(); if (typeof after === 'function') after(); };
  m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
  m.querySelector('.x').onclick = close;

  m.querySelectorAll('.buy').forEach((b) => (b.onclick = () => {
    const id = b.dataset.id;
    if (S.buy(id, ITEMS[id].price)) { sfx.coin(); burst(b, 12); toast(`${ITEMS[id].emoji} ${ITEMS[id].name} 샀어요!`, 'good'); }
    else { shake(b); toast('코인이 부족해요. 게임을 해서 모아 보세요!'); }
  }));

  m.querySelectorAll('.cos-item').forEach((b) => (b.onclick = () => {
    const { k, id } = b.dataset, c = COSMETICS[k].list[id];
    if (S.ownsCos(k, id)) { S.equipCos(k, id); sfx.click(); return; }
    if (S.buyCos(k, id, c.price)) { sfx.win(); burst(b, 20); toast(`✨ ${c.name} 획득! 바로 꼈어요`, 'good'); }
    else { shake(b); toast(`코인이 ${c.price - S.me.data.coins}개 더 필요해요`); }
  }));

  let opening = false;
  const lb = m.querySelector('.lucky-box'), res = m.querySelector('.lb-result');
  m.querySelector('.open-lucky').onclick = async (e) => {
    if (opening) return;
    if (!S.spend(LUCKY_PRICE)) { shake(e.currentTarget); toast('코인이 부족해요'); return; }
    opening = true;
    res.innerHTML = '';
    lb.classList.add('shaking');
    for (let i = 0; i < 5; i++) { sfx.tick(); await sleep(200); }
    lb.classList.remove('shaking');
    const p = rollLucky();
    let html = '', big = false;
    if (p.type === 'cos') {
      S.grantCos(p.k, p.id); S.equipCos(p.k, p.id);
      const shown = p.k === 'avatar' ? p.c.v : p.k === 'fx' ? `<span class="pname ${p.c.v}">${esc(S.me.data.name)}</span>` : `<small class="ptitle">${esc(p.c.v)}</small>`;
      html = `<div class="lb-prize ${p.rare ? 'rare' : ''}"><div class="lp-v">${shown}</div><b>${p.rare ? '✨ 희귀! ' : ''}${esc(p.c.name)}</b><small>꾸미기 획득 · 바로 꼈어요</small></div>`;
      big = true;
      S.pushFeed({ kind: 'lucky', name: S.me.data.name, num: S.me.num, game: `${p.rare ? '✨희귀 ' : ''}${p.c.name}`, score: 0 });
    } else if (p.type === 'coins') {
      S.addCoins(p.n);
      html = `<div class="lb-prize ${p.jackpot ? 'rare' : ''}"><div class="lp-v">${p.jackpot ? '💰' : '🪙'}</div><b>${p.jackpot ? '잭팟! ' : ''}코인 ${p.n}개</b></div>`;
      big = !!p.jackpot;
      if (p.jackpot) S.pushFeed({ kind: 'lucky', name: S.me.data.name, num: S.me.num, game: '💰 잭팟 150코인', score: 0 });
    } else {
      p.list.forEach((id) => S.giveItem(id));
      html = `<div class="lb-prize"><div class="lp-v">${p.list.map((id) => ITEMS[id].emoji).join(' ')}</div><b>${p.list.map((id) => ITEMS[id].name).join(' · ')}</b><small>아이템 ${p.list.length}개 획득</small></div>`;
    }
    res.innerHTML = html;
    big ? (sfx.win(), confetti(90)) : sfx.coin();
    burst(res, 18);
    opening = false;
  };
}

function logout(save = true) {
  game?.destroy();
  document.querySelector('.game-holder')?.remove();
  document.body.classList.remove('in-game');
  game = null;
  const code = S.me.code;
  stopSubs();
  S.leave(save);
  showLogin(code || '');
}
