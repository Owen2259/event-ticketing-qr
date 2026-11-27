const { createQrMatrix, makeErrorBytes } = require('../src/services/qr-code');
const { matrixToPng } = require('../src/services/png');

// The finder pattern: the 7 x 7 square drawn in three corners of every QR code
const FINDER = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######'];

// Reads a 7 x 7 block of the matrix as text, so we can compare it with FINDER
function readBlock(matrix, top, left) {
  return FINDER.map((_, row) =>
    matrix[top + row].slice(left, left + 7).map((isDark) => (isDark ? '#' : '.')).join('')
  );
}

describe('QR code generator', () => {
  test('makes a 21 x 21 grid', () => {
    const matrix = createQrMatrix('A7K2-9QX4');

    expect(matrix.length).toBe(21);
    expect(matrix.every((row) => row.length === 21)).toBe(true);
  });

  test('draws the finder pattern in three corners', () => {
    const matrix = createQrMatrix('A7K2-9QX4');

    expect(readBlock(matrix, 0, 0)).toEqual(FINDER);   // top left
    expect(readBlock(matrix, 0, 14)).toEqual(FINDER);  // top right
    expect(readBlock(matrix, 14, 0)).toEqual(FINDER);  // bottom left
  });

  test('the same text always gives the same code, and different text does not', () => {
    expect(createQrMatrix('A7K2-9QX4')).toEqual(createQrMatrix('A7K2-9QX4'));
    expect(createQrMatrix('A7K2-9QX4')).not.toEqual(createQrMatrix('B8M3-4WZ5'));
  });

  test('error correction bytes match the QR standard worked example', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];

    expect(makeErrorBytes(data)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  test('text that is too long is rejected', () => {
    expect(() => createQrMatrix('THIS-TEXT-IS-FAR-TOO-LONG')).toThrow();
  });
});

describe('PNG writer', () => {
  test('makes a PNG file of the expected size', () => {
    const png = matrixToPng(createQrMatrix('A7K2-9QX4'), 8, 4);
    const signature = [...png.subarray(0, 8)];

    expect(signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe((21 + 4 * 2) * 8); // width in pixels
  });
});