// 선생님 화면 — 반 만들기 · 단어 넣기 · 실시간 순위 · 2배 타임 · 점수 초기화
import * as S from './store.js';
import { DEFAULT_WORDS } from './words.js';
import { h, esc } from './util.js';
import { avaOf, nameHtml } from './look.js';
import { toast } from './fx.js';

const app = document.getElementById('app');
let classes = [], cur = null, players = [], event = null, subs = [], clsSub = null, tick = 0;

boot();
async function boot() {
  try { await S.init({ teacher: true }); }
  catch (e) { console.error(e); app.innerHTML = '<div class="loading">서버에 연결하지 못했어요 😢<br><small>firebase-config.js 값을 확인해 주세요</small></div>'; return; }
  if (!S.isTeacherSignedIn()) return showLogin();
  showMain();
}

function showLogin() {
  app.replaceChildren(h(`<div class="t-login">
    <div class="logo"><span class="l1">ENGLISH</span><span class="l2">ARCADE</span><div class="logo-sub">🧑‍🏫 선생님 화면</div></div>
    <button class="btn big primary">G 구글 계정으로 로그인</button>
    <p style="color:var(--muted)">학생들은 로그인 없이 반 코드로 들어와요. 선생님만 로그인합니다.</p>
  </div>`));
  app.querySelector('button').onclick = async () => {
    try { await S.teacherLogin(); showMain(); }
    catch (e) {
      console.error(e);
      toast('로그인하지 못했어요 (' + (e.code || e.message) + '). 팝업 차단을 풀고 다시 눌러 주세요.');
    }
  };
}

function showMain() {
  app.replaceChildren(h(`<div class="t-wrap">
    <div class="t-head"><h1>🧑‍🏫 선생님 화면</h1>
      ${S.ONLINE ? '' : '<span class="note">🧪 체험 모드 — 이 컴퓨터에만 저장돼요</span>'}
      <span class="who">${esc(S.teacherEmail())}</span>
      ${S.ONLINE ? '<button class="btn ghost logout">로그아웃</button>' : ''}
    </div>
    <div class="t-classes"></div>
    <div class="t-body"></div>
  </div>`));
  app.querySelector('.logout')?.addEventListener('click', async () => { await S.teacherLogout(); location.reload(); });
  clsSub?.();
  clsSub = S.subMyClasses((list) => {
    classes = list;
    if (!cur && list.length) cur = list[0].code;
    renderClasses();
    if (cur && !app.querySelector('.t-grid')) openClass(cur);
    if (!list.length) renderEmpty();
  });
}

function renderClasses() {
  const box = app.querySelector('.t-classes');
  box.innerHTML = classes.map((c) => `<button class="t-chip ${c.code === cur ? 'on' : ''}" data-c="${c.code}">${esc(c.name)}<code>${c.code}</code></button>`).join('')
    + '<button class="btn gold add">＋ 새 반 만들기</button>';
  box.querySelectorAll('.t-chip').forEach((b) => (b.onclick = () => { cur = b.dataset.c; renderClasses(); openClass(cur); }));
  box.querySelector('.add').onclick = async () => {
    const name = prompt('반 이름을 적어 주세요 (예: 1학년 3반)');
    if (!name || !name.trim()) return;
    try { cur = await S.createClass(name.trim().slice(0, 20)); toast(`반을 만들었어요 · 코드 ${cur}`, 'good'); openClass(cur); }
    catch (e) { console.error(e); toast('반을 만들지 못했어요: ' + e.message); }
  };
}

function renderEmpty() {
  app.querySelector('.t-body').innerHTML = '<div class="t-box" style="text-align:center"><h2>먼저 반을 하나 만들어 주세요 👆</h2><p>위의 «＋ 새 반 만들기» 를 누르면 학생들이 들어올 반 코드가 생겨요.</p></div>';
}

/** 주소를 QR 코드(SVG)로 — 휴대폰 카메라로 찍으면 반 코드까지 채워진 입장 화면이 열린다 */
function qrSvg(text) {
  if (!window.qrcode) return '<div class="qr-fail">QR을 불러오지 못했어요<br>(인터넷 연결 확인)</div>';
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

function openQR(code, link) {
  const p = h(`<div class="qr-full"><button class="btn close">✕ 닫기</button>
    <div class="qr-title">📱 휴대폰 카메라로 찍어서 들어오세요</div>
    <div class="qr-big">${qrSvg(link)}</div>
    <div class="qr-code-line">반 코드 <b>${code}</b></div>
    <div class="qr-url">${esc(link)}</div></div>`);
  document.body.append(p);
  p.querySelector('.close').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); p.remove(); };
  p.requestFullscreen?.().catch(() => {});
}

