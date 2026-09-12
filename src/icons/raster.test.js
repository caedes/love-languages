import { describe, expect, it } from 'vitest';
import { composeRgb } from './raster.js';

const GRILLE = [
  [1, 0],
  [0, 2],
];
const PALETTE = ['#000000', '#ff0000', '#0000ff'];
const pixel = ({ width, data }, x, y) => [
  ...data.slice((y * width + x) * 3, (y * width + x) * 3 + 3),
];

describe('composeRgb', () => {
  it('produit trois octets par pixel de l’image demandée', () => {
    const image = composeRgb(GRILLE, { width: 10, height: 4, palette: PALETTE });
    expect(image.width).toBe(10);
    expect(image.height).toBe(4);
    expect(image.data).toHaveLength(10 * 4 * 3);
  });

  it('agrandit chaque cellule en un bloc uniforme', () => {
    const image = composeRgb(GRILLE, { width: 4, height: 4, palette: PALETTE });
    expect(pixel(image, 0, 0)).toEqual([255, 0, 0]);
    expect(pixel(image, 1, 1)).toEqual([255, 0, 0]);
    expect(pixel(image, 2, 0)).toEqual([0, 0, 0]);
    expect(pixel(image, 3, 3)).toEqual([0, 0, 255]);
  });

  it('centre le motif et peint le reste avec la couleur de fond', () => {
    const image = composeRgb(GRILLE, { width: 8, height: 8, coverage: 0.5, palette: PALETTE });
    expect(pixel(image, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(image, 1, 1)).toEqual([0, 0, 0]);
    expect(pixel(image, 2, 2)).toEqual([255, 0, 0]);
    expect(pixel(image, 5, 5)).toEqual([0, 0, 255]);
    expect(pixel(image, 7, 7)).toEqual([0, 0, 0]);
  });

  it('centre aussi sur une image plus large que haute', () => {
    const image = composeRgb(GRILLE, { width: 12, height: 4, palette: PALETTE });
    expect(pixel(image, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(image, 4, 0)).toEqual([255, 0, 0]);
    expect(pixel(image, 11, 3)).toEqual([0, 0, 0]);
  });

  it('garde au moins une cellule d’un pixel quand la place manque', () => {
    const image = composeRgb(GRILLE, { width: 1, height: 1, palette: PALETTE });
    expect(image.data).toHaveLength(3);
  });
});
