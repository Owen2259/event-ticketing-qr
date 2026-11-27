// A small QR code generator, written for this project (no QR library).
//
// It supports one size only: "version 1" (21 x 21 squares) with error
// correction level M. That holds up to 14 characters, which is enough for
// our 9-character ticket codes such as "A7K2-9QX4".
//
// How a QR code is made:
//   1. Turn the text into data bytes.
//   2. Add error correction bytes, so the code still scans if it is damaged.
//   3. Draw the fixed patterns (corner squares, timing lines, format bits).
//   4. Place the data bits into the remaining squares, then apply a mask.

const SIZE = 21;
const MAX_CHARACTERS = 14;
const DATA_BYTES = 16;   // data bytes that fit in a version 1-M code
const ERROR_BYTES = 10;  // error correction bytes added after the data

// Format bits for "error correction level M, mask 0", including the
// standard's own scrambling. These are the same for every version 1-M code.
const FORMAT_BITS = 0x5412;

// ---------- Step 1: text to data bytes ----------

function textToDataBytes(text) {
  if (text.length > MAX_CHARACTERS || /[^\x00-\x7F]/.test(text)) {
    throw new Error(`QR text must be ${MAX_CHARACTERS} or fewer ASCII characters.`);
  }

  const bits = [];
  const addBits = (value, count) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  addBits(0b0100, 4);       // mode: plain bytes
  addBits(text.length, 8);  // how many characters follow
  for (const character of text) addBits(character.charCodeAt(0), 8);

  // A short run of zeros marks the end, then we pad to a whole byte
  addBits(0, Math.min(4, DATA_BYTES * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }

  // Fill the unused space with the two padding bytes the standard asks for
  const padding = [0xec, 0x11];
  for (let i = 0; bytes.length < DATA_BYTES; i++) bytes.push(padding[i % 2]);
  return bytes;
}

// ---------- Step 2: error correction bytes (Reed-Solomon) ----------

// Multiplication in the number system QR codes use (arithmetic on bytes)
function multiply(a, b) {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >> 7) * 0x11d);
    result ^= ((b >> i) & 1) * a;
  }
  return result;
}

// The divisor polynomial for the chosen number of error correction bytes
function makeDivisor(degree) {
  const coefficients = new Array(degree).fill(0);
  coefficients[degree - 1] = 1;

  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      coefficients[j] = multiply(coefficients[j], root);
      if (j + 1 < degree) coefficients[j] ^= coefficients[j + 1];
    }
    root = multiply(root, 2);
  }
  return coefficients;
}

// Divide the data by the divisor. The remainder is the error correction bytes.
function makeErrorBytes(data) {
  const divisor = makeDivisor(ERROR_BYTES);
  const remainder = new Array(ERROR_BYTES).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    divisor.forEach((coefficient, i) => {
      remainder[i] ^= multiply(coefficient, factor);
    });
  }
  return remainder;
}

// ---------- Step 3: the fixed patterns ----------

// The grid remembers each square's colour, and which squares are fixed
// patterns (so we do not put data or the mask on them).
function makeGrid() {
  const rows = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  return { dark: rows(), fixed: rows() };
}

function setFixed(grid, row, col, isDark) {
  grid.dark[row][col] = isDark;
  grid.fixed[row][col] = true;
}

// The big square in three corners that scanners look for
function drawFinder(grid, centerRow, centerCol) {
  for (let dRow = -4; dRow <= 4; dRow++) {
    for (let dCol = -4; dCol <= 4; dCol++) {
      const row = centerRow + dRow;
      const col = centerCol + dCol;
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;

      const distance = Math.max(Math.abs(dRow), Math.abs(dCol));
      setFixed(grid, row, col, distance !== 2 && distance !== 4);
    }
  }
}

// The dotted lines between the finders
function drawTiming(grid) {
  for (let i = 0; i < SIZE; i++) {
    setFixed(grid, 6, i, i % 2 === 0);
    setFixed(grid, i, 6, i % 2 === 0);
  }
}

// Tells the scanner the error correction level and mask. Written twice.
function drawFormatBits(grid) {
  const bit = (i) => ((FORMAT_BITS >> i) & 1) === 1;

  // First copy, around the top-left finder
  for (let i = 0; i <= 5; i++) setFixed(grid, i, 8, bit(i));
  setFixed(grid, 7, 8, bit(6));
  setFixed(grid, 8, 8, bit(7));
  setFixed(grid, 8, 7, bit(8));
  for (let i = 9; i <= 14; i++) setFixed(grid, 8, 14 - i, bit(i));

  // Second copy, split between the other two finders
  for (let i = 0; i <= 7; i++) setFixed(grid, 8, SIZE - 1 - i, bit(i));
  for (let i = 8; i <= 14; i++) setFixed(grid, SIZE - 15 + i, 8, bit(i));
  setFixed(grid, SIZE - 8, 8, true); // one square that is always dark
}

// ---------- Step 4: data and mask ----------

// Fill the free squares with the data bits, in the zigzag order the
// standard uses: two columns at a time, from the right edge to the left.
function placeData(grid, codewords) {
  const totalBits = codewords.length * 8;
  let bitIndex = 0;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // column 6 is the timing line, skip it
    const goingUp = ((right + 1) & 2) === 0;

    for (let step = 0; step < SIZE; step++) {
      const row = goingUp ? SIZE - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid.fixed[row][col] || bitIndex >= totalBits) continue;
        const byte = codewords[bitIndex >> 3];
        grid.dark[row][col] = ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex++;
      }
    }
  }
}

// Flip every second data square. This breaks up large blocks of one colour,
// which makes the code easier to scan. (The standard allows 8 mask patterns;
// always use the first one, and FORMAT_BITS tells the scanner so.)
function applyMask(grid) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (!grid.fixed[row][col] && (row + col) % 2 === 0) {
        grid.dark[row][col] = !grid.dark[row][col];
      }
    }
  }
}

// Draw
// Returns a 21 x 21 grid of true (dark) and false (light) squares
function createQrMatrix(text) {
  const data = textToDataBytes(text);
  const codewords = data.concat(makeErrorBytes(data));

  const grid = makeGrid();
  drawTiming(grid);              // first, so the finders are drawn on top of it
  drawFinder(grid, 3, 3);
  drawFinder(grid, 3, SIZE - 4);
  drawFinder(grid, SIZE - 4, 3);
  drawFormatBits(grid);

  placeData(grid, codewords);
  applyMask(grid);
  return grid.dark;
}

module.exports = { createQrMatrix, makeErrorBytes };