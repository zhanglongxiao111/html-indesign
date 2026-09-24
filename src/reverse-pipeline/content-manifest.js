'use strict';

// 反向导出的内容清单 content-manifest.json（html-indesign #26）。
//
// 给「从 INDD 取内容重做」这类场景直接用：每页的文字块（含表格二维文字）、置入图片的原始链接、
// 作者包内拷贝、像素尺寸与有效 PPI。数据取自与 reverse-model.json 同一份语义模型，
// 不读观察态 HTML，也不带坐标以外的样式细节和 z-index。
// 08-06 事故里 Agent 为了取内容逐页读回 21 个观察态 HTML（约 423KB），这份清单就是替代品。
//
// 字段登记在 src/protocol/fields/content-manifest.js，结构说明见 docs/规范/REVERSE_EXPORT.md 4.4.1。

const fs = require('fs');
const path = require('path');
const { writeFileAtomicSync } = require('../shared/atomic-write');
const { cssLengthToMm, round } = require('../shared/geometry');
const { normalizePathKey, isRemoteReference } = require('../shared/assets');
const { normalizeLineEndings } = require('../shared/text');
const { IMAGE_HEADER_ERROR_CODES, readImageHeader } = require('../shared/image-header');

const CONTENT_MANIFEST_FILE = 'content-manifest.json';
const CONTENT_MANIFEST_SCHEMA = 'html-indesign.content-manifest';
const CONTENT_MANIFEST_SCHEMA_VERSION = 1;
const CONTENT_MANIFEST_UNIT = 'mm';
const READING_ORDER_BASIS = 'xy-cut';

// 覆盖页面面积 80% 以上的块（满版底图、整页正文框）不参与切分，排在本页最前。
const BACKGROUND_AREA_RATIO = 0.8;
// 相邻块投影重叠不超过这个量（mm）仍算有空隙，避免贴边对象切不开。
const CUT_TOLERANCE_MM = 0.5;
const MAX_CUT_DEPTH = 64;

const RASTER_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'psd', 'psb']);
const VECTOR_FORMATS = new Set(['pdf', 'ai', 'eps', 'svg', 'emf', 'wmf', 'indd']);
const EXTENSION_FORMATS = Object.freeze({
  jpg: 'jpeg', jpeg: 'jpeg', jpe: 'jpeg', jfif: 'jpeg',
  png: 'png', gif: 'gif', webp: 'webp', bmp: 'bmp', dib: 'bmp',
  tif: 'tiff', tiff: 'tiff', psd: 'psd', psb: 'psb',
  pdf: 'pdf', ai: 'ai', eps: 'eps', epsf: 'eps', ps: 'eps', svg: 'svg', svgz: 'svg',
  emf: 'emf', wmf: 'wmf', indd: 'indd',
});
// InDesign graphic.imageTypeName 的常见取值；扩展名认不出时再看它。
const IMAGE_TYPE_NAME_FORMATS = [
  [/jpe?g/i, 'jpeg'], [/png/i, 'png'], [/gif/i, 'gif'], [/webp/i, 'webp'], [/bmp|bitmap/i, 'bmp'],
  [/tiff?/i, 'tiff'], [/photoshop|psd/i, 'psd'], [/pdf/i, 'pdf'], [/illustrator/i, 'ai'],
  [/eps|postscript/i, 'eps'], [/svg/i, 'svg'], [/indesign/i, 'indd'],
];
const LINK_STATUS = Object.freeze({
  NORMAL: 'normal',
  LINK_MISSING: 'missing',
  LINK_OUT_OF_DATE: 'modified',
  LINK_EMBEDDED: 'embedded',
  LINK_INACCESSIBLE: 'inaccessible',
});
const PIXEL_ERROR_BY_HEADER_CODE = Object.freeze({
  [IMAGE_HEADER_ERROR_CODES.UNSUPPORTED]: 'unsupported-format',
  [IMAGE_HEADER_ERROR_CODES.TRUNCATED]: 'truncated',
  [IMAGE_HEADER_ERROR_CODES.INVALID]: 'invalid-header',
});
const MISSING_FILE_CODES = new Set(['ENOENT', 'ENOTDIR']);

