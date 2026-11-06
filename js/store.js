// ─────────────────────────────────────────────────────────────
//  저장 계층 — Firebase 실시간 DB, 또는 (설정이 비어 있으면) 이 브라우저 안 저장소
//
//  ⚡ 속도 핵심: 점수·코인·아이템은 «내 화면 값» 을 먼저 바꾸고,
//     서버 저장은 0.35초 모아서 뒤에서 보낸다. 서버 응답을 기다리는 화면은 없다.
//     (예전 Apps Script 버전이 느렸던 이유가 매번 서버 왕복을 기다렸기 때문)
// ─────────────────────────────────────────────────────────────
import { firebaseConfig } from './firebase-config.js';
import { DEFAULT_WORDS } from './words.js';
import { STARTER_ITEMS, STARTER_COINS } from './items.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const ONLINE = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);

let F = null, db = null, auth = null, offset = 0;
export const now = () => Date.now() + offset;

// ── 체험 모드: localStorage + 탭 사이 실시간 동기화 ──────────────
const LKEY = 'ea_local_db';
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('ea_local') : null;
const localSubs = new Set();
const lread = () => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch { return {}; } };
function lwrite(d) {
  localStorage.setItem(LKEY, JSON.stringify(d));
  bc?.postMessage(1);
  localSubs.forEach((f) => f());
}
if (bc) bc.onmessage = () => localSubs.forEach((f) => f());
const lget = (path) => path.split('/').reduce((o, k) => (o == null ? undefined : o[k]), lread()) ?? null;
function setIn(root, path, val) {
  const ks = path.split('/');
  let o = root;
  for (const k of ks.slice(0, -1)) {
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    o = o[k];
  }
  if (val === null || val === undefined) delete o[ks.at(-1)];
  else o[ks.at(-1)] = val;
}
function lset(path, val) { const d = lread(); setIn(d, path, val); lwrite(d); }
function lupdate(path, obj) {
  const d = lread();
  for (const [k, v] of Object.entries(obj)) setIn(d, path + '/' + k, v);
  lwrite(d);
}
function lsub(path, cb) {
  let last;
  const f = () => {
    const v = lget(path);
    const s = JSON.stringify(v);
    if (s !== last) { last = s; cb(v); }
  };
  localSubs.add(f);
  f();
  return () => localSubs.delete(f);
}

// ── 공통 읽기/쓰기 ────────────────────────────────────────────
async function get(path) { if (!ONLINE) return lget(path); return (await F.get(F.ref(db, path))).val(); }
async function set(path, val) { if (!ONLINE) return lset(path, val); return F.set(F.ref(db, path), val); }
async function update(path, obj) { if (!ONLINE) return lupdate(path, obj); return F.update(F.ref(db, path), obj); }
function sub(path, cb) { if (!ONLINE) return lsub(path, cb); return F.onValue(F.ref(db, path), (s) => cb(s.val())); }

// ── 시작 ─────────────────────────────────────────────────────
export async function init({ teacher = false } = {}) {
  if (!ONLINE) {
    if (!localStorage.getItem('ea_uid')) localStorage.setItem('ea_uid', 'u' + Math.random().toString(36).slice(2, 10));
    return;
  }
  const [A, Au, D] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-database.js'),
  ]);
  F = { ...Au, ...D };
  const app = A.initializeApp(firebaseConfig);
  auth = Au.getAuth(app);
  db = D.getDatabase(app);
  D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => (offset = s.val() || 0));
  await auth.authStateReady();
  if (!teacher && !auth.currentUser) await Au.signInAnonymously(auth);
}

export const uid = () => (ONLINE ? auth?.currentUser?.uid : localStorage.getItem('ea_uid'));
export const isTeacherSignedIn = () => !ONLINE || (auth?.currentUser && !auth.currentUser.isAnonymous);
export const teacherEmail = () => (ONLINE ? auth?.currentUser?.email || '' : '체험 모드');
export async function teacherLogin() { await F.signInWithPopup(auth, new F.GoogleAuthProvider()); }
export async function teacherLogout() { if (ONLINE) await F.signOut(auth); }

