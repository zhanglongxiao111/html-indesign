// 图片文件头读取器（html-indesign #26 第二期）：每种格式用字节构造一个极小样本。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { IMAGE_HEADER_ERROR_CODES, readImageHeader } = require('../../src/shared/image-header');

function u16be(value) { const b = Buffer.alloc(2); b.writeUInt16BE(value); return b; }
function u16le(value) { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b; }
function u32be(value) { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; }
function u32le(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; }
function i32le(value) { const b = Buffer.alloc(4); b.writeInt32LE(value); return b; }
function ascii(text) { return Buffer.from(text, 'latin1'); }

function png(width, height) {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    u32be(13), ascii('IHDR'), u32be(width), u32be(height), Buffer.from([8, 6, 0, 0, 0]), u32be(0),
  ]);
}

// 小端 TIFF 结构，IFD0 只放给定的 SHORT/LONG 标签。
function tiffLE(tags) {
  const entries = tags.map(([tag, type, value]) => Buffer.concat([
    u16le(tag), u16le(type), u32le(1), type === 3 ? Buffer.concat([u16le(value), u16le(0)]) : u32le(value),
  ]));
  return Buffer.concat([ascii('II'), u16le(42), u32le(8), u16le(tags.length), ...entries, u32le(0)]);
}

function tiffBE(tags) {
  const entries = tags.map(([tag, type, value]) => Buffer.concat([
    u16be(tag), u16be(type), u32be(1), type === 3 ? Buffer.concat([u16be(value), u16be(0)]) : u32be(value),
  ]));
  return Buffer.concat([ascii('MM'), u16be(42), u32be(8), u16be(tags.length), ...entries, u32be(0)]);
}

function jpeg(width, height, { orientation = null, sof = 0xc0, fill = false } = {}) {
  const parts = [Buffer.from([0xff, 0xd8])];
  // APP0 JFIF，验证段跳读。
  const jfif = Buffer.concat([ascii('JFIF\u0000'), Buffer.from([1, 1, 0]), u16be(72), u16be(72), Buffer.from([0, 0])]);
  parts.push(Buffer.from([0xff, 0xe0]), u16be(jfif.length + 2), jfif);
  if (orientation != null) {
    const exif = Buffer.concat([ascii('Exif'), Buffer.from([0, 0]), tiffLE([[0x0112, 3, orientation]])]);
    parts.push(Buffer.from([0xff, 0xe1]), u16be(exif.length + 2), exif);
  }
  if (fill) parts.push(Buffer.from([0xff, 0xff]));
  const sofPayload = Buffer.concat([Buffer.from([8]), u16be(height), u16be(width), Buffer.from([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])]);
  parts.push(Buffer.from([0xff, sof]), u16be(sofPayload.length + 2), sofPayload);
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]));
  return Buffer.concat(parts);
}

function riff(chunk, payload) {
  const body = Buffer.concat([ascii('WEBP'), ascii(chunk), u32le(payload.length), payload]);
  return Buffer.concat([ascii('RIFF'), u32le(body.length), body]);
}

test('PNG 读 IHDR 宽高', () => {
  assert.deepEqual(readImageHeader(png(640, 480)), {
    format: 'png', width: 640, height: 480, orientation: null, storedWidth: 640, storedHeight: 480,
  });
});

test('JPEG 跳过 APP 段读 SOF 宽高，支持渐进式 SOF2 与填充字节', () => {
  const baseline = readImageHeader(jpeg(1280, 960));
  assert.equal(baseline.format, 'jpeg');
  assert.equal(baseline.width, 1280);
  assert.equal(baseline.height, 960);
  assert.equal(baseline.orientation, null);
  const progressive = readImageHeader(jpeg(300, 200, { sof: 0xc2, fill: true }));
  assert.equal(progressive.width, 300);
  assert.equal(progressive.height, 200);
});

test('JPEG EXIF 方向 5–8 宽高对调，1–4 不对调', () => {
  const rotated = readImageHeader(jpeg(4000, 3000, { orientation: 6 }));
  assert.deepEqual(rotated, {
    format: 'jpeg', width: 3000, height: 4000, orientation: 6, storedWidth: 4000, storedHeight: 3000,
  });
  const flipped = readImageHeader(jpeg(4000, 3000, { orientation: 3 }));
  assert.equal(flipped.width, 4000);
  assert.equal(flipped.orientation, 3);
});

test('GIF 读逻辑屏幕宽高', () => {
  const gif = Buffer.concat([ascii('GIF89a'), u16le(32), u16le(16), Buffer.from([0, 0, 0])]);
  const result = readImageHeader(gif);
  assert.equal(result.format, 'gif');
  assert.equal(result.width, 32);
  assert.equal(result.height, 16);
});

