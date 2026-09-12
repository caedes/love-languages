import { deflateSync } from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BITS_PAR_CANAL = 8;
const TYPE_COULEUR_RVB = 2;
const FILTRE_AUCUN = 0;

// Table CRC-32 de la spécification PNG. La dresser une fois coûte moins que
// d'ajouter une dépendance pour trois chunks par fichier.
const TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/**
 * Le CRC-32 d'une suite d'octets, tel que l'attend un chunk PNG.
 * @param {Uint8Array} octets
 * @returns {number} entier non signé sur 32 bits
 */
export function crc32(octets) {
  let c = 0xffffffff;
  for (const octet of octets) c = TABLE[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Un chunk complet : taille, type, données, CRC.
 * @param {string} type
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function chunk(type, data) {
  const out = new Uint8Array(data.length + 12);
  const vue = new DataView(out.buffer);
  vue.setUint32(0, data.length);
  [...type].forEach((c, i) => { out[4 + i] = c.charCodeAt(0); });
  out.set(data, 8);
  vue.setUint32(data.length + 8, crc32(out.slice(4, data.length + 8)));
  return out;
}

/**
 * Encode une image RVB 8 bits en PNG sans perte.
 * @param {{ width: number, height: number, data: Uint8Array }} image octets RVB, ligne par ligne
 * @returns {Uint8Array} le fichier PNG complet
 */
export function encodePng({ width, height, data }) {
  const parLigne = width * 3;
  if (data.length !== parLigne * height) {
    throw new Error(`données insuffisantes : ${data.length} octets pour ${width}×${height}`);
  }

  const ihdr = new Uint8Array(13);
  const vue = new DataView(ihdr.buffer);
  vue.setUint32(0, width);
  vue.setUint32(4, height);
  ihdr[8] = BITS_PAR_CANAL;
  ihdr[9] = TYPE_COULEUR_RVB;

  // Chaque ligne est précédée de son octet de filtre. Sur de l'aplat, le filtre
  // « aucun » se compresse déjà très bien : inutile d'en essayer d'autres.
  const brut = new Uint8Array((parLigne + 1) * height);
  for (let y = 0; y < height; y += 1) {
    brut[y * (parLigne + 1)] = FILTRE_AUCUN;
    brut.set(data.subarray(y * parLigne, (y + 1) * parLigne), y * (parLigne + 1) + 1);
  }

  const morceaux = [
    Uint8Array.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(brut, { level: 9 }))),
    chunk('IEND', new Uint8Array(0))
  ];

  const png = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  morceaux.reduce((offset, m) => { png.set(m, offset); return offset + m.length; }, 0);
  return png;
}
