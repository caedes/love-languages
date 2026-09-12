import { describe, it, expect } from 'vitest';
import { DATA, levelFor, de } from './questionnaire.js';

describe('intégrité du questionnaire', () => {
  it('contient le nombre d\'items annoncé par meta', () => {
    expect(DATA.items).toHaveLength(DATA.meta.nombreItems);
    expect(DATA.items).toHaveLength(30);
  });

  it('donne un identifiant unique à chaque item', () => {
    const ids = DATA.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('oppose deux dimensions connues et différentes à chaque item', () => {
    const codes = DATA.meta.dimensions.map((d) => d.code);
    DATA.items.forEach((item) => {
      expect(item.options).toHaveLength(2);
      expect(item.options[0].code).not.toBe(item.options[1].code);
      item.options.forEach((opt) => {
        expect(codes).toContain(opt.code);
        expect(opt.texte.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('propose chaque dimension exactement scoreMaxParDimension fois', () => {
    const compte = {};
    DATA.meta.dimensions.forEach((d) => { compte[d.code] = 0; });
    DATA.items.forEach((item) => item.options.forEach((opt) => { compte[opt.code] += 1; }));
    DATA.meta.dimensions.forEach((d) => {
      expect(compte[d.code]).toBe(DATA.meta.scoreMaxParDimension);
    });
  });

  it('verrouille l\'appariement des dimensions item par item', () => {
    const paires = DATA.items.map(
      (i) => i.id + ' ' + i.options[0].code + '/' + i.options[1].code
    );
    expect(paires).toMatchInlineSnapshot(`
      [
        "1 P/T",
        "2 M/S",
        "3 C/M",
        "4 S/T",
        "5 T/C",
        "6 M/P",
        "7 C/S",
        "8 P/C",
        "9 M/C",
        "10 P/S",
        "11 P/M",
        "12 S/T",
        "13 P/C",
        "14 M/T",
        "15 P/S",
        "16 T/M",
        "17 C/S",
        "18 P/T",
        "19 M/S",
        "20 C/T",
        "21 M/T",
        "22 P/S",
        "23 C/M",
        "24 T/P",
        "25 S/C",
        "26 M/P",
        "27 T/S",
        "28 P/C",
        "29 S/M",
        "30 T/C",
      ]
    `);
  });
});

describe('levelFor', () => {
  it.each([
    [12, 'Langage primaire'],
    [9, 'Langage primaire'],
    [8, 'Langage secondaire'],
    [6, 'Langage secondaire'],
    [5, 'Canal intermédiaire'],
    [4, 'Canal neutre'],
    [0, 'Canal neutre']
  ])('classe le score %i en « %s »', (score, niveau) => {
    expect(levelFor(score).niveau).toBe(niveau);
  });
});

describe('de', () => {
  it.each([
    ['Alice', "d'"],
    ['Élodie', "d'"],
    ['Bob', 'de '],
    ['', 'de '],
    [undefined, 'de ']
  ])('élide correctement devant %s', (prenom, attendu) => {
    expect(de(prenom)).toBe(attendu);
  });
});
