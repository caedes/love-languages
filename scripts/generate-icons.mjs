// Fabrique les icônes du site à partir de la grille de cœur en pixel art.
// À relancer (`pnpm icons`) seulement quand le motif ou les couleurs changent :
// les fichiers produits sont versionnés dans public/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heartGrid } from '../src/icons/heart.js';
import { PALETTE } from '../src/icons/palette.js';
import { encodePng } from '../src/icons/png.js';
import { composeRgb } from '../src/icons/raster.js';
import { toSvg } from '../src/icons/svg.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// `coverage` est la part du plus petit côté occupée par la grille. 1 laisse déjà
// une marge : la grille porte deux cellules vides sur son pourtour.
const IMAGES = [
  { nom: 'favicon-96.png', width: 96, height: 96 },
  { nom: 'apple-touch-icon.png', width: 180, height: 180 },
  { nom: 'icon-192.png', width: 192, height: 192 },
  { nom: 'icon-512.png', width: 512, height: 512 },
  // Android rogne l'icône maskable selon la forme du lanceur : seuls les 80 %
  // centraux sont garantis visibles, d'où un cœur nettement plus petit.
  { nom: 'icon-maskable-512.png', width: 512, height: 512, coverage: 0.72 },
  { nom: 'og-image.png', width: 1200, height: 630, coverage: 0.8 },
];

const grid = heartGrid();

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, 'favicon.svg'), toSvg(grid, { palette: PALETTE }));
console.log('favicon.svg');

for (const { nom, ...taille } of IMAGES) {
  writeFileSync(join(PUBLIC, nom), encodePng(composeRgb(grid, { ...taille, palette: PALETTE })));
  console.log(nom);
}
