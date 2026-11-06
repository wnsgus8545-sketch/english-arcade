// 아이템 — 게임 안에서 누르면 «서버를 기다리지 않고» 그 자리에서 바로 적용된다.
export const ITEMS = {
  time:   { emoji: '⏱️', name: '시간 +10초', short: '+10초', price: 25, desc: '누르는 즉시 남은 시간이 10초 늘어나요' },
  double: { emoji: '✨', name: '점수 2배',   short: '2배',   price: 50, desc: '20초 동안 얻는 점수가 모두 2배' },
  shield: { emoji: '🛡️', name: '방패',       short: '방패',  price: 30, desc: '다음 실수 1번을 막아 콤보를 지켜요' },
  hint:   { emoji: '💡', name: '힌트',       short: '힌트',  price: 20, desc: '틀린 보기 지우기 · 철자 한 글자 보기' },
  skip:   { emoji: '⏭️', name: '패스',       short: '패스',  price: 15, desc: '손해 없이 다음 문제로 넘어가요' },
};

export const STARTER_ITEMS = { time: 1, double: 1, shield: 1, hint: 2, skip: 1 };
export const STARTER_COINS = 50;
