'use strict';

// 栅格图文件头读取器：只按需读文件头部必要的字节，拿像素宽高和 EXIF 方向，不整文件读入、
// 不解码像素、不引入第三方依赖。给反向导出 content-manifest.json 算像素尺寸与有效 PPI 用。
//
// 支持：PNG、JPEG（SOF 段 + APP1 EXIF 方向）、GIF、WebP（VP8 / VP8L / VP8X）、BMP、
// TIFF（经典 TIFF，不含 BigTIFF）、PSD / PSB。
// 失败一律抛 ImageHeaderError，code 为 IMAGE_HEADER_UNSUPPORTED（签名不认识）、
// IMAGE_HEADER_TRUNCATED（文件在必要字段之前就结束）或 IMAGE_HEADER_INVALID（结构不合法）。

const fs = require('fs');

const IMAGE_HEADER_ERROR_CODES = Object.freeze({
  UNSUPPORTED: 'IMAGE_HEADER_UNSUPPORTED',
  TRUNCATED: 'IMAGE_HEADER_TRUNCATED',
  INVALID: 'IMAGE_HEADER_INVALID',
});

// 识别签名只需要这么多字节；各格式再按自己的结构去读后续字段。
const SNIFF_BYTES = 32;
// EXIF 方向在 IFD0，靠近 APP1 开头；APP1 段最长 64KB，这里最多读这么多。
const MAX_EXIF_BYTES = 65535;
// 防止损坏的 JPEG 让段扫描无限走下去。
const MAX_JPEG_SEGMENTS = 4096;

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const TIFF_TAG_IMAGE_WIDTH = 0x0100;
const TIFF_TAG_IMAGE_LENGTH = 0x0101;
const TIFF_TAG_ORIENTATION = 0x0112;

class ImageHeaderError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'ImageHeaderError';
    this.code = code;
  }
}

// source：文件路径、Buffer，或带 read(offset, length) / size 的字节源（测试用它数读了多少字节）。
// 返回 { format, width, height, orientation, storedWidth, storedHeight }：
// width/height 是按 EXIF 方向摆正后的显示尺寸；orientation 为 1–8 或 null（格式不带方向）；
// 方向 5–8 时 storedWidth/storedHeight 与 width/height 对调。
function readImageHeader(source) {
  const bytes = openByteSource(source);
  try {
    return readFromByteSource(bytes);
  } finally {
    bytes.close();
  }
}

function readFromByteSource(bytes) {
  const head = bytes.read(0, SNIFF_BYTES);
  if (isPng(head)) return result('png', readPng(bytes));
  if (isJpeg(head)) return result('jpeg', readJpeg(bytes));
  if (isGif(head)) return result('gif', readGif(bytes));
  if (isWebp(head)) return result('webp', readWebp(bytes));
  if (isBmp(head)) return result('bmp', readBmp(bytes));
  if (isBigTiff(head)) throw headerError('UNSUPPORTED', 'BigTIFF is not supported');
  if (isTiff(head)) return result('tiff', readTiff(bytes));
  if (isPsd(head)) return result(head.readUInt16BE(4) === 2 ? 'psb' : 'psd', readPsd(bytes));
  if (head.length === 0) throw headerError('TRUNCATED', 'file is empty');
  throw headerError('UNSUPPORTED', 'unrecognized image signature');
}

function result(format, dims) {
  const storedWidth = dims.width;
  const storedHeight = dims.height;
  if (!(storedWidth > 0) || !(storedHeight > 0)) {
    throw headerError('INVALID', `${format} header declares non-positive size ${storedWidth}x${storedHeight}`);
  }
  const orientation = dims.orientation >= 1 && dims.orientation <= 8 ? dims.orientation : null;
  const swapped = orientation != null && orientation >= 5;
  return {
    format,
    width: swapped ? storedHeight : storedWidth,
    height: swapped ? storedWidth : storedHeight,
    orientation,
    storedWidth,
    storedHeight,
  };
}

// ---- 签名 ----

function isPng(head) {
  return head.length >= 8
    && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
    && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a;
}

function isJpeg(head) {
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

function isGif(head) {
  const text = ascii(head, 0, 6);
  return text === 'GIF87a' || text === 'GIF89a';
}

function isWebp(head) {
  return ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP';
}

function isBmp(head) {
  return ascii(head, 0, 2) === 'BM';
}

function isTiff(head) {
  return head.length >= 4
    && ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00)
      || (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a));
}

function isBigTiff(head) {
  return head.length >= 4
    && ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2b && head[3] === 0x00)
      || (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2b));
}

function isPsd(head) {
  return ascii(head, 0, 4) === '8BPS' && head.length >= 6 && [1, 2].includes(head.readUInt16BE(4));
}