const toText = (list) => list.map((w) => [w.en, w.ko, w.ex].filter(Boolean).join(' | ')).join('\n');
function parseWords(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.includes('\t') ? l.split('\t') : l.split('|');
    const w = { en: (p[0] || '').trim(), ko: (p[1] || '').trim() };
    const ex = p.slice(2).join(' ').trim();
    if (ex) w.ex = ex;
    return w;
  }).filter((w) => w.en && w.ko);
}

async function openClass(code) {
  subs.forEach((f) => f()); subs = []; clearInterval(tick);
  const cls = classes.find((c) => c.code === code) || { code, name: code };
  const link = new URL('index.html?code=' + code, location.href).href;
  const body = app.querySelector('.t-body');
  body.replaceChildren(h(`<div class="t-grid">
    <div style="display:grid;gap:16px">
      <div class="t-box">
        <h2>📮 학생 입장 안내</h2>
        <div class="t-entry">
          <button class="qr-small" title="크게 보기">${qrSvg(link)}</button>
          <div class="t-entry-r">
            <div class="t-code">${code}</div>
            <div class="t-row"><button class="btn gold qr">📱 QR 크게 띄우기</button><button class="btn gold proj">📺 전체 화면 순위</button></div>
          </div>
        </div>
        <div class="t-link"><input readonly value="${esc(link)}"><button class="btn copy">복사</button></div>
        <p>학생은 QR을 찍거나 주소로 들어와 <b>번호 · 닉네임</b>만 넣으면 돼요 (반 코드는 자동으로 채워져요). 실명 대신 닉네임을 쓰게 해 주세요.</p>
      </div>
      <div class="t-box">
        <h2>📚 단어 목록</h2>
        <p>한 줄에 하나씩 <b>영어 | 뜻 | 예문</b> 으로 적어요. 예문은 없어도 되지만, 있어야 🧩문장 퍼즐과 ✍️빈칸 쓰기가 나와요.<br>
        엑셀·구글시트에서 세 칸을 그대로 복사해 붙여넣어도 됩니다. 8개 이상이어야 적용돼요 (적으면 기본 단어가 나와요).</p>
        <textarea class="t-words" spellcheck="false" placeholder="favor | 부탁 | Can you do me a favor?"></textarea>
        <div class="t-row"><button class="btn primary save">💾 저장 (학생 화면에 바로 반영)</button><button class="btn ghost def">기본 단어 불러오기</button><span class="wcount" style="color:var(--muted)"></span></div>
      </div>
    </div>
    <div style="display:grid;gap:16px">
      <div class="t-box">
        <h2>⚡ 2배 타임</h2>
        <p>켜는 순간 반 전체 학생 화면에 배너가 뜨고, 그동안 얻는 점수가 모두 2배예요. 수업 마무리 5분에 쓰면 좋아요.</p>
        <div class="t-row"><button class="btn gold ev" data-m="3">⚡ 3분</button><button class="btn gold ev" data-m="5">⚡ 5분</button><button class="btn ghost ev" data-m="0">끄기</button><span class="evs" style="font-weight:700"></span></div>
      </div>
      <div class="t-box">
        <div class="t-row"><h2>🏆 실시간 순위</h2><span class="pc" style="color:var(--muted)"></span><button class="btn warn mini resetAll" style="margin-left:auto">전체 점수 0으로</button></div>
        <table class="t-table"><thead><tr><th>#</th><th>번호</th><th>닉네임</th><th>점수</th><th>코인</th><th>판수</th><th></th></tr></thead><tbody></tbody></table>
        <p>«자리 비우기»는 학생이 기기를 바꿨거나 번호를 잘못 넣었을 때 눌러요 (그 학생 점수도 지워져요).</p>
      </div>
    </div>
  </div>`));

  const ta = body.querySelector('.t-words'), wc = body.querySelector('.wcount');
  const updCount = () => { const n = parseWords(ta.value).length; wc.textContent = `${n}개${n < 8 ? ' · 8개 이상 필요' : ''}`; };
  ta.addEventListener('input', updCount);
  const saved = await S.getWords(code);
  ta.value = toText(saved);
  updCount();
  body.querySelector('.copy').onclick = () => { navigator.clipboard.writeText(link); toast('주소를 복사했어요', 'good'); };
  body.querySelector('.def').onclick = () => { ta.value = toText(DEFAULT_WORDS); updCount(); };
  body.querySelector('.save').onclick = async () => {
    const list = parseWords(ta.value);
    if (list.length && list.length < 8) return toast('8개 이상 넣어 주세요 (지금 ' + list.length + '개)');
    try { await S.saveWords(code, list); toast(`단어 ${list.length}개 저장 · 학생 화면에 바로 반영돼요`, 'good'); }
    catch (e) { console.error(e); toast('저장하지 못했어요'); }
  };
  body.querySelectorAll('.ev').forEach((b) => (b.onclick = async () => { await S.setEvent(code, +b.dataset.m); toast(+b.dataset.m ? `⚡ 2배 타임 ${b.dataset.m}분 시작!` : '2배 타임을 껐어요', 'good'); }));
  body.querySelector('.resetAll').onclick = async () => {
    if (!confirm(`${cls.name} 학생 전체 점수를 0으로 만들까요? (코인·아이템은 그대로)`)) return;
    await S.resetScores(code); toast('전체 점수를 0으로 만들었어요', 'good');
  };
  body.querySelector('.proj').onclick = () => openProjector(code, link);
  body.querySelector('.qr').onclick = () => openQR(code, link);
  body.querySelector('.qr-small').onclick = () => openQR(code, link);

  const tbody = body.querySelector('tbody'), pc = body.querySelector('.pc');
  subs.push(S.subPlayers(code, (p) => {
    players = p;
    const sorted = [...p].sort((a, b) => b.score - a.score || a.num - b.num);
    pc.textContent = `${p.length}명`;
    tbody.innerHTML = sorted.map((s, i) => `<tr><td>${i + 1}</td><td class="n">${s.num}</td><td>${avaOf(s)} ${nameHtml(s)}</td><td class="n">${(s.score || 0).toLocaleString()}</td><td>${s.coins || 0}</td><td>${s.plays || 0}</td>
      <td style="white-space:nowrap"><button class="btn mini gift" data-n="${s.num}" title="코인 30개 주기">🪙+30</button> <button class="btn mini warn kick" data-n="${s.num}">자리 비우기</button></td></tr>`).join('')
      || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">아직 들어온 학생이 없어요</td></tr>';
    tbody.querySelectorAll('.kick').forEach((b) => (b.onclick = async () => { if (confirm(`${b.dataset.n}번 자리를 비울까요?`)) { await S.removePlayer(code, b.dataset.n); toast('자리를 비웠어요'); } }));
    tbody.querySelectorAll('.gift').forEach((b) => (b.onclick = async () => { await S.giveCoins(code, b.dataset.n, 30); toast(`${b.dataset.n}번에게 코인 30개!`, 'good'); }));
    renderProjector();
  }));
  const evs = body.querySelector('.evs');
  const renderEv = () => { const left = event?.until ? Math.ceil((event.until - S.now()) / 1000) : 0; evs.textContent = left > 0 ? `진행 중 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''; };
  subs.push(S.subEvent(code, (e) => { event = e; renderEv(); }));
  tick = setInterval(renderEv, 1000);
}

function openProjector(code, link) {
  const p = h(`<div class="projector"><button class="btn close">✕ 닫기</button>
    <header><div class="pqr">${qrSvg(link)}</div><div><div class="plink">📱 QR을 찍거나 반 코드를 넣으세요</div><div class="pcode">${code}</div><div class="plink">${esc(link)}</div></div></header>
    <ol class="board"></ol></div>`);
  document.body.append(p);
  p.querySelector('.close').onclick = () => p.remove();
  p.requestFullscreen?.().catch(() => {});
  renderProjector();
}
function renderProjector() {
  const ol = document.querySelector('.projector .board');
  if (!ol) return;
  const sorted = [...players].sort((a, b) => b.score - a.score || a.num - b.num);
  ol.innerHTML = sorted.map((s, i) => `<li class="${i < 3 ? 'top' + (i + 1) : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="ava">${avaOf(s)}</span><span class="nm">${nameHtml(s)}</span><b class="sc">${(s.score || 0).toLocaleString()}</b></li>`).join('');
}
