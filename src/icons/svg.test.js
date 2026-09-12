import { describe, expect, it } from 'vitest';
import { toSvg } from './svg.js';

const GRILLE = [
  [1, 0],
  [0, 2],
];
const PALETTE = ['#000000', '#ff0000', '#0000ff'];

describe('toSvg', () => {
  const svg = toSvg(GRILLE, { palette: PALETTE });

  it('cadre le dessin sur la grille', () => {
    expect(svg).toContain('viewBox="0 0 2 2"');
  });

  it('peint le fond sur toute la surface', () => {
    expect(svg).toContain('<rect width="2" height="2" fill="#000000"/>');
  });

  it('pose un rectangle d’une cellule par pixel non transparent', () => {
    expect(svg).toContain('<rect x="0" y="0" width="1" height="1" fill="#ff0000"/>');
    expect(svg).toContain('<rect x="1" y="1" width="1" height="1" fill="#0000ff"/>');
    expect(svg.match(/<rect /g)).toHaveLength(3);
  });

  it('demande au rendu de ne pas lisser les bords', () => {
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});