// ---- 各格式 ----

// IHDR 固定紧跟签名：宽高在第 16、20 字节，大端。
function readPng(bytes) {
  const header = need(bytes, 8, 16, 'png IHDR');
  if (ascii(header, 4, 4) !== 'IHDR') throw headerError('INVALID', 'png first chunk is not IHDR');
  return { width: header.readUInt32BE(8), height: header.readUInt32BE(12) };
}

// 逐段跳读：只读每段的 2 字节标记 + 2 字节长度，遇到 APP1 Exif 读方向，遇到 SOF 读宽高即停。
function readJpeg(bytes) {
  let offset = 2;
  let orientation = null;
  for (let segments = 0; segments < MAX_JPEG_SEGMENTS; segments += 1) {
    const marker = readJpegMarker(bytes, offset);
    offset = marker.offset;
    if (marker.code === 0xd8 || marker.code === 0x01 || (marker.code >= 0xd0 && marker.code <= 0xd7)) continue;
    if (marker.code === 0xd9 || marker.code === 0xda) {
      throw headerError('INVALID', 'jpeg reached image data before a SOF segment');
    }
    const length = need(bytes, offset, 2, 'jpeg segment length').readUInt16BE(0);
    if (length < 2) throw headerError('INVALID', `jpeg segment 0x${marker.code.toString(16)} has length ${length}`);
    if (JPEG_SOF_MARKERS.has(marker.code)) {
      const sof = need(bytes, offset + 2, 5, 'jpeg SOF');
      return { width: sof.readUInt16BE(3), height: sof.readUInt16BE(1), orientation };
    }
    if (marker.code === 0xe1 && orientation == null) {
      orientation = exifOrientation(bytes.read(offset + 2, Math.min(length - 2, MAX_EXIF_BYTES)));
    }
    offset += length;
  }
  throw headerError('INVALID', 'jpeg has too many segments before SOF');
}

function readJpegMarker(bytes, start) {
  let offset = start;
  const first = need(bytes, offset, 1, 'jpeg marker')[0];
  if (first !== 0xff) throw headerError('INVALID', `jpeg expected marker at byte ${offset}`);
  // 标记前允许任意多个 0xFF 填充字节。
  let code = 0xff;
  while (code === 0xff) {
    offset += 1;
    code = need(bytes, offset, 1, 'jpeg marker')[0];
  }
  return { code, offset: offset + 1 };
}

// APP1 载荷以 "Exif\0\0" 开头，后面是一段 TIFF 结构；方向在 IFD0 的 0x0112。
// 读不出来就当没有方向（null），不让方向信息拖垮宽高读取。
function exifOrientation(payload) {
  if (payload.length < 14 || ascii(payload, 0, 6) !== 'Exif\u0000\u0000') return null;
  try {
    const tags = readTiffIfd0(bufferByteSource(payload.subarray(6)), [TIFF_TAG_ORIENTATION]);
    return tags.get(TIFF_TAG_ORIENTATION) || null;
  } catch (_error) {
    return null;
  }
}

function readGif(bytes) {
  const header = need(bytes, 6, 4, 'gif logical screen');
  return { width: header.readUInt16LE(0), height: header.readUInt16LE(2) };
}

