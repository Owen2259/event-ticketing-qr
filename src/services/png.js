const zlib = require('zlib');

// A PNG writer, so we can turn the QR grid into an image file.

// PNG chunks end with a checksum (CRC32)
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A PNG file is a signature followed by chunks: length, type, data, checksum
function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));

  return Buffer.concat([length, typeAndData, checksum]);
}

// Draws a grid of true/false squares as black and white.
// "scale" is the width of one square in pixels, "margin" is the white border
// (in squares) that scanners need around a QR code.
function matrixToPng(matrix, scale = 8, margin = 4) {
  const imageSize = (matrix.length + margin * 2) * scale;

  // Each row of pixels starts with a 0 byte (meaning "no filter").
  // The Buffer starts filled with 255, which is white.
  const rowLength = imageSize + 1;
  const pixels = Buffer.alloc(rowLength * imageSize, 255);

  for (let y = 0; y < imageSize; y++) {
    pixels[y * rowLength] = 0;
    const row = Math.floor(y / scale) - margin;

    for (let x = 0; x < imageSize; x++) {
      const col = Math.floor(x / scale) - margin;
      const isDark = matrix[row] && matrix[row][col];
      if (isDark) pixels[y * rowLength + 1 + x] = 0;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(imageSize, 0); // width
  header.writeUInt32BE(imageSize, 4); // height
  header[8] = 8;                      // 8 bits per pixel
  header[9] = 0;                      // greyscale

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', header),
    makeChunk('IDAT', zlib.deflateSync(pixels)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { matrixToPng };