// ── 게임 아이템 — 게임 안에서 누르면 «서버를 기다리지 않고» 그 자리에서 바로 적용된다 ──
export const ITEMS = {
  time:   { emoji: '⏱️', name: '시간 +10초', short: '+10초', price: 20, desc: '누르는 즉시 남은 시간 +10초' },
  double: { emoji: '✨', name: '점수 2배',   short: '2배',   price: 35, desc: '20초 동안 얻는 점수 2배' },
  gold:   { emoji: '🌟', name: '황금 시간',  short: '황금',  price: 60, desc: '15초 동안 점수 3배! (2배와 겹치면 6배)', hot: true },
  combo:  { emoji: '🔥', name: '콤보 폭발',  short: '콤보',  price: 45, desc: '즉시 콤보 +10 → 바로 ×2.0 배수', hot: true },
  shield: { emoji: '🛡️', name: '방패',       short: '방패',  price: 25, desc: '다음 실수 1번을 막아 콤보·감점 보호' },
  hint:   { emoji: '💡', name: '힌트',       short: '힌트',  price: 15, desc: '틀린 보기 지우기 · 철자 한 글자 보기' },
  skip:   { emoji: '⏭️', name: '패스',       short: '패스',  price: 10, desc: '손해 없이 다음 문제로' },
};
/** 어느 게임에서나 쓸 수 있는 아이템 (힌트·패스는 게임마다 다름) */
export const GENERIC_ITEMS = ['time', 'double', 'gold', 'combo', 'shield'];
/** 결과 화면 «빠른 구매» 에 보여 줄 것 */
export const QUICK_ITEMS = ['gold', 'combo', 'double'];

export const STARTER_ITEMS = { time: 1, double: 1, shield: 1, hint: 2, skip: 1, combo: 1 };
export const STARTER_COINS = 50;

// ── 꾸미기 — 한 번 사면 계속. 순위표·TV 화면에 보인다 ──
export const COSMETICS = {
  avatar: {
    label: '🐾 아바타',
    list: {
      dragon:  { v: '🐉', name: '드래곤', price: 180 },
      unicorn: { v: '🦄', name: '유니콘', price: 150 },
      robot:   { v: '🤖', name: '로봇', price: 120 },
      alien:   { v: '👽', name: '외계인', price: 120 },
      ghost:   { v: '👻', name: '유령', price: 100 },
      cat:     { v: '😼', name: '시크한 고양이', price: 100 },
      crown:   { v: '👑', name: '왕관', price: 300, rare: true },
      fire:    { v: '🔥', name: '불꽃', price: 250, rare: true },
    },
  },
  fx: {
    label: '🌈 이름 효과',
    list: {
      rainbow: { v: 'fx-rainbow', name: '무지개 이름', price: 220 },
      gold:    { v: 'fx-gold', name: '황금 이름', price: 180 },
      neon:    { v: 'fx-neon', name: '네온 이름', price: 150 },
      fire:    { v: 'fx-fire', name: '불꽃 테두리', price: 200 },
    },
  },
  title: {
    label: '🏷️ 칭호',
    list: {
      hunter:  { v: '단어 사냥꾼', name: '단어 사냥꾼', price: 80 },
      speller: { v: '철자 장인', name: '철자 장인', price: 80 },
      combo:   { v: '콤보 장인', name: '콤보 장인', price: 100 },
      writer:  { v: '✍️ 쓰기왕', name: '✍️ 쓰기왕', price: 120 },
      legend:  { v: '👑 전설', name: '👑 전설', price: 350, rare: true },
    },
  },
};

// ── 행운 상자 ──
export const LUCKY_PRICE = 40;