// ── 학생: 내 정보 ─────────────────────────────────────────────
export const me = { code: null, num: null, data: null };
const meListeners = new Set();
let flushT = 0;

const blank = () => ({
  uid: uid(), name: '', score: 0, coins: STARTER_COINS, items: { ...STARTER_ITEMS }, best: {}, plays: 0, updatedAt: 0,
});

export async function join(code, num, name) {
  code = String(code).toUpperCase().trim();
  num = +num;
  if (!ONLINE && !lget(`classes/${code}/meta`)) {
    lset(`classes/${code}/meta`, { owner: uid(), name: code === 'DEMO' ? '체험 반' : code, createdAt: Date.now() });
    lset(`teachers/${uid()}/classes/${code}`, code === 'DEMO' ? '체험 반' : code);
  }
  let meta;
  try { meta = await get(`classes/${code}/meta`); } catch { meta = null; }
  if (!meta) throw new Error('NO_CLASS');
  const path = `classes/${code}/players/${num}`;
  const cur = await get(path);
  if (cur && cur.uid !== uid()) throw new Error('TAKEN');
  const data = { ...blank(), ...(cur || {}), name, uid: uid() };
  data.items = { ...(cur ? {} : STARTER_ITEMS), ...(data.items || {}) };
  data.best = data.best || {};
  await set(path, data); // 처음 한 번만 기다린다 (자리 확보)
  Object.assign(me, { code, num, data, className: meta.name });
  localStorage.setItem('ea_session', JSON.stringify({ code, num, name }));
  emit();
  return data;
}

export function leave(save = true) {
  if (save) flush(); else clearTimeout(flushT); // 선생님이 자리를 비웠을 땐 다시 쓰지 않는다
  localStorage.removeItem('ea_session');
  Object.assign(me, { code: null, num: null, data: null });
}

export function onMe(f) { meListeners.add(f); if (me.data) f(me.data); return () => meListeners.delete(f); }
function emit() { meListeners.forEach((f) => f(me.data)); }
function changed() {
  emit();
  clearTimeout(flushT);
  flushT = setTimeout(flush, 350);
}
export function flush() {
  clearTimeout(flushT);
  if (!me.code || !me.data) return;
  const { uid: u, name, score, coins, items, best, plays } = me.data;
  update(`classes/${me.code}/players/${me.num}`, { uid: u, name, score, coins, items, best, plays, updatedAt: Date.now() })
    .catch((e) => console.warn('저장 실패(잠시 뒤 다시 보냄)', e));
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.hidden && flush());

export function addPoints(p) { me.data.score += p; changed(); }
export function addCoins(c) { me.data.coins += c; changed(); }
export function useItem(id) {
  if ((me.data.items[id] || 0) <= 0) return false;
  me.data.items[id]--;
  changed();
  return true;
}
export function refundItem(id) { me.data.items[id] = (me.data.items[id] || 0) + 1; changed(); }
export function buy(id, price) {
  if (me.data.coins < price) return false;
  me.data.coins -= price;
  me.data.items[id] = (me.data.items[id] || 0) + 1;
  changed();
  return true;
}
export function recordGame(gameId, score) {
  me.data.plays = (me.data.plays || 0) + 1;
  const isBest = score > 0 && score > (me.data.best[gameId] || 0);
  if (isBest) me.data.best[gameId] = score;
  changed();
  flush();
  return isBest;
}

