// ✍️ 쓰기 찬스 — 여러 게임 중간에 끼어드는 «뜻 보고 영어 쓰기» 카드. 점수 2배.
import { h, esc, norm } from './util.js';
import { sfx } from './sfx.js';
import { shake, burst } from './fx.js';

function blankSentence(ex, en) {
  if (!ex) return '';
  const re = new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[a-z']*", 'i');
  const m = ex.match(re);
  if (!m) return '';
  return esc(ex.slice(0, m.index)) + '<span class="blank">　　　</span>' + esc(ex.slice(m.index + m[0].length));
}

export function writePrompt(ctx, w, { base = 12, label = '✍️ 쓰기 찬스' } = {}) {
  return new Promise((resolve) => {
    if (ctx.ended) return resolve(false);
    const ans = w.en.trim();
    const target = norm(ans);
    let tries = 0, revealed = 0, done = false, closing = false;
    const sent = blankSentence(w.ex, ans);
    const ov = h(`<div class="write-ov"><div class="write-card pop-in">
      <div class="w-label">${label} <span class="x2">점수 ×2</span></div>
      <div class="w-ko">${esc(w.ko)}</div>
      ${sent ? `<div class="w-ex">${sent}</div>` : ''}
      <div class="w-slots"></div>
      <form class="w-form"><input class="w-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="영어로 써 보세요" aria-label="영어로 쓰기"><button class="btn primary">확인 ⏎</button></form>
      <div class="w-tip">⏳ 쓰는 동안은 시간이 절반 속도로 흘러요 · 💡 힌트 = 한 글자 보기</div>
    </div></div>`);
    ctx.stage.append(ov);
    const card = ov.querySelector('.write-card');
    const inp = ov.querySelector('.w-in');
    const slots = ov.querySelector('.w-slots');
    const tip = ov.querySelector('.w-tip');

    function renderSlots(showAll = false, cls = '') {
      const typed = inp.value;
      slots.innerHTML = [...ans]
        .map((ch, i) => {
          if (ch === ' ') return '<i class="gap"></i>';
          if (showAll) return `<span class="slot ${cls}">${esc(ch)}</span>`;
          if (typed[i] && typed[i] !== ' ') return `<span class="slot typed">${esc(typed[i])}</span>`;
          if (i < revealed) return `<span class="slot hint">${esc(ch)}</span>`;
          return '<span class="slot"></span>';
        })
        .join('');
    }
    renderSlots();
    inp.addEventListener('input', () => renderSlots());
    setTimeout(() => inp.focus(), 60);

    ctx.timer.rate = 0.5;
    function finish(ok) {
      if (done) return;
      done = true;
      ctx.timer.rate = 1;
      if (ctx.activeWrite === api) ctx.activeWrite = null;
      ov.classList.add('out');
      setTimeout(() => { ov.remove(); resolve(ok); }, ok ? 320 : 120);
    }

    ov.querySelector('.w-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (done || closing) return;
      const v = norm(inp.value);
      if (!v) return;
      if (v === target) {
        closing = true;
        renderSlots(true, 'ok');
        card.classList.add('ok');
        ctx.award(base, { writing: true, el: slots });
        sfx.write();
        burst(slots, 20);
        setTimeout(() => finish(true), 450);
        return;
      }
      tries++;
      if (tries === 1) {
        shake(card);
        sfx.bad();
        revealed = Math.max(revealed, 1);
        inp.value = '';
        renderSlots();
        tip.textContent = '아깝다! 첫 글자를 보여 줄게요. 한 번 더!';
        inp.focus();
      } else {
        closing = true;
        ctx.miss(card);
        renderSlots(true, 'bad');
        tip.innerHTML = `정답은 <b>${esc(ans)}</b> — 다음엔 맞힐 수 있어요!`;
        setTimeout(() => finish(false), 1500);
      }
    });

    const api = {
      item(id) {
        if (done || closing) return false;
        if (id === 'hint') {
          if (revealed >= ans.length - 1) return false;
          revealed++;
          inp.value = ans.slice(0, revealed);
          renderSlots();
          inp.focus();
          return true;
        }
        if (id === 'skip') { finish(false); return true; }
        return false;
      },
      close() { finish(false); },
    };
    ctx.activeWrite = api;
  });
}
