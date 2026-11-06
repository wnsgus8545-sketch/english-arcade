import { h, esc, shuffle, sample, deck, speak } from '../util.js';
import { writePrompt } from '../write.js';

export default {
  id: 'quiz', title: '뜻 맞히기 퀴즈', emoji: '🧠', color: '#7c5cff', time: 60,
  desc: '4지선다로 빠르게! 3문제마다 ✍️ 쓰기 찬스가 끼어들어요.',
  tags: ['✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="quiz">
      <div class="q-card"><div class="q-dir"></div><div class="q-word"></div><button class="q-say" title="발음 듣기">🔊</button></div>
      <div class="q-opts"></div>
      <div class="q-keys">키보드 1 · 2 · 3 · 4 로도 고를 수 있어요</div>
    </div>`);
    ctx.stage.append(box);
    const card = box.querySelector('.q-card'), dir = box.querySelector('.q-dir'), word = box.querySelector('.q-word'), say = box.querySelector('.q-say'), optsEl = box.querySelector('.q-opts');
    const next = deck(ctx.words);
    let n = 0, cur = null, lock = true, alive = true;

    async function ask() {
      if (!alive) return;
      n++;
      const w = next();
      if (n % 3 === 0) {
        lock = true;
        box.classList.add('dim');
        await writePrompt(ctx, w);
        box.classList.remove('dim');
        return ask();
      }
      const enToKo = Math.random() < 0.6;
      const opts = shuffle([w, ...sample(ctx.words, 3, [w])]);
      cur = { w, enToKo, opts };
      dir.textContent = enToKo ? '이 단어의 뜻은?' : '이 뜻의 영어 단어는?';
      word.textContent = enToKo ? w.en : w.ko;
      word.className = 'q-word ' + (enToKo ? 'en' : 'ko');
      say.style.visibility = enToKo ? 'visible' : 'hidden';
      optsEl.innerHTML = opts
        .map((o, i) => `<button class="q-opt ${enToKo ? 'ko' : 'en'}" data-i="${i}"><i>${i + 1}</i>${esc(enToKo ? o.ko : o.en)}</button>`)
        .join('');
      card.classList.remove('pop-in'); void card.offsetWidth; card.classList.add('pop-in');
      lock = false;
    }

    function choose(i) {
      if (lock || !alive || !cur) return;
      const btn = optsEl.children[i];
      if (!btn || btn.disabled) return;
      lock = true;
      if (cur.opts[i] === cur.w) {
        btn.classList.add('right');
        ctx.award(10, { el: btn });
        setTimeout(ask, 320);
      } else {
        btn.classList.add('wrong');
        optsEl.children[cur.opts.indexOf(cur.w)].classList.add('right');
        ctx.miss(btn);
        setTimeout(ask, 800);
      }
    }
    optsEl.addEventListener('pointerdown', (e) => { const b = e.target.closest('.q-opt'); if (b) choose(+b.dataset.i); });
    say.onclick = () => cur && speak(cur.w.en);
    const onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); };
    document.addEventListener('keydown', onKey);
    ask();

    return {
      onItem(id) {
        if (lock || !cur) return false;
        if (id === 'hint') {
          const wrong = [...optsEl.children].filter((b, i) => cur.opts[i] !== cur.w && !b.disabled);
          if (wrong.length < 2) return false;
          shuffle(wrong).slice(0, 2).forEach((b) => { b.disabled = true; b.classList.add('gone'); });
          return true;
        }
        if (id === 'skip') { lock = true; setTimeout(ask, 120); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
