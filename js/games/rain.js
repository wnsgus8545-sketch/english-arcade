import { h, esc, norm, deck } from '../util.js';
import { shake } from '../fx.js';

export default {
  id: 'rain', title: '단어 비', emoji: '🌧️', color: '#06b6d4', time: 75,
  desc: '떨어지는 뜻을 보고 영어로 쳐서 터뜨려요. 전부 쓰기라 늘 점수 2배!',
  tags: ['✍️ 쓰기 ×2'],
  items: ['time', 'double', 'shield', 'hint', 'skip'],
  start(ctx) {
    const box = h(`<div class="rain">
      <div class="r-lives"></div>
      <div class="sky"><div class="ground"></div></div>
      <form class="r-form"><input class="r-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="뜻을 보고 영어로 쓰고 Enter ⏎" aria-label="영어 입력"><button class="btn primary">💥 쏘기</button></form>
    </div>`);
    ctx.stage.append(box);
    const sky = box.querySelector('.sky'), inp = box.querySelector('.r-in'), livesEl = box.querySelector('.r-lives');
    const next = deck(ctx.words);
    let drops = [], lives = 3, spawnT = 0.2, elapsed = 0, alive = true;

    const renderLives = () => { livesEl.innerHTML = '❤️'.repeat(lives) + `<span class="lost">${'🤍'.repeat(3 - lives)}</span>`; };
    renderLives();

    function spawn() {
      let w, tries = 0;
      do { w = next(); } while (drops.some((d) => d.w === w) && ++tries < 6);
      const mask = [...w.en].map((c, i) => (i === 0 ? c : c === ' ' ? ' ' : '_')).join(' ');
      const el = h(`<div class="drop"><b>${esc(w.ko)}</b><small>${esc(mask)}</small><em>${esc(w.en)}</em></div>`);
      sky.append(el);
      const W = sky.clientWidth;
      const d = { w, el, x: 6 + Math.random() * Math.max(10, W - el.offsetWidth - 12), y: -70, h: el.offsetHeight, speed: 26 + Math.min(elapsed, 80) * 0.5 + Math.random() * 10 };
      drops.push(d);
      place(d);
    }
    const place = (d) => { d.el.style.transform = `translate(${d.x}px, ${d.y}px)`; };
    function remove(d, cls) {
      drops = drops.filter((x) => x !== d);
      d.el.classList.add(cls);
      setTimeout(() => d.el.remove(), 450);
    }
    const lowest = () => [...drops].sort((a, b) => b.y - a.y)[0];

    ctx.onTick((dt) => {
      if (!alive) return;
      elapsed += dt;
      spawnT -= dt;
      if (spawnT <= 0) { spawn(); spawnT = Math.max(1.15, 2.7 - elapsed * 0.025); }
      const H = sky.clientHeight - 14;
      for (const d of [...drops]) {
        d.y += d.speed * dt;
        place(d);
        if (d.y + d.h >= H) {
          remove(d, 'splash');
          if (!ctx.miss(sky)) {
            lives--;
            renderLives();
            if (lives <= 0) { ctx.end('💧 목숨을 다 썼어요'); return; }
          }
        }
      }
    });

    box.querySelector('.r-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = norm(inp.value);
      if (!v) return;
      const hit = drops.filter((d) => norm(d.w.en) === v).sort((a, b) => b.y - a.y)[0];
      if (hit) {
        ctx.award(8 + Math.min(6, v.length), { writing: true, el: hit.el });
        remove(hit, 'pop');
        inp.value = '';
      } else {
        shake(inp);
        inp.select();
      }
    });
    sky.addEventListener('pointerdown', () => setTimeout(() => inp.focus(), 0));
    setTimeout(() => inp.focus(), 50);

    return {
      onItem(id) {
        const d = lowest();
        if (!d) return false;
        if (id === 'hint') { d.el.classList.add('reveal'); setTimeout(() => d.el.classList.remove('reveal'), 2500); return true; }
        if (id === 'skip') { remove(d, 'pop'); return true; }
        return false;
      },
      destroy() { alive = false; },
    };
  },
};
