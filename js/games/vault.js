import { h, esc, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { shake, bump } from '../fx.js';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export default {
  id: 'vault', title: '금고 깨기', emoji: '🔐', color: '#eab308', time: 90, isNew: true,
  desc: '뜻을 보고 알파벳을 하나씩 골라 금고 비밀번호(철자)를 맞혀요.',
  tags: ['🔤 철자'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const pool = ctx.words.filter((w) => w.en.replace(/[^a-z]/gi, '').length >= 3);
    const box = h(`<div class="vault">
      <div class="v-top"><div class="v-lock">🔐</div><div class="v-lives"></div></div>
      <div class="v-ko"></div>
      <div class="v-slots"></div>
      <div class="v-keys">${ROWS.map((r) => `<div class="v-row">${[...r].map((c) => `<button class="key" data-k="${c}">${c}</button>`).join('')}</div>`).join('')}</div>
    </div>`);
    ctx.stage.append(box);
    const lockEl = box.querySelector('.v-lock'), livesEl = box.querySelector('.v-lives'), koEl = box.querySelector('.v-ko'), slots = box.querySelector('.v-slots'), keys = box.querySelector('.v-keys');
    const next = deck(pool);
    let w, ans, guessed, lives, lock = true, alive = true;

    function ask() {
      if (!alive) return;
      w = next();
      ans = w.en.toLowerCase();
      guessed = new Set();
      lives = 6;
      lockEl.textContent = '🔐';
      koEl.textContent = w.ko;
      keys.querySelectorAll('.key').forEach((k) => (k.className = 'key'));
      slots.className = 'v-slots';
      render();
      lock = false;
    }
    const solved = () => [...ans].every((c) => !/[a-z]/.test(c) || guessed.has(c));
    function render(all = false) {
      livesEl.innerHTML = '🔑'.repeat(lives) + `<span class="lost">${'▫️'.repeat(6 - lives)}</span>`;
      slots.innerHTML = [...ans]
        .map((c) => (!/[a-z]/.test(c) ? `<i class="gap">${c === ' ' ? '' : esc(c)}</i>` : `<span class="slot ${guessed.has(c) ? 'on' : all ? 'miss' : ''}">${guessed.has(c) || all ? esc(c) : ''}</span>`))
        .join('');
    }

    function guess(ch) {
      if (lock || guessed.has(ch)) return;
      guessed.add(ch);
      const key = keys.querySelector(`[data-k="${ch}"]`);
      if (ans.includes(ch)) {
        key?.classList.add('hit');
        sfx.pop();
        render();
        if (solved()) {
          lock = true;
          lockEl.textContent = '🔓';
          bump(lockEl);
          slots.classList.add('ok');
          ctx.award(15 + lives * 3, { el: slots });
          setTimeout(ask, 900);
        }
      } else {
        key?.classList.add('no');
        lives--;
        shake(lockEl);
        render();
        if (lives <= 0) {
          lock = true;
          ctx.miss(slots);
          render(true);
          setTimeout(ask, 1500);
        }
      }
    }
    keys.addEventListener('pointerdown', (e) => { const k = e.target.closest('.key'); if (k) guess(k.dataset.k); });
    const onKey = (e) => { if (e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase(); if (/^[a-z]$/.test(k)) guess(k); };
    document.addEventListener('keydown', onKey);
    ask();

    return {
      onItem(id) {
        if (lock) return false;
        if (id === 'hint') {
          const left = [...new Set([...ans].filter((c) => /[a-z]/.test(c) && !guessed.has(c)))];
          if (left.length <= 1) return false;
          guess(left[(Math.random() * left.length) | 0]);
          return true;
        }
        if (id === 'skip') { lock = true; setTimeout(ask, 120); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
