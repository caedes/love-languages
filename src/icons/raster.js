/**
 * Les trois composantes d'une couleur `#rrggbb`.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function rvb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Peint une grille de pixel art dans une image RVB, cellules agrandies en blocs entiers.
 *
 * La taille de cellule est arrondie à l'entier inférieur : le motif reste net,
 * quitte à occuper un peu moins que la couverture demandée. Le reste de l'image
 * prend la couleur de fond de la palette.
 *
 * @param {number[][]} grid grille carrée d'indices de palette
 * @param {{ width: number, height: number, coverage?: number, palette: string[] }} options
 * @returns {{ width: number, height: number, data: Uint8Array }}
 */
export function composeRgb(grid, { width, height, coverage = 1, palette }) {
  const couleurs = palette.map(rvb);
  const cellule = Math.max(1, Math.floor((Math.min(width, height) * coverage) / grid.length));
  const cote = cellule * grid.length;
  const gaucheX = Math.round((width - cote) / 2);
  const hautY = Math.round((height - cote) / 2);

  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const col = Math.floor((x - gaucheX) / cellule);
      const ligne = Math.floor((y - hautY) / cellule);
      const dansLaGrille = col >= 0 && col < grid.length && ligne >= 0 && ligne < grid.length;
      data.set(couleurs[dansLaGrille ? grid[ligne][col] : 0], (y * width + x) * 3);
    }
  }

  return { width, height, data };
}
