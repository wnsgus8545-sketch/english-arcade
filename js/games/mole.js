import { h, shuffle, sample, deck } from '../util.js';
import { bump } from '../fx.js';
import { writePrompt } from '../write.js';

export default {
  id: 'mole', title: '단어 두더지', emoji: '🔨', color: '#f97316', time: 60,
  desc: '뜻에 맞는 영어 두더지를 뿅! 🌟황금 두더지가 나오면 쓰기 찬스.',
  tags: ['✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="mole">
      <div class="m-prompt"><small>이 뜻의 영어 두더지를 잡아라!</small><b></b></div>
      <div class="m-field">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-i="${i}"><div class="mole-b"><div class="mole-face"></div><span></span></div><div class="dirt"></div></div>`).join('')}</div>
    </div>`);
    ctx.stage.append(box);
    const holes = [...box.querySelectorAll('.hole')];
    const promptEl = box.querySelector('.m-prompt b');
    const next = deck(ctx.words);
    let wave = 0, target = null, up = [], waveT = 0, busy = false, alive = true;

    function clear() { holes.forEach((hh) => { hh.classList.remove('up', 'hit', 'bad', 'dud'); hh._w = null; }); up = []; }

    async function newWave() {
      clear();
      if (!alive) return;
      wave++;
      target = next();
      if (wave % 6 === 0) {
        busy = true;
        promptEl.textContent = '🌟 황금 두더지!';
        await writePrompt(ctx, target, { label: '🌟 황금 두더지 · 쓰기 찬스', base: 15 });
        busy = false;
        if (!alive) return;
        return newWave();
      }
      promptEl.textContent = target.ko;
      bump(promptEl);
      const n = Math.min(4, 2 + Math.floor(wave / 7));
      const ws = shuffle([target, ...sample(ctx.words, n - 1, [target])]);
      const spots = shuffle(holes).slice(0, n);
      spots.forEach((hh, i) => {
        hh._w = ws[i];
        hh.querySelector('span').textContent = ws[i].en;
        hh.querySelector('.mole-face').textContent = ['🐹', '🐭', '🐰', '🐻'][i % 4];
        setTimeout(() => alive && hh._w && hh.classList.add('up'), i * 110);
      });
      up = spots;
      waveT = Math.max(1.8, 3.4 - wave * 0.07);
    }

    ctx.onTick((dt) => {
      if (busy || !target || !alive) return;
      waveT -= dt;
      if (waveT <= 0) newWave();
    });

    box.querySelector('.m-field').addEventListener('pointerdown', (e) => {
      const hh = e.target.closest('.hole');
      if (!hh || !hh.classList.contains('up') || busy || !hh._w) return;
      if (hh._w === target) {
        hh.classList.add('hit');
        ctx.award(10, { el: hh });
        busy = true;
        setTimeout(() => { busy = false; newWave(); }, 300);
      } else {
        hh.classList.add('bad');
        hh.classList.remove('up');
        ctx.miss(hh);
      }
    });
    newWave();

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') {
          const bad = up.filter((hh) => hh._w !== target && hh.classList.contains('up') && !hh.classList.contains('dud'));
          if (!bad.length) return false;
          bad.forEach((hh) => hh.classList.add('dud'));
          return true;
        }
        if (id === 'skip') { newWave(); return true; }
        return false;
      },
      destroy() { alive = false; },
    };
  },
};
