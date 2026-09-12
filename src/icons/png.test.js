import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { crc32, encodePng } from './png.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Découpe un PNG en chunks { type, data, crcValide }. */
function chunks(png) {
  const vue = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out = [];
  let i = 8;
  while (i < png.length) {
    const taille = vue.getUint32(i);
    const type = String.fromCharCode(...png.slice(i + 4, i + 8));
    const data = png.slice(i + 8, i + 8 + taille);
    const crcLu = vue.getUint32(i + 8 + taille);
    out.push({ type, data, crcValide: crcLu === crc32(png.slice(i + 4, i + 8 + taille)) });
    i += taille + 12;
  }
  return out;
}

describe('crc32', () => {
  it('retrouve le vecteur de référence de la spécification', () => {
    expect(crc32(new Uint8Array([...'123456789'].map((c) => c.charCodeAt(0))))).toBe(0xcbf43926);
  });
});

describe('encodePng', () => {
  const image = { width: 2, height: 1, data: new Uint8Array([255, 0, 0, 0, 0, 255]) };

  it('commence par la signature PNG', () => {
    expect([...encodePng(image).slice(0, 8)]).toEqual(SIGNATURE);
  });

  it('enchaîne les chunks IHDR, IDAT puis IEND', () => {
    expect(chunks(encodePng(image)).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('signe chaque chunk avec un CRC valide', () => {
    expect(chunks(encodePng(image)).every((c) => c.crcValide)).toBe(true);
  });

  it('déclare les dimensions, 8 bits par canal et le type couleur RVB', () => {
    const ihdr = chunks(encodePng(image))[0].data;
    const vue = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
    expect(vue.getUint32(0)).toBe(2);
    expect(vue.getUint32(4)).toBe(1);
    expect(ihdr[8]).toBe(8);
    expect(ihdr[9]).toBe(2);
  });

  it('restitue les pixels, chaque ligne précédée de son octet de filtre', () => {
    const idat = chunks(encodePng({ width: 1, height: 2, data: new Uint8Array([1, 2, 3, 4, 5, 6]) }))[1];
    expect([...inflateSync(idat.data)]).toEqual([0, 1, 2, 3, 0, 4, 5, 6]);
  });

  it('refuse une image dont les données ne couvrent pas toutes les lignes', () => {
    expect(() => encodePng({ width: 2, height: 2, data: new Uint8Array(6) })).toThrow(/données/i);
  });
});
