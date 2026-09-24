// 反向导出内容清单 content-manifest.json（html-indesign #26）：从反向语义模型聚合文字、表格、
// 图片与像素尺寸，并由反向导出流水线 / html.reverse_export 写出和引用。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  buildContentManifest,
  stringifyContentManifest,
} = require('../../src/reverse-pipeline/content-manifest');
const { callPlugin, repoRoot } = require('../indesign-cli-plugin/plugin-test-helper');

const PT = 72 / 25.4; // 1mm 对应的 pt

function pngBytes(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function box(xMm, yMm, wMm, hMm) {
  return { x: xMm * PT, y: yMm * PT, width: wMm * PT, height: hMm * PT };
}

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `content-manifest-${name}-`));
}

function sampleModel(dir) {
  const photo = path.join(dir, 'links', 'photo.jpg'); // 扩展名写成 jpg，实际是 PNG
  fs.mkdirSync(path.dirname(photo), { recursive: true });
  fs.writeFileSync(photo, pngBytes(3000, 2000));
  const packaged = path.join(dir, 'links', 'packaged.png');
  fs.writeFileSync(packaged, pngBytes(10, 10));
  fs.mkdirSync(path.join(dir, 'out', 'author', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out', 'author', 'assets', 'packaged.png'), pngBytes(1200, 800));
  return {
    kind: 'DocumentModel',
    id: 'doc',
    title: '样例',
    source: '\\\\nas\\projects\\sample.indd',
    coordinateUnit: 'pt',
    reverseMode: 'observation',
    parentPages: [{
      id: 'master-a',
      name: 'A-母版',
      items: [{ id: 'folio', role: 'text', bounds: box(280, 200, 5, 4), content: { text: '01' } }],
    }],
    pages: [{
      id: 'page-1',
      index: 0,
      semantic: 'cover',
      parentPageId: 'master-a',
      width: 297 * PT,
      height: 210 * PT,
      items: [
        // 右栏先出现在数组里，z 顺序也更靠前：阅读顺序不能跟着它走。
        { id: 'right-body', role: 'text', zIndex: 9, bounds: box(160, 40, 120, 30), content: { text: '右栏正文' } },
        { id: 'title', role: 'text', semantic: 'title', zIndex: 1, bounds: box(20, 15, 250, 12), styleRefs: { paragraphStyle: 'deck-title', paragraphStyleDisplayName: '页面标题' }, content: { text: '第一段\r第二段\r\n' } },
        { id: 'left-body', role: 'text', zIndex: 2, bounds: box(20, 40, 120, 30), content: { text: '左栏正文' } },
        { id: 'empty-frame', role: 'text', bounds: box(20, 100, 50, 10), content: { text: '  \r ' } },
        { id: 'virtual-group', role: 'text', virtual: true, bounds: box(20, 40, 260, 30), content: { text: '不应出现' } },
        {
          id: 'area-table',
          role: 'table',
          bounds: box(20, 80, 120, 40),
          content: { text: '' },
          table: {
            tableStyle: 'area-table',
            rowCount: 3,
            columnCount: 3,
            rows: [
              { cells: [{ text: '空间', header: true }, { text: '面积', header: true }, { text: '备注', header: true }] },
              { cells: [{ text: '冰场', rowSpan: 2 }, { text: '1800' }, { text: '主场' }] },
              { cells: [{ text: '合计', colSpan: 2 }] },
            ],
          },
        },
        {
          id: 'hero',
          role: 'graphic',
          bounds: box(160, 80, 100, 50),
          asset: {
            name: 'photo.jpg',
            path: photo,
            status: 'NORMAL',
            cropped: true,
            // 图像本身 127mm 宽（5 英寸）：3000px / 5in = 600 PPI。
            bounds: box(160, 70, 127, 84.667),
          },
        },
        {
          id: 'packaged',
          role: 'graphic',
          bounds: box(160, 140, 101.6, 67.733), // 4 英寸宽的图框，没有图像外框 → 按图框近似
          asset: { name: 'packaged.png', path: packaged, status: 'LINK_OUT_OF_DATE' },
        },
        { id: 'plan', role: 'graphic', bounds: box(20, 130, 100, 60), asset: { name: 'plan.pdf', path: path.join(dir, 'links', 'plan.pdf'), status: 'NORMAL', placement: { pageNumber: 2 } } },
        { id: 'gone', role: 'graphic', bounds: box(122, 130, 15, 15), asset: { name: 'gone.tif', path: path.join(dir, 'links', 'gone.tif'), status: 'LINK_MISSING' } },
        { id: 'odd', role: 'graphic', bounds: box(122, 160, 15, 15), asset: { name: 'odd.xyz', path: path.join(dir, 'links', 'packaged.png.xyz') } },
      ],
    }],
  };
}

function build(dir, model, extra = {}) {
  fs.writeFileSync(path.join(dir, 'links', 'packaged.png.xyz'), 'not an image at all, just text');
  return buildContentManifest(model, {
    runId: 'reverse-20260925T000000-abc123',
    tool: 'html.reverse_export',
    outDir: path.join(dir, 'out'),
    authorDir: path.join(dir, 'out', 'author'),
    assetPathMap: new Map([[path.join(dir, 'links', 'packaged.png').replace(/\\/g, '/').toLowerCase(), 'assets/packaged.png']]),
    pageNames: ['1'],
    files: {
      report: path.join(dir, 'out', 'report.json'),
      authorEntry: path.join(dir, 'out', 'author', 'deck.html'),
    },
    ...extra,
  });
}

test('清单顶层：runId、单位、页数、页面尺寸、相对路径与计数', () => {
  const dir = tempDir('top');
  const manifest = build(dir, sampleModel(dir));
  assert.equal(manifest.schema, 'html-indesign.content-manifest');
  assert.equal(manifest.runId, 'reverse-20260925T000000-abc123');
  assert.equal(manifest.tool, 'html.reverse_export');
  assert.equal(manifest.unit, 'mm');
  assert.equal(manifest.pageCount, 1);
  assert.deepEqual(manifest.pageSize, { width: 297, height: 210 });
  assert.deepEqual(manifest.files, { report: 'report.json', authorEntry: 'author/deck.html' });
  assert.equal(manifest.source.indd, '\\\\nas\\projects\\sample.indd');
  assert.deepEqual(manifest.summary, {
    textBlocks: 4, tables: 1, images: 5, rasterImages: 3, vectorImages: 1, imagesWithPixels: 2, imagesWithPixelError: 2,
  });
  const page = manifest.pages[0];
  assert.equal(page.name, '1');
  assert.equal(page.size, undefined, '与 pageSize 相同的页不重复写尺寸');
  assert.deepEqual(manifest.parentPages.map((entry) => [entry.id, entry.textBlocks.map((block) => block.text)]), [['master-a', ['01']]]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('文字块：保留段落换行、跳过空框与虚拟容器、bounds 换算成 mm、不带 z-index 和样式细节', () => {
  const dir = tempDir('text');
  const page = build(dir, sampleModel(dir)).pages[0];
  const title = page.textBlocks.find((block) => block.id === 'title');
  assert.deepEqual(title, {
    id: 'title',
    order: 1,
    kind: 'text',
    role: 'text',
    semantic: 'title',
    paragraphStyle: '页面标题',
    bounds: { x: 20, y: 15, width: 250, height: 12 },
    text: '第一段\n第二段',
  });
  const ids = page.textBlocks.map((block) => block.id);
  assert.ok(!ids.includes('empty-frame'));
  assert.ok(!ids.includes('virtual-group'));
  assert.ok(!JSON.stringify(page).includes('zIndex'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('阅读顺序按 XY-cut：先标题，再左栏自上而下，再右栏，不看数组顺序和 z-index', () => {
  const dir = tempDir('order');
  const page = build(dir, sampleModel(dir)).pages[0];
  const all = [...page.textBlocks, ...page.images].sort((left, right) => left.order - right.order).map((entry) => entry.id);
  assert.deepEqual(all, ['title', 'left-body', 'area-table', 'plan', 'gone', 'odd', 'right-body', 'hero', 'packaged']);
  assert.deepEqual(all.map((_, index) => index + 1), [...page.textBlocks, ...page.images].map((entry) => entry.order).sort((a, b) => a - b));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('表格给出行列二维数组，合并单元格覆盖的位置为 null', () => {
  const dir = tempDir('table');
  const table = build(dir, sampleModel(dir)).pages[0].textBlocks.find((block) => block.id === 'area-table');
  assert.equal(table.kind, 'table');
  assert.equal(table.tableStyle, 'area-table');
  assert.equal(table.headerRows, 1);
  assert.deepEqual(table.rows, [
    ['空间', '面积', '备注'],
    ['冰场', '1800', '主场'],
    [null, '合计', null],
  ]);
  assert.equal(table.text, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('栅格图：以文件头为准的格式、像素尺寸、按图像外框算有效 PPI；有包内拷贝时优先读拷贝', () => {
  const dir = tempDir('raster');
  const images = build(dir, sampleModel(dir)).pages[0].images;
  const hero = images.find((image) => image.id === 'hero');
  assert.equal(hero.format, 'png', '扩展名 jpg 但文件头是 PNG');
  assert.equal(hero.kind, 'raster');
  assert.equal(hero.linkStatus, 'normal');
  assert.equal(hero.cropped, true);
  assert.equal(hero.pixelWidth, 3000);
  assert.equal(hero.pixelHeight, 2000);
  assert.equal(hero.aspectRatio, 1.5);
  assert.deepEqual(hero.effectivePpi, { horizontal: 600, vertical: 600 });
  assert.equal(hero.ppiBasis, 'placed-image-bounds');
  assert.equal(hero.pixelSource, 'link-path');
  assert.equal(hero.pixelError, null);

  const packaged = images.find((image) => image.id === 'packaged');
  assert.equal(packaged.packagePath, 'author/assets/packaged.png');
  assert.equal(packaged.pixelSource, 'package-copy');
  assert.equal(packaged.pixelWidth, 1200, '读的是包内拷贝，不是 10px 的原始链接');
  assert.equal(packaged.linkStatus, 'modified');
  assert.deepEqual(packaged.effectivePpi, { horizontal: 300, vertical: 300 });
  assert.equal(packaged.ppiBasis, 'frame-bounds');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('矢量素材不给像素尺寸；链接缺失与格式不认识时像素字段为 null 并带原因，不抛错', () => {
  const dir = tempDir('vector');
  const images = build(dir, sampleModel(dir)).pages[0].images;
  const plan = images.find((image) => image.id === 'plan');
  assert.equal(plan.kind, 'vector');
  assert.equal(plan.format, 'pdf');
  assert.equal(plan.pdfPage, 2);
  assert.equal(plan.pixelWidth, null);
  assert.equal(plan.effectivePpi, null);
  assert.equal(plan.pixelError, null);

  const gone = images.find((image) => image.id === 'gone');
  assert.equal(gone.kind, 'raster');
  assert.equal(gone.linkStatus, 'missing');
  assert.equal(gone.pixelWidth, null);
  assert.equal(gone.pixelError.reason, 'file-not-found');

  const odd = images.find((image) => image.id === 'odd');
  assert.equal(odd.kind, 'unknown');
  assert.equal(odd.format, null);
  assert.equal(odd.pixelError.reason, 'unsupported-format');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('同一共享不可达时只探一次，后续图片直接记 share-unreachable', () => {
  const dir = tempDir('share');
  const calls = [];
  const model = sampleModel(dir);
  model.pages[0].items = ['a', 'b', 'c'].map((name, index) => ({
    id: name,
    role: 'graphic',
    bounds: box(10 + index * 30, 10, 20, 20),
    asset: { name: `${name}.jpg`, path: `\\\\no-such-host-html-indesign\\share\\${name}.jpg`, status: 'NORMAL' },
  }));
  const manifest = build(dir, model, {
    readImageHeader: (file) => {
      calls.push(file);
      const error = new Error(`UNKNOWN: unknown error, open '${file}'`);
      error.code = 'UNKNOWN';
      throw error;
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(manifest.pages[0].images.map((image) => image.pixelError.reason), ['share-unreachable', 'share-unreachable', 'share-unreachable']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('序列化：每个块一行，JSON 可解析', () => {
  const dir = tempDir('stringify');
  const manifest = build(dir, sampleModel(dir));
  const text = stringifyContentManifest(manifest);
  assert.deepEqual(JSON.parse(text), JSON.parse(JSON.stringify(manifest)));
  const blockLines = text.split('\n').filter((line) => line.trim().startsWith('{"id":'));
  assert.equal(blockLines.length, 4 + 5 + 1, '页面 4 个文字块 + 5 张图 + 母版 1 个块，各占一行');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('html.reverse_export 写出 content-manifest.json，返回体、artifacts 与 report.json 都引用它', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'reverse-content-manifest');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  fs.copyFileSync(path.join(repoRoot, 'test', 'fixtures', 'indesign-reverse', 'tagged-snapshot.json'), snapshotPath);

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.reverse_export',
      runId: 'reverse-20260925T000000-fed987',
      outDir,
      snapshotPath,
      mode: 'observation',
      assetPolicy: 'reference',
      sourceRoot: null,
      nasPublicRoot: '/nas',
      reconstructionProfile: { name: 'none', algorithms: [] },
    },
    host_results: [{ id: 'html-reverse-snapshot', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'complete', JSON.stringify(response.error || null));
  const manifestPath = path.join(outDir, 'content-manifest.json');
  assert.equal(response.data.contentManifestPath, manifestPath);
  assert.ok(response.artifacts.some((entry) => entry.path === manifestPath && entry.kind === 'json'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.runId, 'reverse-20260925T000000-fed987');
  assert.equal(manifest.tool, 'html.reverse_export');
  assert.equal(manifest.files.report, 'report.json');
  assert.equal(manifest.files.authorEntry, 'author/deck.html');
  assert.deepEqual(manifest.pages[0].textBlocks.map((block) => block.text), ['汇报结构']);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'));
  assert.equal(report.runId, manifest.runId);
  assert.deepEqual(report.contentManifest, { path: 'content-manifest.json', summary: manifest.summary });
  assert.deepEqual(fs.readdirSync(outDir).filter((name) => name.endsWith('.tmp')), [], '原子写入不留临时文件');
});
