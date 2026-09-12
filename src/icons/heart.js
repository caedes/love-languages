/** Fond de la grille : aucune peinture. */
export const BG = 0;
/** Corps du cœur, peint en carmin. */
export const FILL = 1;
/** Liseré d'un pixel qui détoure le cœur du fond sombre. */
export const OUTLINE = 2;

/** Côté de la grille. Le cœur laisse une cellule libre sur tout le pourtour : c'est la place du liseré. */
const TAILLE = 16;

// Le cœur tel qu'on le dessinerait sur du papier quadrillé : deux lobes en haut,
// une pointe en bas, chaque ligne symétrique. Les lignes vides du haut et du bas
// portent la marge que le liseré vient occuper.
const DESSIN = [
  '................',
  '................',
  '................',
  '....###..###....',
  '...####..####...',
  '..############..',
  '..############..',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.......##.......',
  '................',
  '................',
  '................',
];

/**
 * Les huit voisines d'une cellule, bords de la grille exclus.
 * @param {number} x
 * @param {number} y
 * @returns {Array<[number, number]>}
 */
function voisines(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const vx = x + dx;
      const vy = y + dy;
      if (vx >= 0 && vx < TAILLE && vy >= 0 && vy < TAILLE) out.push([vx, vy]);
    }
  }
  return out;
}

/**
 * La grille du cœur en pixel art : le corps, puis le liseré déduit du corps.
 * Le liseré pousse vers l'extérieur plutôt que de manger le remplissage, pour que
 * la masse carmin reste entière même à 16 pixels de côté.
 * @returns {number[][]} grille 16×16 de BG, FILL ou OUTLINE
 */
export function heartGrid() {
  const grid = DESSIN.map((ligne) => [...ligne].map((c) => (c === '#' ? FILL : BG)));

  grid.forEach((ligne, y) => {
    ligne.forEach((cell, x) => {
      if (cell !== FILL) return;
      voisines(x, y).forEach(([vx, vy]) => {
        if (grid[vy][vx] === BG) grid[vy][vx] = OUTLINE;
      });
    });
  });

  return grid;
}
