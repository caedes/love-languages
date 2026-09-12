import { describe, it, expect } from 'vitest';
import { heartGrid, BG, FILL, OUTLINE } from './heart.js';

const voisins = (grid, x, y) => {
  const out = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const ligne = grid[y + dy];
      if (ligne && ligne[x + dx] !== undefined) out.push(ligne[x + dx]);
    }
  }
  return out;
};

const cellules = (grid, valeur) => {
  const out = [];
  grid.forEach((ligne, y) => ligne.forEach((cell, x) => {
    if (cell === valeur) out.push([x, y]);
  }));
  return out;
};

describe('heartGrid', () => {
  it('rend une grille carrée de 16 cellules de côté', () => {
    const grid = heartGrid();
    expect(grid).toHaveLength(16);
    grid.forEach((ligne) => expect(ligne).toHaveLength(16));
  });

  it('dessine une forme symétrique par rapport à l’axe vertical', () => {
    heartGrid().forEach((ligne) => {
      expect(ligne).toEqual([...ligne].reverse());
    });
  });

  it('entoure complètement le remplissage d’un contour', () => {
    const grid = heartGrid();
    const fuites = cellules(grid, FILL).filter(([x, y]) => voisins(grid, x, y).includes(BG));
    expect(fuites).toEqual([]);
  });

  it('ne pose de contour qu’au contact du remplissage', () => {
    const grid = heartGrid();
    const orphelins = cellules(grid, OUTLINE).filter(([x, y]) => !voisins(grid, x, y).includes(FILL));
    expect(orphelins).toEqual([]);
  });

  it('laisse la bordure de la grille libre pour que le contour tienne', () => {
    const grid = heartGrid();
    const bord = [...grid[0], ...grid[15], ...grid.map((l) => l[0]), ...grid.map((l) => l[15])];
    expect(bord.every((cell) => cell === BG)).toBe(true);
  });

  it('ouvre la forme sur deux lobes en haut', () => {
    const grid = heartGrid();
    const premiere = grid.find((ligne) => ligne.includes(FILL));
    const colonnesPleines = premiere.flatMap((c, x) => (c === FILL ? [x] : []));
    const creux = colonnesPleines.filter((x, i) => i > 0 && x - colonnesPleines[i - 1] > 1);
    expect(creux).toHaveLength(1);
  });

  it('referme la forme sur une pointe de deux cellules en bas', () => {
    const grid = heartGrid();
    const derniere = [...grid].reverse().find((ligne) => ligne.includes(FILL));
    expect(derniere.filter((c) => c === FILL)).toHaveLength(2);
  });
});
