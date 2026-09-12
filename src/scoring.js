import { DATA, DIM_COLOR, levelFor } from './questionnaire.js';

/**
 * Les deux prénoms nettoyés, avec repli générique quand la saisie est vide.
 * @param {string} nameA
 * @param {string} nameB
 * @returns {[string, string]}
 */
export function resolveNames(nameA, nameB) {
  return [(nameA || '').trim() || 'Personne 1', (nameB || '').trim() || 'Personne 2'];
}

/**
 * Le nombre de choix par dimension pour un participant.
 * @param {Array<string|null|undefined>} answersOfOne
 */
export function scores(answersOfOne) {
  const out = { P: 0, M: 0, C: 0, S: 0, T: 0 };
  (answersOfOne || []).forEach((code) => { if (code) out[code] += 1; });
  return out;
}

/**
 * Les cinq dimensions d'un participant, triées du score le plus fort au plus faible.
 * @param {Array<string|null|undefined>} answersOfOne
 */
export function profileRows(answersOfOne) {
  const s = scores(answersOfOne);
  return DATA.meta.dimensions
    .map((d) => ({
      code: d.code,
      nom: d.nom,
      score: s[d.code],
      pct: Math.round((s[d.code] / DATA.meta.scoreMaxParDimension) * 100),
      color: DIM_COLOR[d.code],
      niveau: levelFor(s[d.code]).niveau
    }))
    .sort((a, b) => b.score - a.score);
}
