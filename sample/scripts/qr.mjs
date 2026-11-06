/**
 * A small, dependency-free QR code encoder (ISO/IEC 18004 Model 2): byte mode, error correction L/M/Q/H, versions 1–40
 * picked automatically, the eight masks scored with the standard's four penalty rules. Written for this sample's
 * `npm run preview-qr` (an Astryx Preview link is ~150 bytes: version 7–8 at level M); exploration code, not a library.
 *
 *   import {encodeQr, renderTerminal, renderPng} from './qr.mjs';
 *   const qr = encodeQr('astryxneutral://preview?url=…', 'M');   // {size, version, modules: boolean[][] (row, column)}
 *   process.stdout.write(renderTerminal(qr));                   // half blocks, black on white (ANSI colors)
 *   fs.writeFileSync('qr.png', renderPng(qr));                  // 8-bit grayscale PNG
 */
import zlib from 'node:zlib';

// Per version (index 1–40): error correction codewords per block, and number of blocks, for each level.
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
// The two format-information bits for each level.
const LEVEL_BITS = {L: 1, M: 0, Q: 3, H: 2};

/** Modules available for data and error correction in a version (everything but function patterns). */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version, level) {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[level][version] * BLOCKS[level][version];
}

// GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
function gfMultiply(a, b) {
  let result = 0;
  for (let bit = 7; bit >= 0; bit -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> bit) & 1) * a;
  }
  return result & 0xff;
}

/** Reed–Solomon generator polynomial of `degree` (coefficients, highest power first, leading 1 omitted). */
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

/** Splits data into blocks, appends each block's error correction, and interleaves (ISO 18004 §7.6). */
function addErrorCorrection(data, version, level) {
  const blockCount = BLOCKS[level][version];
  const eccLength = ECC_PER_BLOCK[level][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLength = Math.floor(rawCodewords / blockCount);
  const divisor = rsDivisor(eccLength);
  const blocks = [];
  for (let i = 0, offset = 0; i < blockCount; i += 1) {
    const length = shortLength - eccLength + (i < shortBlocks ? 0 : 1);
    const chunk = data.slice(offset, offset + length);
    offset += length;
    const block = [...chunk, ...rsRemainder(chunk, divisor)];
    // A placeholder keeps short blocks aligned with long ones while interleaving; it is skipped below.
    if (i < shortBlocks) block.splice(shortLength - eccLength, 0, -1);
    blocks.push(block);
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    for (const block of blocks) if (block[i] !== -1) result.push(block[i]);
  }
  return result;
}

function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let position = version * 4 + 10; result.length < count; position -= step) result.splice(1, 0, position);
  return result;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Matrix {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({length: this.size}, () => new Array(this.size).fill(false));
    this.reserved = Array.from({length: this.size}, () => new Array(this.size).fill(false));
  }

  set(x, y, dark) {
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }

  drawFunctionPatterns() {
    const {size} = this;
    for (let i = 0; i < size; i += 1) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          this.set(x, y, distance !== 2 && distance !== 4);
        }
      }
    }
    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((cy, row) => {
      positions.forEach((cx, column) => {
        // Not over the three finder patterns.
        if ((row === 0 && column === 0) || (row === 0 && column === last) || (row === last && column === 0)) return;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      });
    });
    this.drawFormat('M', 0); // reserves the format areas; redrawn with the real mask
    this.drawVersion();
  }

  drawFormat(level, mask) {
    const {size} = this;
    const data = (LEVEL_BITS[level] << 3) | mask;
    let remainder = data;
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const bits = ((data << 10) | remainder) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i += 1) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) this.set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) this.set(8, size - 15 + i, bit(i));
    this.set(8, size - 8, true); // the dark module
  }

  drawVersion() {
    if (this.version < 7) return;
    let remainder = this.version;
    for (let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const bits = (this.version << 12) | remainder;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, dark);
      this.set(b, a, dark);
    }
  }

  drawCodewords(codewords) {
    const {size} = this;
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (!this.reserved[y][x] && index < codewords.length * 8) {
            this.modules[y][x] = ((codewords[index >>> 3] >>> (7 - (index & 7))) & 1) === 1;
            index += 1;
          }
        }
      }
    }
  }

  applyMask(mask) {
    const test = MASKS[mask];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) if (!this.reserved[y][x] && test(x, y)) this.modules[y][x] = !this.modules[y][x];
    }
  }

  penalty() {
    const {size, modules} = this;
    let score = 0;
    const line = (get) => {
      // Rule 1: runs of five or more; rule 3: finder-like 1:1:3:1:1 with four light modules on a side.
      let run = 1;
      for (let i = 1; i <= size; i += 1) {
        if (i < size && get(i) === get(i - 1)) run += 1;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      const pattern = [true, false, true, true, true, false, true];
      for (let i = 0; i + 7 <= size; i += 1) {
        if (!pattern.every((dark, k) => get(i + k) === dark)) continue;
        const lightBefore = [1, 2, 3, 4].every((k) => i - k < 0 || !get(i - k));
        const lightAfter = [0, 1, 2, 3].every((k) => i + 7 + k >= size || !get(i + 7 + k));
        if (lightBefore || lightAfter) score += 40;
      }
    };
    for (let y = 0; y < size; y += 1) line((x) => modules[y][x]);
    for (let x = 0; x < size; x += 1) line((y) => modules[y][x]);
    // Rule 2: 2×2 blocks of one color.
    for (let y = 0; y + 1 < size; y += 1) {
      for (let x = 0; x + 1 < size; x += 1) {
        const color = modules[y][x];
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) score += 3;
      }
    }
    // Rule 4: balance of dark and light.
    const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
}

