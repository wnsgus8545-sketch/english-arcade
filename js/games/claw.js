import { h, esc, shuffle, sample, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { bump } from '../fx.js';
import { writePrompt } from '../write.js';

const DOLLS = ['🧸', '🐰', '🐻', '🐥', '🐼', '🦊', '🐸', '🐧'];

export default {
  id: 'claw', title: '인형뽑기', emoji: '🧸', color: '#a855f7', time: 75, isNew: true,
  desc: '집게가 좌우로 움직여요. 뜻에 맞는 인형 위에서 [뽑기!] 타이밍을 맞춰요.',
  tags: ['🎯 타이밍', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="claw">
      <div class="cl-prompt"><small>이 뜻의 인형을 뽑아라!</small><b></b></div>
      <div class="cl-machine">
        <div class="cl-rail"></div>
        <div class="cl-claw"><div class="cl-rope"></div><div class="cl-hand"><span class="cl-l"></span><span class="cl-r"></span><div class="cl-got"></div></div></div>
        <div class="cl-dolls"></div>
        <div class="cl-glass"></div>
      </div>
      <div class="cl-ctrl"><button class="btn big primary cl-go">⬇️ 뽑기! <small>(스페이스)</small></button><div class="cl-bag"></div></div>
    </div>`);
    ctx.stage.append(box);
    const machine = box.querySelector('.cl-machine'), claw = box.querySelector('.cl-claw'), dollsEl = box.querySelector('.cl-dolls');
    const promptEl = box.querySelector('.cl-prompt b'), got = box.querySelector('.cl-got'), bag = box.querySelector('.cl-bag');
    const next = deck(ctx.words);
    let target = null, slots = [], busy = false, alive = true, t = 0, x = 0, speed = 1.3, round = 0, caught = 0;

    function newRound() {
      if (!alive) return;
      round++;
      target = next();
      if (round % 5 === 0) {
        busy = true;
        promptEl.textContent = '🌟 황금 인형!';
        writePrompt(ctx, target, { label: '🌟 황금 인형 · 쓰기 찬스', base: 15 }).then(() => { busy = false; newRound(); });
        return;
      }
      promptEl.textContent = target.ko;
      bump(promptEl);
      const n = round < 6 ? 3 : 4;
      const ws = shuffle([target, ...sample(ctx.words, n - 1, [target])]);
      const faces = shuffle(DOLLS);
      slots = ws.map((w, i) => ({ w, face: faces[i] }));
      dollsEl.style.setProperty('--n', n);
      dollsEl.innerHTML = slots.map((s, i) => `<div class="doll" data-i="${i}"><span class="df">${s.face}</span><b>${esc(s.w.en)}</b></div>`).join('');
      busy = false;
    }

    ctx.onTick((dt) => {
      if (!alive || busy) return;
      t += dt * speed;
      const W = machine.clientWidth - claw.offsetWidth;
      x = ((Math.sin(t) + 1) / 2) * W;
      claw.style.transform = `translateX(${x}px)`;
    });

    async function drop() {
      if (busy || !alive || !slots.length) return;
      busy = true;
      sfx.click();
      // 집게 가운데 아래에 있는 인형 찾기
      const cx = claw.getBoundingClientRect().left + claw.offsetWidth / 2;
      const dolls = [...dollsEl.children];
      const hit = dolls.find((d) => { const r = d.getBoundingClientRect(); return cx >= r.left && cx <= r.right; });
      const drop = Math.max(40, machine.clientHeight - 150);
      claw.style.setProperty('--drop', drop + 'px');
      claw.classList.add('down');
      await wait(520);
      claw.classList.add('grab');
      await wait(220);
      if (!hit) {
        claw.classList.remove('down', 'grab');
        await wait(480);
        busy = false;
        return; // 빈 곳 — 시간만 잃는다
      }
      const s = slots[+hit.dataset.i];
      hit.classList.add('lifted');
      got.innerHTML = `<span>${s.face}</span>`;
      claw.classList.remove('down');
      await wait(480);
      if (s.w === target) {
        claw.classList.remove('grab');
        got.innerHTML = '';
        ctx.award(12, { el: claw });
        caught++;
        bag.innerHTML = `${s.face} × ${caught}`;
        bump(bag);
        speed = Math.min(2.6, speed + 0.08);
        await wait(250);
        newRound();
      } else {
        // 틀린 인형은 미끄러져 떨어진다
        claw.classList.remove('grab');
        got.innerHTML = '';
        hit.classList.remove('lifted');
        hit.classList.add('wrongd');
        ctx.miss(hit);
        await wait(500);
        hit.classList.remove('wrongd');
        busy = false;
      }
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    box.querySelector('.cl-go').addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
    const onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) drop(); } };
    document.addEventListener('keydown', onKey);
    newRound();

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') {
          const bad = [...dollsEl.children].filter((d) => slots[+d.dataset.i].w !== target && !d.classList.contains('dud'));
          if (!bad.length) return false;
          bad.forEach((d) => d.classList.add('dud'));
          return true;
        }
        if (id === 'skip') { newRound(); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