/** 내 자리를 지켜본다 — 선생님이 점수 초기화하면 따르고, 자리를 비우면 내보낸다 */
export function subMine(onKicked) {
  const path = `classes/${me.code}/players/${me.num}`;
  return sub(path, (v) => {
    if (!me.data) return;
    if (!v) return onKicked();
    if ((v.resetAt || 0) !== (me.data.resetAt || 0)) {
      me.data.resetAt = v.resetAt || 0;
      me.data.score = v.score || 0;
      me.data.best = v.best || {};
      if (typeof v.coins === 'number') me.data.coins = v.coins;
      emit();
    }
  });
}

// ── 반 전체 ──────────────────────────────────────────────────
const asList = (v) => (Array.isArray(v) ? v : Object.values(v || {})).filter((w) => w && w.en && w.ko);
export function subWords(code, cb) {
  return sub(`classes/${code}/words`, (v) => { const l = asList(v); cb(l.length >= 8 ? l : DEFAULT_WORDS, l.length >= 8); });
}
export function subPlayers(code, cb) {
  return sub(`classes/${code}/players`, (v) => cb(Object.entries(v || {}).map(([num, p]) => ({ ...p, num: +num }))));
}
export function subEvent(code, cb) { return sub(`classes/${code}/event`, cb); }
export function subFeed(code, cb) {
  const path = `classes/${code}/feed`;
  const f = (v) => cb(Object.values(v || {}).sort((a, b) => b.ts - a.ts).slice(0, 12));
  if (!ONLINE) return lsub(path, f);
  return F.onValue(F.query(F.ref(db, path), F.limitToLast(12)), (s) => f(s.val()));
}
export async function pushFeed(entry) {
  if (!me.code) return;
  const path = `classes/${me.code}/feed`;
  const val = { ...entry, ts: Date.now() };
  if (ONLINE) return F.push(F.ref(db, path), val).catch(() => {});
  const d = lread();
  const feed = lget(path) || {};
  const keys = Object.keys(feed).sort();
  keys.slice(0, Math.max(0, keys.length - 29)).forEach((k) => setIn(d, `${path}/${k}`, null));
  setIn(d, `${path}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, val);
  lwrite(d);
}

// ── 선생님 ───────────────────────────────────────────────────
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 5 }, () => CODE_CH[(Math.random() * CODE_CH.length) | 0]).join('');

export function subMyClasses(cb) {
  return sub(`teachers/${uid()}/classes`, (v) => cb(Object.entries(v || {}).map(([code, name]) => ({ code, name }))));
}
export async function createClass(name) {
  for (let i = 0; i < 8; i++) {
    const code = genCode();
    if (await get(`classes/${code}/meta`)) continue;
    await set(`classes/${code}/meta`, { owner: uid(), name, createdAt: Date.now() });
    await set(`teachers/${uid()}/classes/${code}`, name);
    return code;
  }
  throw new Error('반 코드를 만들지 못했어요. 다시 눌러 주세요.');
}
export const getWords = async (code) => asList(await get(`classes/${code}/words`));
export const saveWords = (code, list) => set(`classes/${code}/words`, list.length ? list : null);
export const setEvent = (code, minutes) =>
  set(`classes/${code}/event`, minutes ? { type: 'double', until: now() + minutes * 60000 } : null);
export async function resetScores(code, nums = null) {
  const ps = (await get(`classes/${code}/players`)) || {};
  const t = Date.now();
  const upd = {};
  for (const num of nums || Object.keys(ps)) {
    if (!ps[num]) continue;
    upd[`${num}/score`] = 0;
    upd[`${num}/best`] = null;
    upd[`${num}/resetAt`] = t;
  }
  if (Object.keys(upd).length) await update(`classes/${code}/players`, upd);
  if (!nums) await set(`classes/${code}/feed`, null);
}
export const giveCoins = async (code, num, n) => {
  const p = await get(`classes/${code}/players/${num}`);
  if (p) await update(`classes/${code}/players/${num}`, { coins: (p.coins || 0) + n, resetAt: Date.now(), score: p.score || 0 });
};
export const removePlayer = (code, num) => set(`classes/${code}/players/${num}`, null);
