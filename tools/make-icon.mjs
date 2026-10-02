// make-icon.mjs — 零依赖图标生成：把 图标.png（你给的那张）转成托盘用的 PNG 和 exe 用的多尺寸 ICO。
// 手写 PNG 解码 / 编码 / ICO 封装，不装任何图形库。用法: node tools/make-icon.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');
const SOURCE = path.join(ROOT, '图标.png');

/* ------------------------------------------------------------ PNG 解码 */
function decodePNG(buf) {
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('不是 PNG');
  let o = 8, w = 0, h = 0, depth = 0, color = 0, inter = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; inter = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || inter !== 0 || (color !== 6 && color !== 2)) {
    throw new Error(`暂只支持 8bit 非隔行的 RGB/RGBA（当前 depth=${depth} color=${color} interlace=${inter}）`);
  }
  const bpp = color === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 4);
  const line = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      line[i] = v & 0xff;
    }
    line.copy(prev);
    for (let x = 0; x < w; x++) {
      const s = x * bpp, d = (y * w + x) * 4;
      out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2];
      out[d + 3] = bpp === 4 ? line[s + 3] : 255;
    }
  }
  return { w, h, data: out };
}

/* ------------------------------------------------------------ 面积缩放
   预乘 alpha 再平均，缩到 16px 时边缘不会出黑边。 */
function resize(src, size) {
  const { w, h, data } = src;
  const out = Buffer.alloc(size * size * 4);
  const sx = w / size, sy = h / size;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const i = (yy * w + xx) * 4;
          const al = data[i + 3] / 255;
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += data[i + 3];
          n++;
        }
      }
      const d = (y * size + x) * 4;
      if (!n || !a) { out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0; continue; }
      const k = 255 / a;
      out[d] = Math.round(r * k);
      out[d + 1] = Math.round(g * k);
      out[d + 2] = Math.round(b * k);
      out[d + 3] = Math.round(a / n);
    }
  }
  return { w: size, h: size, data: out };
}

/* ------------------------------------------------------------ PNG 编码 */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------------- ICO */
function buildICO(sizes, src) {
  const imgs = sizes.map((s) => {
    const r = resize(src, s);
    return { s, png: encodePNG(r.w, r.h, r.data) };
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(imgs.length, 4);
  let off = 6 + imgs.length * 16;
  const entries = imgs.map(({ s, png }) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s;
    e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4);
    e.writeUInt32LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(off, 12);
    off += png.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...imgs.map((i) => i.png)]);
}

/* ---------------------------------------------------------------- main */
if (!fs.existsSync(SOURCE)) {
  console.error('找不到 ' + SOURCE + '，把图标 png 放到项目根目录再跑。');
  process.exit(1);
}
const src = decodePNG(fs.readFileSync(SOURCE));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.ico'), buildICO([16, 24, 32, 48, 64, 128, 256], src));
const big = resize(src, 256);
fs.writeFileSync(path.join(OUT, 'icon.png'), encodePNG(big.w, big.h, big.data));
console.log(`图标已生成：build/icon.ico（16/24/32/48/64/128/256）+ build/icon.png（托盘用，源图 ${src.w}×${src.h}）`);
