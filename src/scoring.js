import { DATA, DIM_COLOR, DIM_NAME, levelFor } from './questionnaire.js';

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

/**
 * Les dimensions où l'un est en langage primaire (9-12) et l'autre en canal neutre (0-4).
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function vigilanceList(answers, names) {
  const a = scores(answers[0]);
  const b = scores(answers[1]);
  const out = [];
  DATA.meta.dimensions.forEach((d) => {
    const av = a[d.code];
    const bv = b[d.code];
    if (av >= 9 && bv <= 4) out.push({ strong: names[0], weak: names[1], dim: d.nom, color: DIM_COLOR[d.code] });
    else if (bv >= 9 && av <= 4) out.push({ strong: names[1], weak: names[0], dim: d.nom, color: DIM_COLOR[d.code] });
  });
  return out;
}

/**
 * Les items où les deux n'ont pas retenu la même dimension.
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function divergenceList(answers, names) {
  const out = [];
  DATA.items.forEach((item, i) => {
    const ca = answers[0][i];
    const cb = answers[1][i];
    if (!ca || !cb || ca === cb) return;
    const ta = item.options.find((o) => o.code === ca);
    const tb = item.options.find((o) => o.code === cb);
    out.push({
      id: item.id,
      nameA: names[0], nameB: names[1],
      dimA: DIM_NAME[ca], dimB: DIM_NAME[cb],
      textA: ta ? ta.texte : '', textB: tb ? tb.texte : '',
      colorA: DIM_COLOR[ca], colorB: DIM_COLOR[cb]
    });
  });
  return out;
}

/**
 * La synthèse textuelle des deux profils, telle qu'elle est copiée dans le presse-papiers.
 * @param {[string[], string[]]} answers
 * @param {[string, string]} names
 */
export function summaryText(answers, names) {
  const lines = [DATA.meta.titre, ''];
  [0, 1].forEach((who) => {
    lines.push(names[who].toUpperCase());
    profileRows(answers[who]).forEach((r) => {
      lines.push('  ' + r.score + '/12  ' + r.nom + '  (' + r.niveau + ')');
    });
    lines.push('  Total de contrôle : ' + answers[who].filter(Boolean).length + '/30');
    lines.push('');
  });
  lines.push('POINTS DE VIGILANCE');
  const vig = vigilanceList(answers, names);
  if (!vig.length) lines.push('  Aucun écart de ce type.');
  vig.forEach((v) => {
    lines.push('  ' + v.strong + ' a un besoin fort de ' + v.dim + ', une dimension peu sensible chez ' + v.weak + '.');
  });
  lines.push('');
  const div = divergenceList(answers, names);
  lines.push('ITEMS DIVERGENTS (' + div.length + ')');
  div.forEach((x) => {
    lines.push('  Item ' + x.id);
    lines.push('    ' + x.nameA + ' — ' + x.textA);
    lines.push('    ' + x.nameB + ' — ' + x.textB);
  });
  return lines.join('\n');
}

/**
 * Vrai quand les deux participants ont répondu à tous les items du questionnaire.
 * @param {[Array<string|null|undefined>, Array<string|null|undefined>]} answers
 * @returns {boolean}
 */
export function passationTerminee(answers) {
  return answers[0].filter(Boolean).length === DATA.items.length
    && answers[1].filter(Boolean).length === DATA.items.length;
}

/** Un ordre d'affichage tiré au sort par item, pour éviter le biais de position. */
export function makeOrders() {
  return DATA.items.map(() => (Math.random() < 0.5 ? 1 : 0));
}

/**
 * La position à l'écran (0 ou 1) d'une dimension sur un item donné.
 * @param {string} code
 * @param {object} item
 * @param {boolean} flipped
 * @returns {0|1|null}
 */
export function slotFor(code, item, flipped) {
  const i = item.options.findIndex((o) => o.code === code);
  if (i < 0) return null;
  return flipped ? 1 - i : i;
}

/**
 * La dimension affichée à une position donnée : l'inverse exact de `slotFor`.
 * @param {object} item
 * @param {boolean} flipped
 * @param {0|1} slot
 */
export function codeAt(item, flipped, slot) {
  return item.options[flipped ? 1 - slot : slot].code;
}
