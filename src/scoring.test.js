import { describe, it, expect } from 'vitest';
import { resolveNames, scores, profileRows, vigilanceList, divergenceList, summaryText } from './scoring.js';
import { REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION, reponsesAvecDivergences } from './test/fixtures.js';

describe('resolveNames', () => {
  it('retire les espaces autour des prénoms saisis', () => {
    expect(resolveNames('  Alice ', 'Bob  ')).toEqual(['Alice', 'Bob']);
  });

  it('replie sur des prénoms génériques quand la saisie est vide', () => {
    expect(resolveNames('', '   ')).toEqual(['Personne 1', 'Personne 2']);
  });

  it('ne replie que le prénom manquant', () => {
    expect(resolveNames('Alice', '')).toEqual(['Alice', 'Personne 2']);
  });
});

describe('scores', () => {
  it('compte les choix par dimension sur une passation complète', () => {
    expect(scores(REPONSES_PREMIERE_OPTION)).toEqual({ P: 9, M: 7, C: 5, S: 4, T: 5 });
    expect(scores(REPONSES_SECONDE_OPTION)).toEqual({ P: 3, M: 5, C: 7, S: 8, T: 7 });
  });

  it('rend les cinq dimensions à zéro sur une passation vierge', () => {
    expect(scores([])).toEqual({ P: 0, M: 0, C: 0, S: 0, T: 0 });
  });

  it('ignore les items sans réponse', () => {
    const partielle = REPONSES_PREMIERE_OPTION.slice();
    partielle[0] = null;
    partielle[5] = undefined;
    const total = Object.values(scores(partielle)).reduce((a, b) => a + b, 0);
    expect(total).toBe(28);
  });
});