/** Encodes `text` (UTF-8, byte mode) at `level` (default M) in the smallest version that fits. */
export function encodeQr(text, level = 'M') {
  if (!(level in BLOCKS)) throw new Error(`Unknown error correction level ${level}`);
  const bytes = [...Buffer.from(text, 'utf8')];
  let version = 1;
  for (; version <= 40; version += 1) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version, level) * 8) break;
  }
  if (version > 40) throw new Error('Text too long for a QR code');
  const capacity = dataCodewords(version, level) * 8;
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length)); // terminator
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  const codewords = addErrorCorrection(data, version, level);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = new Matrix(version);
    matrix.drawFunctionPatterns();
    matrix.drawCodewords(codewords);
    matrix.applyMask(mask);
    matrix.drawFormat(level, mask);
    const score = matrix.penalty();
    if (!best || score < best.score) best = {score, matrix, mask};
  }
  return {version, level, mask: best.mask, size: best.matrix.size, modules: best.matrix.modules};
}

/**
 * The code as terminal text, two modules per character (▀ ▄ █), with a quiet zone. `color` (default true) draws
 * black on white with ANSI escapes, so the code reads the same in light and dark terminals; without color, dark modules
 * are drawn as spaces and light ones as blocks, which suits a dark terminal background.
 */
export function renderTerminal(qr, {quiet = 2, color = true} = {}) {
  const size = qr.size + quiet * 2;
  const dark = (x, y) => {
    const mx = x - quiet;
    const my = y - quiet;
    return mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
  };
  const lines = [];
  for (let y = 0; y < size; y += 2) {
    let line = '';
    for (let x = 0; x < size; x += 1) {
      let top = dark(x, y);
      let bottom = y + 1 < size ? dark(x, y + 1) : false;
      if (!color) {
        top = !top;
        bottom = y + 1 < size ? !bottom : false;
      }
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(color ? `\x1b[30;107m${line}\x1b[0m` : line);
  }
  return `${lines.join('\n')}\n`;
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** The code as an 8-bit grayscale PNG: `scale` pixels per module, a four-module quiet zone. */
export function renderPng(qr, {scale = 8, quiet = 4} = {}) {
  const side = (qr.size + quiet * 2) * scale;
  const raw = Buffer.alloc((side + 1) * side, 255);
  for (let y = 0; y < side; y += 1) {
    raw[y * (side + 1)] = 0; // filter: none
    const my = Math.floor(y / scale) - quiet;
    for (let x = 0; x < side; x += 1) {
      const mx = Math.floor(x / scale) - quiet;
      if (mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx]) raw[y * (side + 1) + 1 + x] = 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
