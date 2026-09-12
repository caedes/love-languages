/**
 * Rend une grille de pixel art en SVG : un rectangle de fond, puis un rectangle
 * d'une unité par cellule peinte. Le viewBox suit la grille, donc le fichier
 * reste net à n'importe quelle taille d'affichage.
 *
 * @param {number[][]} grid grille carrée d'indices de palette
 * @param {{ palette: string[] }} options la couleur d'indice 0 sert de fond
 * @returns {string}
 */
export function toSvg(grid, { palette }) {
  const cote = grid.length;
  const cellules = grid.flatMap((ligne, y) =>
    ligne.flatMap((cell, x) =>
      cell === 0 ? [] : [`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[cell]}"/>`],
    ),
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cote} ${cote}" shape-rendering="crispEdges">`,
    `<rect width="${cote}" height="${cote}" fill="${palette[0]}"/>`,
    ...cellules,
    '</svg>',
    '',
  ].join('\n');
}
