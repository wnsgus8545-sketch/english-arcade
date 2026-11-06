import { h, sample, deck } from '../util.js';

export default {
  id: 'ox', title: '스피드 O/X', emoji: '⚡', color: '#3b82f6', time: 45, isNew: true,
  desc: '단어와 뜻이 맞으면 O, 틀리면 X! 45초 동안 최대한 많이.',
  tags: ['⚡ 순발력'],
  items: ['time', 'double', 'shield', 'skip'],
  start(ctx) {
    const box = h(`<div class="ox">
      <div class="ox-card"><div class="ox-en"></div><div class="ox-eq">=</div><div class="ox-ko"></div></div>
      <div class="ox-btns"><button class="ox-b o">⭕<small>맞아요 · ←</small></button><button class="ox-b x">❌<small>틀려요 · →</small></button></div>
    </div>`);
    ctx.stage.append(box);
    const card = box.querySelector('.ox-card'), enEl = box.querySelector('.ox-en'), koEl = box.querySelector('.ox-ko');
    const next = deck(ctx.words);
    let truth = true, lock = true, alive = true;

    function ask() {
      if (!alive) return;
      const w = next();
      truth = Math.random() < 0.5;
      enEl.textContent = w.en;
      koEl.textContent = truth ? w.ko : (sample(ctx.words, 1, [w])[0] || w).ko;
      card.className = 'ox-card';
      void card.offsetWidth;
      card.classList.add('in');
      lock = false;
    }
    function answer(sayTrue) {
      if (lock || !alive) return;
      lock = true;
      if (sayTrue === truth) {
        card.classList.add(sayTrue ? 'fly-l' : 'fly-r');
        ctx.award(5, { el: card });
        setTimeout(ask, 170);
      } else {
        card.classList.add('wrongc');
        ctx.miss(card);
        setTimeout(ask, 550);
      }
    }
    box.querySelector('.o').addEventListener('pointerdown', () => answer(true));
    box.querySelector('.x').addEventListener('pointerdown', () => answer(false));
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
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
