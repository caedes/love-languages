import QUESTIONNAIRE from './data/langages-amour-questions.json';

/** Les données du questionnaire, importées depuis le JSON voisin. */
export const DATA = QUESTIONNAIRE;

/** Clé de sauvegarde locale de la passation en cours. */
export const STORAGE_KEY = 'langages-amour-v1';

/** Une couleur propre à chaque dimension, réutilisée dans les barres et les divergences. */
export const DIM_COLOR = {
  P: 'oklch(0.74 0.105 289)',
  M: 'oklch(0.75 0.085 232)',
  C: 'oklch(0.79 0.085 78)',
  S: 'oklch(0.78 0.075 163)',
  T: 'oklch(0.75 0.095 18)'
};

export const DIM_NAME = {};
DATA.meta.dimensions.forEach((d) => { DIM_NAME[d.code] = d.nom; });

export const SEL_BG = 'color-mix(in srgb, var(--color-accent) 34%, var(--color-surface))';
export const SEL_BORDER = 'var(--color-accent)';
export const OFF_BG = 'color-mix(in srgb, var(--color-text) 12%, transparent)';
export const OFF_BORDER = 'color-mix(in srgb, var(--color-text) 28%, transparent)';

/**
 * Le niveau d'interprétation correspondant à un score, lu dans `meta.interpretation`.
 * @param {number} score
 */
export function levelFor(score) {
  const bands = DATA.meta.interpretation;
  return bands.find((b) => score >= b.min && score <= b.max) || bands[bands.length - 1];
}

/**
 * L'élision française devant un prénom : « d'Alice » mais « de Bruno ».
 * @param {string} name
 */
export function de(name) {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name || '') ? "d'" : 'de ';
}
