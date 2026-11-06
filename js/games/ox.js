import { h, sample, deck } from '../util.js';
import { shake } from '../fx.js';

// 찍기 방지
const READ_MS = 450;    // 카드가 나오고 이 시간 안에 누르면 무시 (읽지 않고 누르는 것 막기)
const PENALTY = 8;      // 틀리면 감점 — 아무거나 찍으면 평균 점수가 마이너스가 된다
const FREEZE_AFTER = 2; // 연속으로 이만큼 틀리면
const FREEZE_MS = 1800; // 이 시간 동안 얼어붙는다

export default {
  id: 'ox', title: '스피드 O/X', emoji: '⚡', color: '#3b82f6', time: 45,
  desc: '맞으면 O, 틀리면 X! 단, 틀리면 감점 −8점, 연속으로 찍으면 얼음 🧊',
  tags: ['⚡ 순발력', '⚠️ 오답 감점'],
  items: ['time', 'double', 'shield', 'skip'],
  start(ctx) {
    const box = h(`<div class="ox">
      <div class="ox-rule">✅ 맞히면 +5 · ❌ 틀리면 <b>−${PENALTY}</b> · 2번 연속 틀리면 🧊 얼음</div>
      <div class="ox-card"><div class="ox-en"></div><div class="ox-eq">=</div><div class="ox-ko"></div><div class="ox-read"><i></i></div></div>
      <div class="ox-btns"><button class="ox-b o">⭕<small>맞아요 · ←</small></button><button class="ox-b x">❌<small>틀려요 · →</small></button></div>
      <div class="ox-ice hidden">🧊<b>찍기 금지!</b><small>잠깐 얼었어요. 천천히 읽고 골라요</small></div>
    </div>`);
    ctx.stage.append(box);
    const card = box.querySelector('.ox-card'), enEl = box.querySelector('.ox-en'), koEl = box.querySelector('.ox-ko'), ice = box.querySelector('.ox-ice');
    const next = deck(ctx.words);
    let truth = true, lock = true, alive = true, shownAt = 0, wrongRow = 0;

    function ask() {
      if (!alive) return;
      const w = next();
      truth = Math.random() < 0.5;
      enEl.textContent = w.en;
      koEl.textContent = truth ? w.ko : (sample(ctx.words, 1, [w])[0] || w).ko;
      card.className = 'ox-card';
      void card.offsetWidth;
      card.classList.add('in', 'reading');
      shownAt = performance.now();
      lock = false;
    }
    function answer(sayTrue) {
      if (lock || !alive) return;
      if (performance.now() - shownAt < READ_MS) { shake(card); return; } // 읽기 전에 누름 → 무시
      lock = true;
      if (sayTrue === truth) {
        wrongRow = 0;
        card.classList.add(sayTrue ? 'fly-l' : 'fly-r');
        ctx.award(5, { el: card });
        setTimeout(ask, 170);
        return;
      }
      card.classList.add('wrongc');
      const shielded = ctx.miss(card);
      if (shielded) { setTimeout(ask, 450); return; }
      ctx.penalty(PENALTY, card);
      wrongRow++;
      if (wrongRow >= FREEZE_AFTER) {
        wrongRow = 0;
        ice.classList.remove('hidden');
        setTimeout(() => { ice.classList.add('hidden'); ask(); }, FREEZE_MS);
      } else setTimeout(ask, 600);
    }
    box.querySelector('.o').addEventListener('pointerdown', () => answer(true));
    box.querySelector('.x').addEventListener('pointerdown', () => answer(false));
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'o') answer(true);
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'x') answer(false);
    };
    document.addEventListener('keydown', onKey);
    ask();

    return {
      onItem(id) {
        if (id === 'skip' && !lock) { lock = true; setTimeout(ask, 100); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
