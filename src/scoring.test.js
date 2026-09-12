import { describe, it, expect } from 'vitest';
import { resolveNames, scores, profileRows } from './scoring.js';
import { REPONSES_PREMIERE_OPTION, REPONSES_SECONDE_OPTION } from './test/fixtures.js';

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
