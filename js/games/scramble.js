import { h, esc, shuffle, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { writePrompt } from '../write.js';

export default {
  id: 'scramble', title: '문장 퍼즐', emoji: '🧩', color: '#22c55e', time: 90,
  desc: '흩어진 단어를 눌러 문장을 완성! 2문제마다 빈칸 쓰기가 나와요.',
  tags: ['✍️ 빈칸 쓰기'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const pool = ctx.words.filter((w) => w.ex && w.ex.trim().split(/\s+/).length >= 3);
    if (pool.length < 3) {
      ctx.stage.append(h('<div class="empty-msg">🧩 예문이 있는 단어가 부족해서 이 게임을 할 수 없어요.<br>선생님께 단어 목록에 예문을 넣어 달라고 해 주세요.</div>'));
      setTimeout(() => ctx.end('예문이 부족해요'), 2200);
      return {};
    }
    const box = h(`<div class="scr">
      <div class="scr-hint"></div>
      <div class="scr-answer"></div>
      <div class="scr-bank"></div>
      <div class="scr-tip">단어를 누르면 위로 올라가요 · 위의 단어를 누르면 내려와요</div>
    </div>`);
    ctx.stage.append(box);
    const hint = box.querySelector('.scr-hint'), ansEl = box.querySelector('.scr-answer'), bank = box.querySelector('.scr-bank');
    const next = deck(pool);
    let n = 0, alive = true, tokens = [], order = [], placed = [], lock = true;

    async function ask() {
      if (!alive) return;
      n++;
      const w = next();
      if (n % 2 === 0) {
        lock = true;
        box.classList.add('dim');
        await writePrompt(ctx, w, { label: '🧩 빈칸 쓰기', base: 15 });
        box.classList.remove('dim');
        return ask();
      }
      tokens = w.ex.trim().split(/\s+/).map((t, i) => ({ t, i }));
      let tries = 0;
      do { order = shuffle(tokens); } while (order.map((x) => x.t).join(' ') === tokens.map((x) => x.t).join(' ') && ++tries < 5);
      placed = [];
      hint.innerHTML = `🔑 <b>${esc(w.en)}</b> = ${esc(w.ko)}`;
      ansEl.className = 'scr-answer';
      render();
      lock = false;
    }

    function render() {
      ansEl.innerHTML = placed.length
        ? placed.map((tk, i) => `<button class="chip up" data-p="${i}">${esc(tk.t)}</button>`).join('')
        : '<span class="scr-empty">여기에 문장이 만들어져요</span>';
      bank.innerHTML = order
        .map((tk) => `<button class="chip ${placed.includes(tk) ? 'used' : ''}" data-i="${tk.i}" ${placed.includes(tk) ? 'disabled' : ''}>${esc(tk.t)}</button>`)
        .join('');
    }

    function check() {
      if (placed.length !== tokens.length) return;
      lock = true;
      if (placed.map((x) => x.t).join(' ') === tokens.map((x) => x.t).join(' ')) {
        ansEl.classList.add('ok');
        ctx.award(20, { el: ansEl });
        setTimeout(ask, 750);
      } else {
        ansEl.classList.add('bad');
        ctx.miss(ansEl);
        setTimeout(() => { placed = []; ansEl.classList.remove('bad'); render(); lock = false; }, 700);
      }
    }

    bank.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.chip');
      if (!b || lock || b.disabled) return;
      sfx.click();
      placed.push(tokens[+b.dataset.i]);
      render();
      check();
    });
    ansEl.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.chip');
      if (!b || lock) return;
      placed.splice(+b.dataset.p, 1);
      render();
    });
    ask();

    return {
      onItem(id) {
        if (lock) return false;
        if (id === 'hint') {
          let k = 0;
          while (k < placed.length && placed[k].t === tokens[k].t) k++;
          placed = placed.slice(0, k);
          if (k >= tokens.length) return false;
          const want = tokens[k].t;
          const tk = order.find((x) => x.t === want && !placed.includes(x));
          if (!tk) return false;
          placed.push(tk);
          render();
          check();
          return true;
        }
        if (id === 'skip') { lock = true; setTimeout(ask, 120); return true; }
        return false;
      },
      destroy() { alive = false; },
    };
  },
};
