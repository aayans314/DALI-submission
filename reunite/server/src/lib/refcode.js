import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L, 2/Z, 5/S, 8/B: these get confused when read aloud or
// handwritten. The code says nothing about which shelter the person is at.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

// e.g. "K7P-QX4"
export function newReferenceCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