describe('profileRows', () => {
  it('trie les cinq dimensions par score décroissant', () => {
    const lignes = profileRows(REPONSES_PREMIERE_OPTION);
    expect(lignes.map((l) => l.code)).toEqual(['P', 'M', 'C', 'T', 'S']);
  });

  it('calcule le pourcentage arrondi sur le score maximal', () => {
    const lignes = profileRows(REPONSES_PREMIERE_OPTION);
    expect(lignes[0]).toMatchObject({ code: 'P', score: 9, pct: 75, niveau: 'Langage primaire' });
    expect(lignes[4]).toMatchObject({ code: 'S', score: 4, pct: 33, niveau: 'Canal neutre' });
  });

  it('conserve les dimensions jamais choisies, à zéro', () => {
    const lignes = profileRows([]);
    expect(lignes).toHaveLength(5);
    lignes.forEach((l) => {
      expect(l.score).toBe(0);
      expect(l.pct).toBe(0);
      expect(l.niveau).toBe('Canal neutre');
    });
  });

  it('porte le nom et la couleur de chaque dimension', () => {
    const [premiere] = profileRows(REPONSES_PREMIERE_OPTION);
    expect(premiere.nom).toBe('Paroles valorisantes');
    expect(premiere.color).toMatch(/^oklch\(/);
  });
});

const NOMS = ['Alice', 'Bob'];

/** Une passation dont on force les scores, sans passer par les 30 items réels. */
function passationForcee(repartition) {
  const out = [];
  Object.entries(repartition).forEach(([code, n]) => {
    for (let i = 0; i < n; i += 1) out.push(code);
  });
  return out;
}

describe('vigilanceList', () => {
  it('signale une dimension primaire chez l’un et neutre chez l’autre', () => {
    const a = passationForcee({ P: 9, M: 3 });
    const b = passationForcee({ P: 4, M: 8 });
    const vig = vigilanceList([a, b], NOMS);
    expect(vig).toHaveLength(1);
    expect(vig[0]).toMatchObject({ strong: 'Alice', weak: 'Bob', dim: 'Paroles valorisantes' });
  });

  it('signale l’écart dans l’autre sens', () => {
    const a = passationForcee({ P: 4 });
    const b = passationForcee({ P: 9 });
    expect(vigilanceList([a, b], NOMS)[0]).toMatchObject({ strong: 'Bob', weak: 'Alice' });
  });

  it('ne signale rien à 8 contre 4 : le seuil primaire n’est pas atteint', () => {
    const a = passationForcee({ P: 8 });
    const b = passationForcee({ P: 4 });
    expect(vigilanceList([a, b], NOMS)).toEqual([]);
  });

  it('ne signale rien à 9 contre 5 : le seuil neutre n’est pas atteint', () => {
    const a = passationForcee({ P: 9 });
    const b = passationForcee({ P: 5 });
    expect(vigilanceList([a, b], NOMS)).toEqual([]);
  });

  it('signale l’écart réel entre les deux fixtures de passation', () => {
    const vig = vigilanceList([REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION], NOMS);
    expect(vig).toHaveLength(1);
    expect(vig[0]).toMatchObject({ strong: 'Alice', weak: 'Bob', dim: 'Paroles valorisantes' });
  });
});

describe('divergenceList', () => {
  it('ne retient que les items où les deux ont choisi une dimension différente', () => {
    const b = reponsesAvecDivergences([0, 3]);
    const div = divergenceList([REPONSES_PREMIERE_OPTION, b], NOMS);
    expect(div.map((d) => d.id)).toEqual([1, 4]);
  });

  it('porte les prénoms, dimensions et textes des deux choix', () => {
    const b = reponsesAvecDivergences([0]);
    const [premier] = divergenceList([REPONSES_PREMIERE_OPTION, b], NOMS);
    expect(premier).toMatchObject({
      nameA: 'Alice',
      nameB: 'Bob',
      dimA: 'Paroles valorisantes',
      dimB: 'Contact physique'
    });
    expect(premier.textA).toMatch(/compliments/);
    expect(premier.textB).toMatch(/bras/);
  });

  it('ignore les items auxquels l’un des deux n’a pas répondu', () => {
    const a = REPONSES_PREMIERE_OPTION.slice();
    const b = reponsesAvecDivergences([0, 3]);
    a[0] = null;
    expect(divergenceList([a, b], NOMS).map((d) => d.id)).toEqual([4]);
  });

  it('rend une liste vide quand les deux passations sont identiques', () => {
    expect(divergenceList([REPONSES_PREMIERE_OPTION, REPONSES_PREMIERE_OPTION], NOMS)).toEqual([]);
  });
});

describe('summaryText', () => {
  it('rend la synthèse d’une passation quasi identique', () => {
    const b = reponsesAvecDivergences([0, 1]);
    expect(summaryText([REPONSES_PREMIERE_OPTION, b], NOMS)).toMatchInlineSnapshot(`
      "Les 5 langages de l'amour — questionnaire à choix forcés

      ALICE
        9/12  Paroles valorisantes  (Langage primaire)
        7/12  Moments de qualité  (Langage secondaire)
        5/12  Cadeaux  (Canal intermédiaire)
        5/12  Contact physique  (Canal intermédiaire)
        4/12  Services rendus  (Canal neutre)
        Total de contrôle : 30/30

      BOB
        8/12  Paroles valorisantes  (Langage secondaire)
        6/12  Moments de qualité  (Langage secondaire)
        6/12  Contact physique  (Langage secondaire)
        5/12  Cadeaux  (Canal intermédiaire)
        5/12  Services rendus  (Canal intermédiaire)
        Total de contrôle : 30/30

      POINTS DE VIGILANCE
        Aucun écart de ce type.

      ITEMS DIVERGENTS (2)
        Item 1
          Alice — J'aime recevoir des compliments sincères et des encouragements.
          Bob — J'aime qu'on me prenne spontanément dans les bras ou qu'on me tienne la main.
        Item 2
          Alice — J'apprécie qu'on passe un moment seul à seul, sans interruptions ni distractions.
          Bob — J'apprécie quand mon/ma partenaire m'aide sur une tâche pénible sans que j'aie à demander."
    `);
  });

  it('mentionne l’absence d’écart quand aucune vigilance ne se déclenche', () => {
    const texte = summaryText([REPONSES_PREMIERE_OPTION, REPONSES_PREMIERE_OPTION], NOMS);
    expect(texte).toContain('Aucun écart de ce type.');
    expect(texte).toContain('ITEMS DIVERGENTS (0)');
  });

  it('reprend le total de contrôle de chaque participant', () => {
    const texte = summaryText([REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION], NOMS);
    expect(texte).toContain('Total de contrôle : 30/30');
  });
});