test('WebP 三种位流：VP8、VP8L、VP8X', () => {
  const lossy = riff('VP8 ', Buffer.concat([Buffer.from([0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a]), u16le(400), u16le(300), Buffer.alloc(4)]));
  assert.deepEqual([readImageHeader(lossy).format, readImageHeader(lossy).width, readImageHeader(lossy).height], ['webp', 400, 300]);
  const bits = (400 - 1) | ((300 - 1) << 14);
  const lossless = riff('VP8L', Buffer.concat([Buffer.from([0x2f]), u32le(bits)]));
  assert.deepEqual([readImageHeader(lossless).width, readImageHeader(lossless).height], [400, 300]);
  const canvas = Buffer.alloc(10);
  canvas.writeUIntLE(1920 - 1, 4, 3);
  canvas.writeUIntLE(1080 - 1, 7, 3);
  const extended = riff('VP8X', canvas);
  assert.deepEqual([readImageHeader(extended).width, readImageHeader(extended).height], [1920, 1080]);
});

test('BMP：BITMAPINFOHEADER（负高为自上而下）与 BITMAPCOREHEADER', () => {
  const info = Buffer.concat([ascii('BM'), Buffer.alloc(12), u32le(40), i32le(800), i32le(-600), Buffer.alloc(28)]);
  assert.deepEqual([readImageHeader(info).format, readImageHeader(info).width, readImageHeader(info).height], ['bmp', 800, 600]);
  const core = Buffer.concat([ascii('BM'), Buffer.alloc(12), u32le(12), u16le(64), u16le(48), Buffer.alloc(4)]);
  assert.deepEqual([readImageHeader(core).width, readImageHeader(core).height], [64, 48]);
});

test('TIFF 两种字节序，读 ImageWidth/ImageLength 与方向', () => {
  const little = readImageHeader(tiffLE([[0x0100, 4, 2400], [0x0101, 3, 1600]]));
  assert.deepEqual([little.format, little.width, little.height, little.orientation], ['tiff', 2400, 1600, null]);
  const big = readImageHeader(tiffBE([[0x0100, 3, 2400], [0x0101, 4, 1600], [0x0112, 3, 8]]));
  assert.deepEqual([big.width, big.height, big.orientation], [1600, 2400, 8]);
});

test('PSD / PSB 文件头', () => {
  const header = (version) => Buffer.concat([ascii('8BPS'), u16be(version), Buffer.alloc(6), u16be(3), u32be(2000), u32be(3000), u16be(8), u16be(3)]);
  assert.deepEqual([readImageHeader(header(1)).format, readImageHeader(header(1)).width, readImageHeader(header(1)).height], ['psd', 3000, 2000]);
  assert.equal(readImageHeader(header(2)).format, 'psb');
});

test('截断文件报 IMAGE_HEADER_TRUNCATED', () => {
  assert.throws(() => readImageHeader(png(10, 10).subarray(0, 20)), { code: IMAGE_HEADER_ERROR_CODES.TRUNCATED });
  const cut = jpeg(1280, 960);
  const sofAt = cut.indexOf(Buffer.from([0xff, 0xc0]));
  assert.throws(() => readImageHeader(cut.subarray(0, sofAt + 5)), { code: IMAGE_HEADER_ERROR_CODES.TRUNCATED });
  assert.throws(() => readImageHeader(Buffer.alloc(0)), { code: IMAGE_HEADER_ERROR_CODES.TRUNCATED });
});

test('未知格式与 BigTIFF 报 IMAGE_HEADER_UNSUPPORTED，PDF 不当栅格图读', () => {
  assert.throws(() => readImageHeader(ascii('%PDF-1.7\n%âãÏÓ\n')), { code: IMAGE_HEADER_ERROR_CODES.UNSUPPORTED });
  assert.throws(() => readImageHeader(ascii('hello world, not an image')), { code: IMAGE_HEADER_ERROR_CODES.UNSUPPORTED });
  assert.throws(() => readImageHeader(Buffer.concat([ascii('II'), u16le(43), Buffer.alloc(12)])), { code: IMAGE_HEADER_ERROR_CODES.UNSUPPORTED });
});

test('结构不合法报 IMAGE_HEADER_INVALID（JPEG 没有 SOF 就进入图像数据）', () => {
  const noSof = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
  assert.throws(() => readImageHeader(noSof), { code: IMAGE_HEADER_ERROR_CODES.INVALID });
});

test('只读文件头部必要字节：几 MB 的 JPEG 只读几十字节', () => {
  const big = Buffer.concat([jpeg(1280, 960, { orientation: 1 }), Buffer.alloc(4 * 1024 * 1024)]);
  let bytesRead = 0;
  const source = {
    read(offset, length) {
      const chunk = big.subarray(Math.min(offset, big.length), Math.min(offset + length, big.length));
      bytesRead += chunk.length;
      return chunk;
    },
  };
  assert.equal(readImageHeader(source).width, 1280);
  assert.ok(bytesRead < 256, `read ${bytesRead} bytes`);
});

test('按文件路径读取，文件不存在时抛出文件系统错误（由调用方归类）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-header-'));
  const file = path.join(dir, 'tiny.png');
  fs.writeFileSync(file, png(3, 2));
  assert.equal(readImageHeader(file).width, 3);
  assert.throws(() => readImageHeader(path.join(dir, 'missing.png')), { code: 'ENOENT' });
  fs.rmSync(dir, { recursive: true, force: true });
});
