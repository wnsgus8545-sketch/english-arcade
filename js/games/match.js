import { h, esc, shuffle, sample } from '../util.js';
import { sfx } from '../sfx.js';
import { writePrompt } from '../write.js';

export default {
  id: 'match', title: '카드 짝맞추기', emoji: '🃏', color: '#ec4899', time: 90,
  desc: '뒤집힌 카드에서 영어-뜻 짝을 찾아요. 판을 깨면 🎁 보너스 쓰기!',
  tags: ['✍️ 보너스 쓰기'],
  items: ['time', 'double', 'shield', 'hint'],
  start(ctx) {
    const box = h(`<div class="match"><div class="mt-info">처음 2초 동안 카드를 외워 두세요 👀</div><div class="mt-grid"></div></div>`);
    ctx.stage.append(box);
    const grid = box.querySelector('.mt-grid'), info = box.querySelector('.mt-info');
    let cards = [], open = [], lock = true, alive = true, boardWords = [], left = 0, round = 0;

    function deal() {
      if (!alive) return;
      round++;
      boardWords = sample(ctx.words, 6);
      cards = shuffle(boardWords.flatMap((w) => [{ w, t: w.en, k: 'en' }, { w, t: w.ko, k: 'ko' }]));
      grid.innerHTML = cards
        .map((c, i) => `<button class="mcard ${c.k}" data-i="${i}"><div class="inner"><div class="face back">?</div><div class="face front">${esc(c.t)}</div></div></button>`)
        .join('');
      left = 6; open = []; lock = true;
      info.textContent = `${round}판 — 처음 2초 동안 카드를 외워 두세요 👀`;
      grid.classList.add('peek');
      setTimeout(() => { if (!alive) return; grid.classList.remove('peek'); lock = false; info.textContent = '같은 뜻끼리 두 장을 뒤집어요'; }, 2000);
    }

    grid.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.mcard');
      if (!b || lock || b.classList.contains('flip') || b.classList.contains('done')) return;
      sfx.click();
      b.classList.add('flip');
      open.push(b);
      if (open.length < 2) return;
      lock = true;
      const [a, c] = open;
      const A = cards[+a.dataset.i], C = cards[+c.dataset.i];
      if (A.w === C.w) {
        setTimeout(() => {
          a.classList.add('done'); c.classList.add('done');
          ctx.award(15, { el: c });
          open = []; lock = false; left--;
          if (left === 0) bonus();
        }, 220);
      } else {
        setTimeout(() => {
          ctx.miss(grid);
          a.classList.remove('flip'); c.classList.remove('flip');
          open = []; lock = false;
        }, 700);
      }
    });

    async function bonus() {
      lock = true;
      info.textContent = '🎉 판 클리어! 보너스 쓰기 2문제';
      for (const w of sample(boardWords, 2)) {
        if (!alive) return;
        await writePrompt(ctx, w, { label: '🎁 보너스 쓰기', base: 12 });
      }
      deal();
    }
    deal();

    return {
      onItem(id) {
        if (id === 'hint') {
          if (lock) return false;
          lock = true;
          grid.classList.add('peek');
          setTimeout(() => { grid.classList.remove('peek'); lock = false; }, 1300);
          return true;
        }
        return false;
      },
      destroy() { alive = false; },
    };
  },
};