// model：reverse-model.json 同一份语义模型。
// options.outDir：清单所在目录，所有相对路径都相对它。
// options.files：{ report, reverseModel, authorEntry, authorConfig } 绝对路径。
// options.authorDir / options.assetPathMap：作者包目录与写出器的资源路径表（copy 策略下值是包内相对路径）。
// options.pageNames：按页序号给出 InDesign 页面名（来自 reverse snapshot，可省略）。
function buildContentManifest(model, options = {}) {
  if (!model || model.kind !== 'DocumentModel') throw new Error('buildContentManifest requires a DocumentModel');
  if (!options.outDir) throw new Error('buildContentManifest requires outDir');
  if (!options.runId || !options.tool) throw new Error('buildContentManifest requires runId and tool');
  const unit = model.coordinateUnit || 'pt';
  const context = {
    unit,
    outDir: path.resolve(options.outDir),
    authorDir: options.authorDir ? path.resolve(options.authorDir) : null,
    assetPathMap: options.assetPathMap instanceof Map ? options.assetPathMap : new Map(),
    readHeader: options.readImageHeader || readImageHeader,
    pixelCache: new Map(),
    unreachableShares: new Map(),
  };
  const pageNames = options.pageNames || [];
  const pages = (model.pages || []).map((page, index) => pageEntry(page, context, pageNames[index]));
  const pageSize = sizeMm(model.pages && model.pages[0], unit);
  for (const page of pages) {
    if (pageSize && page.size && sameSize(page.size, pageSize)) delete page.size;
  }
  const parentPages = (model.parentPages || [])
    .map((parentPage) => parentPageEntry(parentPage, context))
    .filter((entry) => entry.textBlocks.length || entry.images.length);

  return {
    schema: CONTENT_MANIFEST_SCHEMA,
    schemaVersion: CONTENT_MANIFEST_SCHEMA_VERSION,
    runId: options.runId,
    generatedAt: options.generatedAt || new Date().toISOString(),
    tool: options.tool,
    source: {
      indd: model.source || null,
      documentId: model.id || null,
      title: model.title || null,
      mode: model.reverseMode || null,
    },
    unit: CONTENT_MANIFEST_UNIT,
    pageCount: pages.length,
    pageSize,
    readingOrder: READING_ORDER_BASIS,
    files: relativeFiles(options.files || {}, context.outDir),
    summary: summarize(pages, parentPages),
    parentPages,
    pages,
  };
}

function writeContentManifest(filePath, manifest) {
  return writeFileAtomicSync(filePath, stringifyContentManifest(manifest));
}

// 顶层、pages 数组、每页对象、每页的块数组分行缩进；单个文字块 / 图片压成一行，
// 既便于 Agent 按块读，又比整份缩进小三成左右。
function stringifyContentManifest(manifest) {
  return `${stringifyToDepth(manifest, 0, 3)}\n`;
}

