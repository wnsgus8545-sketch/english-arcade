import { h, esc, shuffle, sample, deck } from '../util.js';
import { sfx } from '../sfx.js';
import { bump, shake } from '../fx.js';
import { writePrompt } from '../write.js';

const AMMO = 6;          // 탄창 — 막 쏘면 금방 바닥난다
const RELOAD_MS = 1300;  // 재장전 시간
const PENALTY = 3;       // 엉뚱한 과녁을 쏘면 감점
const ROWS = 3, PER_ROW = 2;
const ICONS = ['🎯', '🦆', '🎈', '⭐'];

export default {
  id: 'shoot', title: '단어 사격', emoji: '🎯', color: '#14b8a6', time: 60,
  desc: '움직이는 과녁 중 뜻에 맞는 영어를 쏴요! 총알은 6발, 빗나가면 감점.',
  tags: ['🔫 조준', '✍️ 쓰기 섞임'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="shoot">
      <div class="sh-hud"><div class="sh-prompt"><small>이 뜻의 과녁을 쏴라!</small><b></b></div><div class="sh-ammo"></div></div>
      <div class="sh-range">${Array.from({ length: ROWS }, (_, r) => `<div class="sh-row" data-r="${r}"></div>`).join('')}</div>
      <div class="sh-help">과녁을 눌러 쏘기 · 총알이 떨어지면 자동 재장전 (R 키로 바로 재장전)</div>
    </div>`);
    ctx.stage.append(box);
    const range = box.querySelector('.sh-range'), rowsEl = [...box.querySelectorAll('.sh-row')];
    const promptEl = box.querySelector('.sh-prompt b'), ammoEl = box.querySelector('.sh-ammo');
    const next = deck(ctx.words);
    let targets = [], target = null, ammo = AMMO, reloading = false, busy = false, alive = true, hits = 0;

    const renderAmmo = () => {
      ammoEl.innerHTML = reloading ? '<span class="reload">🔄 재장전 중…</span>'
        : Array.from({ length: AMMO }, (_, i) => `<i class="${i < ammo ? '' : 'used'}"></i>`).join('');
    };
    function reload() {
      if (reloading || ammo === AMMO) return;
      reloading = true;
      renderAmmo();
      setTimeout(() => { if (!alive) return; ammo = AMMO; reloading = false; renderAmmo(); sfx.tick(); }, RELOAD_MS);
    }

    // 과녁 만들기 (줄마다 2개씩, 줄마다 방향·속도가 다르다)
    for (let r = 0; r < ROWS; r++) {
      for (let k = 0; k < PER_ROW; k++) {
        const el = h(`<button class="tgt"><span class="ti"></span><b></b></button>`);
        rowsEl[r].append(el);
        targets.push({ el, r, x: k * 0.5 + Math.random() * 0.2, v: (r % 2 ? -1 : 1) * (0.08 + r * 0.025), w: null });
      }
    }

    function newPrompt() {
      if (!alive) return;
      target = next();
      promptEl.textContent = target.ko;
      bump(promptEl);
      const ws = shuffle([target, ...sample(ctx.words, targets.length - 1, [target])]);
      targets.forEach((t, i) => {
        t.w = ws[i];
        t.el.className = 'tgt';
        t.el.querySelector('b').textContent = ws[i].en;
        t.el.querySelector('.ti').textContent = ICONS[(i + hits) % ICONS.length];
      });
      busy = false;
    }

    ctx.onTick((dt) => {
      if (!alive) return;
      const W = range.clientWidth;
      for (const t of targets) {
        if (!busy) t.x += t.v * dt;
        if (t.x > 1.05) t.x -= 1.25;
        if (t.x < -0.2) t.x += 1.25;
        t.el.style.transform = `translateX(${t.x * W}px)`;
      }
    });

    function fire(e) {
      if (busy || !alive) return;
      if (reloading) { shake(ammoEl); return; }
      if (ammo <= 0) { reload(); return; }
      ammo--;
      renderAmmo();
      sfx.pop();
      // 총구 불꽃
      const rr = range.getBoundingClientRect();
      const fl = h('<i class="flash"></i>');
      fl.style.left = e.clientX - rr.left + 'px';
      fl.style.top = e.clientY - rr.top + 'px';
      range.append(fl);
      setTimeout(() => fl.remove(), 250);

      const el = e.target.closest('.tgt');
      const t = el && targets.find((x) => x.el === el);
      if (!t) { if (ammo === 0) reload(); return; } // 허공 — 총알만 줄어든다
      if (t.w === target) {
        t.el.classList.add('hit');
        hits++;
        ctx.award(10, { el: t.el });
        busy = true;
        if (hits % 5 === 0) {
          setTimeout(() => {
            promptEl.textContent = '🏅 보너스 과녁!';
            writePrompt(ctx, next(), { label: '🏅 보너스 과녁 · 쓰기 찬스', base: 15 }).then(() => { ammo = AMMO; renderAmmo(); newPrompt(); });
          }, 300);
        } else setTimeout(newPrompt, 350);
      } else {
        t.el.classList.add('wrongt');
        setTimeout(() => t.el.classList.remove('wrongt'), 400);
        if (!ctx.miss(t.el)) ctx.penalty(PENALTY, t.el);
      }
      if (ammo === 0) reload();
    }
    range.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(e); });
    const onKey = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key.toLowerCase() === 'r') reload(); };
    document.addEventListener('keydown', onKey);
    renderAmmo();
    newPrompt();

    return {
      onItem(id) {
        if (busy) return false;
        if (id === 'hint') {
          const bad = targets.filter((t) => t.w !== target && !t.el.classList.contains('dud'));
          if (!bad.length) return false;
          bad.slice(0, Math.max(1, bad.length - 2)).forEach((t) => t.el.classList.add('dud'));
          return true;
        }
        if (id === 'skip') { newPrompt(); return true; }
        return false;
      },
      destroy() { alive = false; document.removeEventListener('keydown', onKey); },
    };
  },
};
