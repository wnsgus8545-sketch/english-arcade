import { h, esc, shuffle, sample, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { bump, shake } from '../fx.js';
import { writePrompt } from '../write.js';

const LANES = 3;

export default {
  id: 'race', title: '단어 레이싱', emoji: '🏎️', color: '#ef4444', time: 70,
  desc: '← → 로 차선을 바꿔 뜻에 맞는 영어 게이트를 통과! 맞힐수록 빨라져요.',
  tags: ['🏁 스피드', '✍️ 피트 스톱 쓰기'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="race">
      <div class="rc-hud"><div class="rc-prompt"><small>이 뜻의 게이트로!</small><b></b></div><div class="rc-speed"><b>0</b><small>km/h</small></div></div>
      <div class="rc-road">
        <div class="rc-stripes"></div>
        <div class="rc-gates"></div>
        <div class="rc-car">🏎️</div>
        <button class="rc-tap l" aria-label="왼쪽"></button><button class="rc-tap r" aria-label="오른쪽"></button>
      </div>
      <div class="rc-help">← → 키 · A / D 키 · 도로 왼쪽/오른쪽을 눌러도 돼요</div>
    </div>`);
    ctx.stage.append(box);
    const road = box.querySelector('.rc-road'), gatesEl = box.querySelector('.rc-gates'), car = box.querySelector('.rc-car');
    const stripes = box.querySelector('.rc-stripes'), promptEl = box.querySelector('.rc-prompt b'), spdEl = box.querySelector('.rc-speed b');
    const next = deck(ctx.words);
    let lane = 1, gateY = -90, speed = 130, target = null, opts = [], busy = false, alive = true, dist = 0, row = 0;

    const setLane = (l) => {
      lane = Math.max(0, Math.min(LANES - 1, l));
      car.style.left = `${((lane + 0.5) / LANES) * 100}%`;
    };
    setLane(1);

    function newRow() {
      if (!alive) return;
      row++;
      target = next();
      if (row % 6 === 0) {
        busy = true;
        gatesEl.innerHTML = '';
        promptEl.textContent = '🔧 피트 스톱!';
        writePrompt(ctx, target, { label: '🔧 피트 스톱 · 쓰기 찬스', base: 15 }).then(() => { busy = false; newRow(); });
        return;
      }
      promptEl.textContent = target.ko;
      bump(promptEl);
      opts = shuffle([target, ...sample(ctx.words, LANES - 1, [target])]);
      gatesEl.innerHTML = opts.map((w, i) => `<div class="gate" data-i="${i}"><b>${esc(w.en)}</b></div>`).join('');
      gateY = -90;
      gatesEl.style.transform = `translateY(${gateY}px)`;
    }

    ctx.onTick((dt) => {
      if (!alive) return;
      const v = busy ? 0 : speed;
      dist += v * dt;
      stripes.style.backgroundPositionY = `${dist % 80}px`;
      spdEl.textContent = Math.round(v * 0.6);
      if (busy || !target) return;
      gateY += v * dt;
      gatesEl.style.transform = `translateY(${gateY}px)`;
      const carTop = car.offsetTop;
      if (gateY + 50 >= carTop) resolve();
    });

    function resolve() {
      busy = true;
      const gate = gatesEl.children[lane];
      if (opts[lane] === target) {
        gate?.classList.add('pass');
        speed = Math.min(330, speed + 18);
        ctx.award(10 + Math.round(speed / 40), { el: car });
        car.classList.remove('boost'); void car.offsetWidth; car.classList.add('boost');
        setTimeout(() => { busy = false; newRow(); }, 260);
      } else {
        gate?.classList.add('crash');
        const shielded = ctx.miss(car);
        if (!shielded) speed = Math.max(110, speed * 0.6);
        car.classList.add('spin');
        shake(road);
        sfx.bad();
        setTimeout(() => { car.classList.remove('spin'); busy = false; newRow(); }, 750);
      }
    }

    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { e.preventDefault(); setLane(lane - 1); }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { e.preventDefault(); setLane(lane + 1); }
    };
    document.addEventListener('keydown', onKey);
    box.querySelector('.rc-tap.l').addEventListener('pointerdown', (e) => { e.preventDefault(); setLane(lane - 1); });
    box.querySelector('.rc-tap.r').addEventListener('pointerdown', (e) => { e.preventDefault(); setLane(lane + 1); });
    gatesEl.addEventListener('pointerdown', (e) => { const g = e.target.closest('.gate'); if (g) setLane(+g.dataset.i); });
    newRow();

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') {
          const bad = [...gatesEl.children].filter((g) => opts[+g.dataset.i] !== target && !g.classList.contains('dud'));
          if (!bad.length) return false;
          bad.forEach((g) => g.classList.add('dud'));
          return true;
        }
        if (id === 'skip') { newRow(); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