function stringifyToDepth(value, depth, maxDepth) {
  if (depth > maxDepth || value === null || typeof value !== 'object') return JSON.stringify(value);
  const pad = '  '.repeat(depth + 1);
  const closePad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((entry) => `${pad}${stringifyToDepth(entry, depth + 1, maxDepth)}`).join(',\n')}\n${closePad}]`;
  }
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  if (!entries.length) return '{}';
  return `{\n${entries
    .map(([key, entry]) => `${pad}${JSON.stringify(key)}: ${stringifyToDepth(entry, depth + 1, maxDepth)}`)
    .join(',\n')}\n${closePad}}`;
}

// ---- 页面 ----

function pageEntry(page, context, pageName) {
  const blocks = contentBlocks(page.items, context);
  return {
    id: page.id,
    index: page.index,
    ...(pageName != null && String(pageName) !== '' ? { name: String(pageName) } : {}),
    ...(page.semantic ? { semantic: page.semantic } : {}),
    ...(page.parentPageId ? { parentPageId: page.parentPageId } : {}),
    size: sizeMm(page, context.unit),
    ...orderedBlocks(blocks, sizeMm(page, context.unit)),
  };
}

function parentPageEntry(parentPage, context) {
  const blocks = contentBlocks(parentPage.items, context);
  return {
    id: parentPage.id,
    ...(parentPage.name ? { name: parentPage.name } : {}),
    ...orderedBlocks(blocks, null),
  };
}

function contentBlocks(items, context) {
  const blocks = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.virtual) continue;
    if (item.asset && (item.asset.path || item.asset.name)) {
      blocks.push({ type: 'image', entry: imageEntry(item, context) });
      continue;
    }
    const tableRows = tableGrid(item.table);
    if (tableRows) {
      blocks.push({ type: 'text', entry: tableEntry(item, tableRows, context) });
      continue;
    }
    const text = plainText(item.content && item.content.text);
    if (text) blocks.push({ type: 'text', entry: textEntry(item, text, context) });
  }
  return blocks;
}

function orderedBlocks(blocks, pageSize) {
  const ordered = readingOrder(blocks, pageSize);
  ordered.forEach((block, index) => {
    block.entry.order = index + 1;
  });
  const byOrder = (left, right) => left.entry.order - right.entry.order;
  const withOrderFirst = (entry) => {
    const { id, order, ...rest } = entry;
    return { id, order, ...rest };
  };
  return {
    textBlocks: blocks.filter((block) => block.type === 'text').sort(byOrder).map((block) => withOrderFirst(block.entry)),
    images: blocks.filter((block) => block.type === 'image').sort(byOrder).map((block) => withOrderFirst(block.entry)),
  };
}

// ---- 文字与表格 ----

function textEntry(item, text, context) {
  return {
    id: item.id,
    kind: 'text',
    ...roleFields(item),
    ...paragraphStyleField(item),
    bounds: boundsMm(item.bounds, context.unit),
    text,
  };
}

function tableEntry(item, rows, context) {
  const headerRows = countHeaderRows(item.table);
  return {
    id: item.id,
    kind: 'table',
    ...roleFields(item),
    ...(item.table.tableStyle ? { tableStyle: item.table.tableStyle } : {}),
    bounds: boundsMm(item.bounds, context.unit),
    ...(headerRows ? { headerRows } : {}),
    rows,
  };
}

function roleFields(item) {
  return {
    ...(item.role ? { role: item.role } : {}),
    ...(item.semantic ? { semantic: item.semantic } : {}),
  };
}

function paragraphStyleField(item) {
  const refs = item.styleRefs || {};
  const name = refs.paragraphStyleDisplayName || refs.paragraphStyle;
  return name ? { paragraphStyle: name } : {};
}

// 段落与强制换行都归一成 \n；首尾空白去掉，中间原样保留。
function plainText(value) {
  return normalizeLineEndings(value).replace(/[\u2028\u2029]/g, '\n').trim();
}

// 行列文字二维数组：按 rowCount × columnCount 摆放，合并单元格只在左上角写文字，
// 被它覆盖的位置填 null，这样每行长度一致、列对得上。
function tableGrid(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) return null;
  const rowCount = Math.max(Number(table.rowCount) || 0, table.rows.length);
  const columnCount = Math.max(
    Number(table.columnCount) || 0,
    ...table.rows.map((row) => cellsOf(row).reduce((sum, cell) => sum + span(cell.colSpan), 0)),
  );
  const grid = Array.from({ length: rowCount }, () => Array(columnCount).fill(undefined));
  table.rows.forEach((row, rowIndex) => {
    let column = 0;
    for (const cell of cellsOf(row)) {
      while (column < columnCount && grid[rowIndex][column] !== undefined) column += 1;
      if (column >= columnCount) break;
      const rowSpan = span(cell.rowSpan);
      const colSpan = span(cell.colSpan);
      for (let r = rowIndex; r < Math.min(rowCount, rowIndex + rowSpan); r += 1) {
        for (let c = column; c < Math.min(columnCount, column + colSpan); c += 1) grid[r][c] = null;
      }
      grid[rowIndex][column] = plainText(cell.text);
      column += colSpan;
    }
  });
  return grid.map((row) => row.map((cell) => (cell === undefined ? '' : cell)));
}

function cellsOf(row) {
  return row && Array.isArray(row.cells) ? row.cells : [];
}

function span(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 1 ? number : 1;
}

function countHeaderRows(table) {
  let count = 0;
  for (const row of table.rows) {
    const cells = cellsOf(row);
    if (!cells.length || !cells.every((cell) => cell && cell.header === true)) break;
    count += 1;
  }
  return count;
}

// ---- 图片 ----

function imageEntry(item, context) {
  const asset = item.asset;
  const linkPath = asset.path || null;
  const packagePath = packageCopyPath(linkPath, context);
  const namedFormat = formatFromName(linkPath || asset.name) || formatFromImageTypeName(asset.imageTypeName);
  const pixels = pixelFields(asset, item, { linkPath, packagePath, format: namedFormat }, context);
  // 读到文件头时以文件头为准：扩展名写成 .jpg 的 PNG 按 PNG 记。
  const format = pixels.header ? pixels.header.format : namedFormat;
  const pageNumber = asset.placement && asset.placement.pageNumber;
  return {
    id: item.id,
    ...roleFields(item),
    bounds: boundsMm(item.bounds, context.unit),
    name: asset.name || (linkPath ? path.win32.basename(linkPath) : null),
    linkPath,
    ...(packagePath ? { packagePath } : {}),
    format,
    kind: kindOf(format),
    linkStatus: linkStatus(asset.status),
    ...(Number.isInteger(pageNumber) && pageNumber > 0 ? { pdfPage: pageNumber } : {}),
    ...(asset.cropped === true ? { cropped: true } : {}),
    ...pixels.fields,
  };
}

// 矢量素材（PDF/AI/EPS/SVG…）不谈像素尺寸，像素字段全为 null、不带 pixelError；
// 栅格或格式未知的素材去读文件头，读不到时像素字段为 null，pixelError 说明原因。
function pixelFields(asset, item, target, context) {
  const empty = {
    pixelWidth: null,
    pixelHeight: null,
    aspectRatio: null,
    effectivePpi: null,
    ppiBasis: null,
    pixelSource: null,
    pixelError: null,
  };
  if (VECTOR_FORMATS.has(target.format)) return { header: null, fields: empty };
  const read = readPixels(target, context);
  if (read.error) return { header: null, fields: { ...empty, pixelError: read.error } };
  const header = read.header;
  const ppi = effectivePpi(header, asset, item, context.unit);
  return {
    header,
    fields: {
      pixelWidth: header.width,
      pixelHeight: header.height,
      aspectRatio: round(header.width / header.height, 4),
      ...(header.orientation != null && header.orientation !== 1 ? { exifOrientation: header.orientation } : {}),
      effectivePpi: ppi ? { horizontal: ppi.horizontal, vertical: ppi.vertical } : null,
      ppiBasis: ppi ? ppi.basis : null,
      pixelSource: read.source,
      pixelError: null,
    },
  };
}

// 优先读作者包内的拷贝（离线也在），没有再读原始链接路径（可能是 NAS）。
function readPixels(target, context) {
  const candidates = [];
  if (target.packagePath) candidates.push({ source: 'package-copy', file: path.resolve(context.outDir, target.packagePath) });
  if (target.linkPath && !isRemoteReference(target.linkPath)) candidates.push({ source: 'link-path', file: target.linkPath });
  if (!candidates.length) return { error: { reason: 'no-link-path', message: 'Placed asset has no readable link path.' } };
  let lastError = null;
  for (const candidate of candidates) {
    const outcome = readHeaderCached(candidate.file, context);
    if (outcome.header) return { header: outcome.header, source: candidate.source };
    lastError = outcome.error;
    // 文件读到了但格式不认识或损坏：换一个副本也是同一个文件，不必再试。
    if (!['file-not-found', 'file-unreadable', 'share-unreachable'].includes(lastError.reason)) break;
  }
  return { error: lastError };
}

function readHeaderCached(filePath, context) {
  const key = normalizePathKey(filePath);
  if (context.pixelCache.has(key)) return context.pixelCache.get(key);
  const outcome = readHeaderOnce(filePath, context);
  context.pixelCache.set(key, outcome);
  return outcome;
}

function readHeaderOnce(filePath, context) {
  const share = uncShareRoot(filePath);
  if (share && context.unreachableShares.has(share)) {
    return { error: { reason: 'share-unreachable', message: context.unreachableShares.get(share) } };
  }
  try {
    return { header: context.readHeader(filePath) };
  } catch (error) {
    const reason = PIXEL_ERROR_BY_HEADER_CODE[error && error.code];
    if (reason) return { error: { reason, message: error.message } };
    if (share && !shareReachable(share)) {
      const message = `Network share ${share} is not reachable: ${error && error.message}`;
      context.unreachableShares.set(share, message);
      return { error: { reason: 'share-unreachable', message } };
    }
    return {
      error: {
        reason: MISSING_FILE_CODES.has(error && error.code) ? 'file-not-found' : 'file-unreadable',
        message: `${(error && error.code) || 'ERROR'}: ${(error && error.message) || String(error)}`,
      },
    };
  }
}

function uncShareRoot(filePath) {
  const match = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/.exec(String(filePath || ''));
  return match ? `\\\\${match[1]}\\${match[2]}` : null;
}

function shareReachable(share) {
  try {
    fs.statSync(`${share}\\`);
    return true;
  } catch (_error) {
    return false;
  }
}

// 有效 PPI = 像素数 ÷ 图像整体在版面上的尺寸（英寸），与 InDesign 链接面板的「有效 PPI」同口径：
// 裁切不改变它，缩放改变它。快照里的 asset.bounds 是图像本身（不是图框）的外框，
// 已经包含缩放与裁切偏移，优先用它（placed-image-bounds）；没有时退回图框尺寸，
// 假定图像恰好充满图框（frame-bounds，近似值）。
function effectivePpi(header, asset, item, unit) {
  const placed = sizeOf(asset.bounds);
  const frame = sizeOf(item.bounds);
  const basis = placed ? 'placed-image-bounds' : (frame ? 'frame-bounds' : null);
  const size = placed || frame;
  if (!basis) return null;
  const widthInches = cssLengthToMm({ value: size.width, unit }) / 25.4;
  const heightInches = cssLengthToMm({ value: size.height, unit }) / 25.4;
  if (!(widthInches > 0) || !(heightInches > 0)) return null;
  return {
    horizontal: round(header.width / widthInches, 1),
    vertical: round(header.height / heightInches, 1),
    basis,
  };
}

function sizeOf(bounds) {
  if (!bounds) return null;
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  return width > 0 && height > 0 ? { width, height } : null;
}

function packageCopyPath(linkPath, context) {
  if (!linkPath || !context.authorDir) return null;
  const mapped = context.assetPathMap.get(normalizePathKey(linkPath));
  // reference 策略下映射值是 /nas/… 或 file:// URL，不是包内拷贝。
  if (!mapped || mapped.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(mapped)) return null;
  const absolute = path.resolve(context.authorDir, mapped);
  if (!fs.existsSync(absolute)) return null;
  return slash(path.relative(context.outDir, absolute));
}

function formatFromName(name) {
  const match = /\.([a-z0-9]+)$/i.exec(String(name || '').trim());
  return match ? EXTENSION_FORMATS[match[1].toLowerCase()] || null : null;
}

function formatFromImageTypeName(value) {
  const text = String(value || '');
  if (!text) return null;
  const hit = IMAGE_TYPE_NAME_FORMATS.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : null;
}

function kindOf(format) {
  if (RASTER_FORMATS.has(format)) return 'raster';
  if (VECTOR_FORMATS.has(format)) return 'vector';
  return 'unknown';
}

function linkStatus(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return LINK_STATUS[text.toUpperCase()] || text.toLowerCase();
}

// ---- 阅读顺序 ----
// 递归 XY-cut：用横向空白带把块切成上下几段，或用纵向空白把块切成左右几栏，逐层递归；
// 两个方向都切不开（块互相压叠）时按「行带内从左到右、行带从上到下」排。
// 不用 z-index / 图层顺序：人做的 INDD 里那是堆叠顺序，与阅读顺序无关。

function readingOrder(blocks, pageSize) {
  const pageArea = pageSize ? pageSize.width * pageSize.height : 0;
  const placed = [];
  const unplaced = [];
  blocks.forEach((block, index) => {
    const box = block.entry.bounds;
    const target = { block, index, box };
    if (box && box.width >= 0 && box.height >= 0) placed.push(target);
    else unplaced.push(target);
  });
  const backgrounds = pageArea > 0
    ? placed.filter((target) => target.box.width * target.box.height >= BACKGROUND_AREA_RATIO * pageArea)
    : [];
  const rest = placed.filter((target) => !backgrounds.includes(target));
  return [...rowMajor(backgrounds), ...xyCut(rest, 0), ...unplaced].map((target) => target.block);
}

// 每一层同时看横向与纵向投影，只在最宽的那条空白处一分为二（等宽时先横切），再各自递归：
// 左栏标题 + 正文、右栏卡片网格这种版式，栏间空白比行间空白宽，会先分栏再逐栏从上到下读。
function xyCut(targets, depth) {
  if (targets.length <= 1 || depth > MAX_CUT_DEPTH) return rowMajor(targets);
  const horizontal = widestGap(targets, 'y', 'height');
  const vertical = widestGap(targets, 'x', 'width');
  const cut = vertical && (!horizontal || vertical.gap > horizontal.gap) ? vertical : horizontal;
  if (!cut) return rowMajor(targets);
  return [...xyCut(cut.before, depth + 1), ...xyCut(cut.after, depth + 1)];
}

function widestGap(targets, start, size) {
  const sorted = [...targets].sort((left, right) => left.box[start] - right.box[start] || left.index - right.index);
  let end = -Infinity;
  let best = null;
  sorted.forEach((target, index) => {
    if (index > 0 && target.box[start] >= end - CUT_TOLERANCE_MM) {
      const gap = target.box[start] - end;
      if (!best || gap > best.gap) best = { gap, at: index };
    }
    end = Math.max(end, target.box[start] + target.box[size]);
  });
  return best ? { gap: best.gap, before: sorted.slice(0, best.at), after: sorted.slice(best.at) } : null;
}

// 行带：顶边落在当前行带上半部（按行带与块中较矮者的一半计）的块算同一行。
function rowMajor(targets) {
  const sorted = [...targets].sort((left, right) => left.box.y - right.box.y || left.box.x - right.box.x || left.index - right.index);
  const rows = [];
  for (const target of sorted) {
    const row = rows[rows.length - 1];
    if (row && target.box.y < row.top + Math.min(row.height, target.box.height) / 2) {
      row.items.push(target);
      row.height = Math.max(row.height, target.box.height);
    } else {
      rows.push({ top: target.box.y, height: target.box.height, items: [target] });
    }
  }
  return rows.flatMap((row) => row.items.sort((left, right) => left.box.x - right.box.x || left.index - right.index));
}

// ---- 单位与杂项 ----

function boundsMm(bounds, unit) {
  if (!bounds) return null;
  const values = ['x', 'y', 'width', 'height'].map((key) => Number(bounds[key]));
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [x, y, width, height] = values.map((value) => round(cssLengthToMm({ value, unit }), 1));
  return { x, y, width, height };
}

function sizeMm(page, unit) {
  if (!page) return null;
  const width = Number(page.width);
  const height = Number(page.height);
  if (!(width > 0) || !(height > 0)) return null;
  return {
    width: round(cssLengthToMm({ value: width, unit }), 1),
    height: round(cssLengthToMm({ value: height, unit }), 1),
  };
}

function sameSize(left, right) {
  return Math.abs(left.width - right.width) < 0.05 && Math.abs(left.height - right.height) < 0.05;
}

function relativeFiles(files, outDir) {
  const out = {};
  for (const [key, value] of Object.entries(files)) {
    if (value) out[key] = slash(path.relative(outDir, path.resolve(value)));
  }
  return out;
}

function summarize(pages, parentPages) {
  const all = [...pages, ...parentPages];
  const textBlocks = all.flatMap((page) => page.textBlocks);
  const images = all.flatMap((page) => page.images);
  return {
    textBlocks: textBlocks.filter((block) => block.kind === 'text').length,
    tables: textBlocks.filter((block) => block.kind === 'table').length,
    images: images.length,
    rasterImages: images.filter((image) => image.kind === 'raster').length,
    vectorImages: images.filter((image) => image.kind === 'vector').length,
    imagesWithPixels: images.filter((image) => image.pixelWidth != null).length,
    imagesWithPixelError: images.filter((image) => image.pixelError != null).length,
  };
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  CONTENT_MANIFEST_FILE,
  CONTENT_MANIFEST_SCHEMA,
  CONTENT_MANIFEST_SCHEMA_VERSION,
  CONTENT_MANIFEST_UNIT,
  buildContentManifest,
  stringifyContentManifest,
  writeContentManifest,
};
