const crypto = require('crypto');

// No 0, O, 1, I or L, so codes are easy to read and type at the door
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode() {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += '-';
  }
  return out; // for example "A7K2-9QX4"
}

module.exports = { generateCode };