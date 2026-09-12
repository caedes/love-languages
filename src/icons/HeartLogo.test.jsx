import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeartLogo } from './HeartLogo.jsx';
import { BG, heartGrid } from './heart.js';
import { PALETTE } from './palette.js';

const rects = (container) => [...container.querySelectorAll('rect')];

describe('logo du cœur', () => {
  // La grille laisse trois lignes vides en haut et en bas : cadrer sur 0 0 16 16
  // afficherait un cœur perdu dans du vide. Les bornes ci-dessous sont celles du
  // dessin liseré compris — deux lobes larges de la colonne 1 à la colonne 14,
  // pointe descendant jusqu'à la ligne 13.
  it('cadre le dessin au plus près, sans marge morte', () => {
    const { container } = render(<HeartLogo />);

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '1 2 14 12');
  });

  it('peint une cellule par pixel du cœur', () => {
    const { container } = render(<HeartLogo />);

    const peintes = heartGrid()
      .flat()
      .filter((cell) => cell !== BG);
    expect(rects(container)).toHaveLength(peintes.length);
  });

  // Le haut de l'accueil est sur le dégradé radial, pas sur --color-bg : un
  // rectangle de fond s'y verrait comme un bloc plus sombre derrière le cœur.
  it('ne peint aucun fond, pour laisser passer le dégradé de la page', () => {
    const { container } = render(<HeartLogo />);

    const fonds = rects(container).filter((r) => r.getAttribute('fill') === PALETTE[BG]);
    expect(fonds).toHaveLength(0);
  });

  // Seule la hauteur du logo est contrainte, pour qu'il cède sur un écran court.
  // Sans ratio déclaré, la largeur ne suit pas et le cœur s'étire.
  it('garde les proportions du dessin quand seule sa hauteur est contrainte', () => {
    const { container } = render(<HeartLogo />);

    expect(container.querySelector('svg').style.aspectRatio).toBe('14 / 12');
  });

  // Corollaire du point précédent : quand son cadre est comprimé, le cœur suit.
  it('ne déborde jamais du cadre qui l’accueille', () => {
    const { container } = render(<HeartLogo />);

    expect(container.querySelector('svg')).toHaveStyle({ maxHeight: '100%' });
  });

  it('reste hors de l’arbre d’accessibilité, le titre nommant déjà l’app', () => {
    const { container } = render(<HeartLogo />);

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
