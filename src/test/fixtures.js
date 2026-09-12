import { DATA } from '../questionnaire.js';

/** Une passation où l'on choisit toujours la première proposition du JSON. */
export const REPONSES_PREMIERE_OPTION = DATA.items.map((i) => i.options[0].code);

/** Une passation où l'on choisit toujours la seconde. */
export const REPONSES_SECONDE_OPTION = DATA.items.map((i) => i.options[1].code);

/**
 * La première passation, mais avec la seconde proposition sur les items visés.
 * @param {number[]} indices index (base 0) des items à basculer
 */
export function reponsesAvecDivergences(indices) {
  const out = REPONSES_PREMIERE_OPTION.slice();
  indices.forEach((i) => { out[i] = DATA.items[i].options[1].code; });
  return out;
}
