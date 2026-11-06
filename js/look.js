// 꾸미기(아바타·이름 효과·칭호)를 화면에 그리는 도우미 — 학생 화면·선생님 화면 같이 쓴다
import { COSMETICS } from './items.js';
import { avatar, esc } from './util.js';

export const avaOf = (p) => COSMETICS.avatar.list[p?.cos?.avatar]?.v || avatar(p?.num);
export const fxOf = (p) => COSMETICS.fx.list[p?.cos?.fx]?.v || '';
export const titleOf = (p) => COSMETICS.title.list[p?.cos?.title]?.v || '';
export const nameHtml = (p) =>
  `<span class="pname ${fxOf(p)}">${esc(p?.name)}</span>${titleOf(p) ? `<small class="ptitle">${esc(titleOf(p))}</small>` : ''}`;
