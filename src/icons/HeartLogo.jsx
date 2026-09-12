import { BG, heartGrid } from './heart.js';
import { PALETTE } from './palette.js';

/**
 * Les cellules peintes d'une grille de pixel art, dans l'ordre de lecture.
 * @param {number[][]} grid grille carrée d'indices de palette
 * @returns {Array<{ x: number, y: number, teinte: number }>}
 */
function cellulesPeintes(grid) {
  return grid.flatMap((ligne, y) =>
    ligne.flatMap((cell, x) => (cell === BG ? [] : [{ x, y, teinte: cell }])),
  );
}

/**
 * La boîte englobante d'une liste de cellules.
 * @param {Array<{ x: number, y: number }>} cellules
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function cadre(cellules) {
  const xs = cellules.map((c) => c.x);
  const ys = cellules.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
}

/**
 * Le cœur du site en SVG, dessiné à partir de la même grille que la favicon et
 * les icônes : un seul motif, une seule vérité.
 *
 * Deux écarts avec `favicon.svg`, qui interdisent de simplement pointer dessus
 * avec une balise `img` :
 *
 * - aucun rectangle de fond, parce que le haut de l'accueil est sur le dégradé
 *   radial de la page et non sur `--color-bg` : un fond opaque s'y verrait ;
 * - le `viewBox` serre le dessin, là où la grille garde trois lignes vides en
 *   haut et en bas — à l'échelle d'un logo, cette marge se voit.
 *
 * L'élément est décoratif : le titre de l'accueil nomme déjà l'application.
 *
 * @param {{ size?: string }} props hauteur CSS du logo, largeur déduite du ratio
 */
export function HeartLogo({ size = 'min(clamp(88px, 24vw, 128px), 14vh)' }) {
  const cellules = cellulesPeintes(heartGrid());
  const { x, y, width, height } = cadre(cellules);

  return (
    <svg
      viewBox={`${x} ${y} ${width} ${height}`}
      // Le pixel art perd son grain si le navigateur lisse les bords des cellules.
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        height: size,
        // Le cadre qui l'accueille peut être comprimé : le cœur suit plutôt que
        // de déborder.
        maxHeight: '100%',
        width: 'auto',
        aspectRatio: `${width} / ${height}`,
      }}
    >
      {cellules.map((c) => (
        <rect key={`${c.x} ${c.y}`} x={c.x} y={c.y} width="1" height="1" fill={PALETTE[c.teinte]} />
      ))}
    </svg>
  );
}