function readWebp(bytes) {
  const chunk = ascii(need(bytes, 12, 4, 'webp chunk'), 0, 4);
  if (chunk === 'VP8 ') {
    const frame = need(bytes, 20, 10, 'webp VP8 frame header');
    if (frame[3] !== 0x9d || frame[4] !== 0x01 || frame[5] !== 0x2a) {
      throw headerError('INVALID', 'webp VP8 start code missing');
    }
    return { width: frame.readUInt16LE(6) & 0x3fff, height: frame.readUInt16LE(8) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const header = need(bytes, 20, 5, 'webp VP8L header');
    if (header[0] !== 0x2f) throw headerError('INVALID', 'webp VP8L signature missing');
    const bits = header.readUInt32LE(1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const header = need(bytes, 24, 6, 'webp VP8X canvas');
    return { width: header.readUIntLE(0, 3) + 1, height: header.readUIntLE(3, 3) + 1 };
  }
  throw headerError('UNSUPPORTED', `webp chunk ${JSON.stringify(chunk)} is not supported`);
}

// BITMAPCOREHEADER（12 字节）宽高是 16 位；其余 DIB 头宽高是 32 位有符号，负高表示自上而下存储。
function readBmp(bytes) {
  const dibSize = need(bytes, 14, 4, 'bmp DIB header size').readUInt32LE(0);
  if (dibSize === 12) {
    const core = need(bytes, 18, 4, 'bmp core header');
    return { width: core.readUInt16LE(0), height: core.readUInt16LE(2) };
  }
  if (dibSize < 16) throw headerError('INVALID', `bmp DIB header size ${dibSize} is not valid`);
  const info = need(bytes, 18, 8, 'bmp info header');
  return { width: Math.abs(info.readInt32LE(0)), height: Math.abs(info.readInt32LE(4)) };
}

function readTiff(bytes) {
  const tags = readTiffIfd0(bytes, [TIFF_TAG_IMAGE_WIDTH, TIFF_TAG_IMAGE_LENGTH, TIFF_TAG_ORIENTATION]);
  if (!tags.has(TIFF_TAG_IMAGE_WIDTH) || !tags.has(TIFF_TAG_IMAGE_LENGTH)) {
    throw headerError('INVALID', 'tiff IFD0 has no ImageWidth/ImageLength');
  }
  return {
    width: tags.get(TIFF_TAG_IMAGE_WIDTH),
    height: tags.get(TIFF_TAG_IMAGE_LENGTH),
    orientation: tags.get(TIFF_TAG_ORIENTATION) || null,
  };
}

// 只读 IFD0 里指定的 SHORT / LONG 标签；值直接放在条目的 value 字段里（单值不超过 4 字节）。
function readTiffIfd0(bytes, wanted) {
  const header = need(bytes, 0, 8, 'tiff header');
  const order = ascii(header, 0, 2);
  if (order !== 'II' && order !== 'MM') throw headerError('INVALID', 'tiff byte order mark missing');
  const little = order === 'II';
  const u16 = (buffer, at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
  const u32 = (buffer, at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
  if (u16(header, 2) !== 42) throw headerError('INVALID', 'tiff magic number is not 42');
  const ifdOffset = u32(header, 4);
  const count = u16(need(bytes, ifdOffset, 2, 'tiff IFD0 entry count'), 0);
  const entries = need(bytes, ifdOffset + 2, count * 12, 'tiff IFD0 entries');
  const wantedSet = new Set(wanted);
  const tags = new Map();
  for (let index = 0; index < count; index += 1) {
    const at = index * 12;
    const tag = u16(entries, at);
    if (!wantedSet.has(tag)) continue;
    const type = u16(entries, at + 2);
    if (type === 3) tags.set(tag, u16(entries, at + 8));
    else if (type === 4) tags.set(tag, u32(entries, at + 8));
  }
  return tags;
}

// PSD / PSB 文件头 26 字节：签名、版本、6 字节保留、通道数，然后是高、宽（大端 32 位）。
function readPsd(bytes) {
  const header = need(bytes, 14, 8, 'psd header');
  return { width: header.readUInt32BE(4), height: header.readUInt32BE(0) };
}

// ---- 字节源 ----

function openByteSource(source) {
  if (Buffer.isBuffer(source)) return bufferByteSource(source);
  if (source && typeof source.read === 'function') {
    return { read: (offset, length) => source.read(offset, length), close: () => {} };
  }
  if (typeof source !== 'string' || !source) throw new TypeError('readImageHeader requires a file path, Buffer or byte source');
  return fileByteSource(source);
}

function bufferByteSource(buffer) {
  return {
    read: (offset, length) => buffer.subarray(Math.min(offset, buffer.length), Math.min(offset + length, buffer.length)),
    close: () => {},
  };
}

function fileByteSource(filePath) {
  const fd = fs.openSync(filePath, 'r');
  let size;
  try {
    size = fs.fstatSync(fd).size;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
  return {
    read(offset, length) {
      const available = Math.max(0, Math.min(length, size - offset));
      const buffer = Buffer.alloc(available);
      let filled = 0;
      while (filled < available) {
        const read = fs.readSync(fd, buffer, filled, available - filled, offset + filled);
        if (read <= 0) break;
        filled += read;
      }
      return filled === available ? buffer : buffer.subarray(0, filled);
    },
    close: () => fs.closeSync(fd),
  };
}

function need(bytes, offset, length, what) {
  const buffer = bytes.read(offset, length);
  if (buffer.length < length) {
    throw headerError('TRUNCATED', `${what} needs ${length} bytes at offset ${offset}, file ends first`);
  }
  return buffer;
}

function ascii(buffer, offset, length) {
  if (buffer.length < offset + length) return '';
  return buffer.toString('latin1', offset, offset + length);
}

function headerError(kind, message) {
  return new ImageHeaderError(IMAGE_HEADER_ERROR_CODES[kind], message);
}

module.exports = {
  IMAGE_HEADER_ERROR_CODES,
  ImageHeaderError,
  readImageHeader,
};
