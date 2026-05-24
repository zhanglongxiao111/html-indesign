# Browser Snapshot 架构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 建立新的 `html-indesign` 架构基础，并实现可测试的 Paged HTML -> Browser Layout Snapshot 核心，同时不破坏现有 legacy template 工作流。

**架构：** 保持当前模板驱动文件继续可用，在 `src/shared`、`src/legacy-template` 和 `src/paged-html` 下建立清晰的模块边界，并让 browser snapshot 输出成为后续样式映射和 InDesign instructions 的第一个稳定 IR。本计划暂不升级 JSX executor；当前只为 Node 侧基础和资源识别模型做准备。

**技术栈：** Node.js CommonJS、`node:test`、`assert/strict`、`cheerio`、Playwright Chromium，以及作为参考的现有 ExtendScript 文件。

---

## 范围确认

本计划只实现 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 中的第一个子项目：

- 架构目录与模块边界。
- 共享的 geometry、label、asset 和 report 工具。
- 保持现有 `builder.js` 和 `validator.js` 行为不变的 legacy wrapper。
- Browser 页面检测与元素快照捕获。
- 对 raster image、PDF、PSD、AI 和 SVG 的资源类型识别。
- 为后续 compiler 输出稳定 JSON 的 Snapshot API。

本计划不实现：

- CSS -> InDesign 样式资源编译器。
- 面向新 snapshot 格式的 build instructions compiler。
- InDesign executor 升级。
- JSX 中的 PDF page/crop 放置能力。
- 完整的反向 InDesign -> HTML 导出。

这些属于独立的实施计划。

## 文件结构

创建以下职责清晰的模块：

```text
src/
  shared/
    geometry.js
    labels.js
    assets.js
    report.js
  legacy-template/
    builder.js
    validator.js
    index.js
  paged-html/
    page-detector.js
    element-detector.js
    asset-detector.js
    style-reader.js
    stacking.js
    browser-snapshot.js
    index.js

test/
  fixtures/
    paged-html/
      basic-deck.html
      asset-deck.html
      nested-layout-deck.html
  shared/
    geometry.test.js
    labels.test.js
    assets.test.js
  legacy-template/
    wrappers.test.js
  paged-html/
    browser-snapshot.test.js
    asset-detector.test.js
```

本计划期间，现有文件保持原位：

| 现有文件 | 在本计划中的用途 |
| ------------- | ---------------- |
| `src/builder.js` | 由 `src/legacy-template/builder.js` 包装；暂不移动 |
| `src/validator.js` | 由 `src/legacy-template/validator.js` 包装；暂不移动 |
| `src/generator.js` | 仅作参考；不修改 |
| `src/spec-generator.js` | 仅作参考；不修改 |
| `_indesign_scripts/extract_blueprint.jsx` | 作为后续样式/链接提取参考；不修改 |
| `_indesign_scripts/build_from_instructions.jsx` | 作为后续 executor 升级参考；不修改 |

后续工作的模块规模规则：

- 新 JS 模块应尽量控制在 250 行以内。
- 如果模块超过 400 行，继续加功能前先按职责拆分。
- Browser snapshot 代码不得解析 InDesign instructions。
- Shared utilities 不得引入 browser 或 InDesign 专属模块。

---

### 任务 1：测试基座与 Fixtures

**文件：**
- 修改：`D:\AI\html-indesign\package.json`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\basic-deck.html`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\asset-deck.html`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\nested-layout-deck.html`

- [ ] **步骤 1：添加 Node 测试脚本和 Playwright 开发依赖**

把 `package.json` 更新为以下精确结构，同时保留现有包元数据：

```json
{
  "name": "html-indesign",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\""
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "cheerio": "^1.1.2"
  },
  "devDependencies": {
    "playwright": "^1.56.0"
  }
}
```

- [ ] **步骤 2：安装依赖**

运行：

```bash
npm install
```

预期：`package-lock.json` 更新，且命令以状态码 `0` 退出。

- [ ] **步骤 3：创建 `basic-deck.html`**

创建 `test/fixtures/paged-html/basic-deck.html`：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: 528mm 297mm; margin: 0; }
    body { margin: 0; font-family: Arial, sans-serif; }
    .page {
      width: 528mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
    }
    .title {
      position: absolute;
      left: 15mm;
      top: 20mm;
      width: 220mm;
      height: 24mm;
      font-size: 30pt;
      line-height: 34pt;
      color: #333333;
      z-index: 10;
    }
    .body {
      position: absolute;
      left: 15mm;
      top: 52mm;
      width: 220mm;
      height: 80mm;
      font-size: 14pt;
      line-height: 21pt;
      color: #666666;
      z-index: 11;
    }
  </style>
</head>
<body>
  <main class="deck">
    <section class="page" data-page id="page-1">
      <h1 class="title">项目标题</h1>
      <p class="body">这是一个分页 HTML 测试页面。</p>
    </section>
    <section class="page" data-page id="page-2">
      <h1 class="title">第二页</h1>
      <p class="body">第二页正文。</p>
    </section>
  </main>
</body>
</html>
```

- [ ] **步骤 4：创建 `asset-deck.html`**

创建 `test/fixtures/paged-html/asset-deck.html`：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; }
    .page {
      width: 528mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: white;
    }
    .render {
      position: absolute;
      left: 15mm;
      top: 20mm;
      width: 220mm;
      height: 140mm;
      object-fit: cover;
      object-position: center center;
      z-index: 20;
    }
    .drawing {
      position: absolute;
      left: 250mm;
      top: 20mm;
      width: 250mm;
      height: 180mm;
      z-index: 21;
    }
    .psd {
      position: absolute;
      left: 15mm;
      top: 180mm;
      width: 100mm;
      height: 70mm;
      object-fit: contain;
      z-index: 22;
    }
    .ai {
      position: absolute;
      left: 130mm;
      top: 180mm;
      width: 100mm;
      height: 70mm;
      z-index: 23;
    }
  </style>
</head>
<body>
  <section class="page" data-page id="asset-page">
    <img class="render" src="./assets/render.jpg" data-id-object alt="render">
    <object class="drawing"
            data="./assets/site-plan.pdf"
            type="application/pdf"
            data-id-object
            data-id-asset-kind="pdf"
            data-id-page="3"
            data-id-crop="trim"
            data-id-fit="contain"></object>
    <img class="psd"
         src="./assets/lobby.psd"
         data-id-object
         data-id-asset-kind="psd"
         data-id-layer-comp="presentation"
         alt="psd">
    <img class="ai"
         src="./assets/axon.ai"
         data-id-object
         data-id-asset-kind="ai"
         data-id-artboard="2"
         alt="ai">
  </section>
</body>
</html>
```

- [ ] **步骤 5：创建 `nested-layout-deck.html`**

创建 `test/fixtures/paged-html/nested-layout-deck.html`：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; }
    .page {
      width: 528mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: #f8f8f8;
    }
    .grid {
      position: absolute;
      left: 15mm;
      top: 20mm;
      width: 498mm;
      height: 240mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
    }
    .card {
      position: relative;
      background: #ffffff;
      border: 1pt solid #999999;
      border-radius: 2mm;
      overflow: hidden;
    }
    .card h2 {
      position: absolute;
      left: 8mm;
      top: 8mm;
      width: 200mm;
      height: 18mm;
      font-size: 18pt;
      line-height: 22pt;
      z-index: 5;
    }
    .card p {
      position: absolute;
      left: 8mm;
      top: 34mm;
      width: 200mm;
      height: 40mm;
      font-size: 12pt;
      line-height: 16pt;
      z-index: 6;
    }
  </style>
</head>
<body>
  <section class="page" data-page id="nested-page">
    <div class="grid">
      <article class="card" data-id-object>
        <h2>案例一</h2>
        <p>卡片内部文本。</p>
      </article>
      <article class="card" data-id-object>
        <h2>案例二</h2>
        <p>另一张卡片。</p>
      </article>
    </div>
  </section>
</body>
</html>
```

- [ ] **步骤 6：运行空测试集**

运行：

```bash
npm test
```

预期：命令以状态码 `0` 退出，并根据 Node 版本报告没有测试文件或零测试。

- [ ] **步骤 7：提交**

```bash
git add package.json package-lock.json test/fixtures/paged-html
git commit -m "test: add paged html fixture harness"
```

---

### 任务 2：共享 Geometry 工具

**文件：**
- 新建：`D:\AI\html-indesign\src\shared\geometry.js`
- 测试：`D:\AI\html-indesign\test\shared\geometry.test.js`

- [ ] **步骤 1：先写会失败的 geometry 测试**

创建 `test/shared/geometry.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCssLength,
  parsePhysicalSize,
  rectPxToMm,
  boundsToGeometricBounds,
} = require('../../src/shared/geometry');

test('parseCssLength parses mm, px, pt, and defaults to px', () => {
  assert.deepEqual(parseCssLength('528mm'), { value: 528, unit: 'mm' });
  assert.deepEqual(parseCssLength('1123px'), { value: 1123, unit: 'px' });
  assert.deepEqual(parseCssLength('12pt'), { value: 12, unit: 'pt' });
  assert.deepEqual(parseCssLength('42'), { value: 42, unit: 'px' });
});

test('parsePhysicalSize extracts width and height from CSS text', () => {
  const size = parsePhysicalSize('width: 528mm; height: 297mm; position: relative;');
  assert.equal(size.widthMm, 528);
  assert.equal(size.heightMm, 297);
});

test('rectPxToMm converts a child rect relative to page rect', () => {
  const rect = rectPxToMm({
    rectPx: { x: 100, y: 50, width: 200, height: 100 },
    pageRectPx: { x: 20, y: 10, width: 1000, height: 500 },
    pageWidthMm: 500,
    pageHeightMm: 250,
  });
  assert.deepEqual(rect, { x: 40, y: 20, width: 100, height: 50 });
});

test('boundsToGeometricBounds returns InDesign y1 x1 y2 x2 order', () => {
  assert.deepEqual(
    boundsToGeometricBounds({ x: 15, y: 20, width: 100, height: 50 }),
    [20, 15, 70, 115]
  );
});
```

- [ ] **步骤 2：运行 geometry 测试并确认失败**

运行：

```bash
node --test test/shared/geometry.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/shared/geometry'`。

- [ ] **步骤 3：实现 `src/shared/geometry.js`**

创建 `src/shared/geometry.js`：

```js
function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseCssLength(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)?$/i);
  if (!match) return null;
  return {
    value: Number(match[1]),
    unit: (match[2] || 'px').toLowerCase(),
  };
}

function cssLengthToMm(length, pxToMm = 25.4 / 96) {
  if (!length) return null;
  if (length.unit === 'mm') return length.value;
  if (length.unit === 'pt') return length.value * 25.4 / 72;
  if (length.unit === 'px') return length.value * pxToMm;
  return null;
}

function parseStyleDeclarations(styleText) {
  const out = {};
  String(styleText || '').split(';').forEach((part) => {
    const index = part.indexOf(':');
    if (index < 0) return;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}

function parsePhysicalSize(styleText, pxToMm = 25.4 / 96) {
  const style = parseStyleDeclarations(styleText);
  const width = cssLengthToMm(parseCssLength(style.width), pxToMm);
  const height = cssLengthToMm(parseCssLength(style.height), pxToMm);
  return {
    widthMm: width == null ? null : round(width),
    heightMm: height == null ? null : round(height),
  };
}

function rectPxToMm({ rectPx, pageRectPx, pageWidthMm, pageHeightMm }) {
  const mmPerPxX = pageWidthMm / pageRectPx.width;
  const mmPerPxY = pageHeightMm / pageRectPx.height;
  return {
    x: round((rectPx.x - pageRectPx.x) * mmPerPxX),
    y: round((rectPx.y - pageRectPx.y) * mmPerPxY),
    width: round(rectPx.width * mmPerPxX),
    height: round(rectPx.height * mmPerPxY),
  };
}

function boundsToGeometricBounds(bounds) {
  return [
    bounds.y,
    bounds.x,
    bounds.y + bounds.height,
    bounds.x + bounds.width,
  ];
}

module.exports = {
  round,
  parseCssLength,
  parseStyleDeclarations,
  parsePhysicalSize,
  rectPxToMm,
  boundsToGeometricBounds,
};
```

- [ ] **步骤 4：运行 geometry 测试并确认通过**

运行：

```bash
node --test test/shared/geometry.test.js
```

预期：PASS，共 4 个测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/shared/geometry.js test/shared/geometry.test.js
git commit -m "feat: add shared geometry utilities"
```

---

### 任务 3：共享 Label 工具与 Legacy Wrappers

**文件：**
- 新建：`D:\AI\html-indesign\src\shared\labels.js`
- 新建：`D:\AI\html-indesign\src\legacy-template\builder.js`
- 新建：`D:\AI\html-indesign\src\legacy-template\validator.js`
- 新建：`D:\AI\html-indesign\src\legacy-template\index.js`
- 测试：`D:\AI\html-indesign\test\shared\labels.test.js`
- 测试：`D:\AI\html-indesign\test\legacy-template\wrappers.test.js`

- [ ] **步骤 1：编写 label 工具测试**

创建 `test/shared/labels.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  normalizeLabel,
  findBySlotName,
} = require('../../src/shared/labels');

test('parseLabeledSegments parses Chinese and English label keys', () => {
  assert.deepEqual(
    parseLabeledSegments('名称：项目英文名\r\n类型：文本\r\n说明：根据项目中文名翻译'),
    { '名称': '项目英文名', '类型': '文本', '说明': '根据项目中文名翻译' }
  );
  assert.deepEqual(
    parseLabeledSegments('name: Hero\nslot: Cover Image\ntype: image'),
    { name: 'Hero', slot: 'Cover Image', type: 'image' }
  );
});

test('parseSlotName returns the stable short slot name', () => {
  assert.equal(parseSlotName('名称：项目英文名\r\n类型：文本'), '项目英文名');
  assert.equal(parseSlotName('slot: Hero Image\ntype: image'), 'Hero Image');
  assert.equal(parseSlotName('Plain Slot'), 'Plain Slot');
});

test('parseSlotType detects image and text labels', () => {
  assert.equal(parseSlotType('名称：主图\r\n类型：图像'), 'IMAGE');
  assert.equal(parseSlotType('slot: Body\ntype: text'), 'TEXT');
  assert.equal(parseSlotType('Plain Slot'), 'TEXT');
});

test('findBySlotName supports exact normalized and short-name lookup', () => {
  const slots = {
    '名称：项目英文名\r\n类型：文本': { id: 'a' },
    '名称：主图\r\n类型：图像': { id: 'b' },
  };
  assert.deepEqual(findBySlotName(slots, '名称：项目英文名\r\n类型：文本'), { key: '名称：项目英文名\r\n类型：文本', value: { id: 'a' } });
  assert.deepEqual(findBySlotName(slots, '项目英文名'), { key: '名称：项目英文名\r\n类型：文本', value: { id: 'a' } });
  assert.deepEqual(findBySlotName(slots, ' 主 图 '), { key: '名称：主图\r\n类型：图像', value: { id: 'b' } });
  assert.equal(findBySlotName(slots, '不存在'), null);
});
```

- [ ] **步骤 2：运行 label 测试并确认失败**

运行：

```bash
node --test test/shared/labels.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/shared/labels'`。

- [ ] **步骤 3：实现 `src/shared/labels.js`**

创建 `src/shared/labels.js`：

```js
function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function parseLabeledSegments(label) {
  const result = {};
  String(label || '').split(/[;；\n\r]+/).forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[:=：]/);
    if (parts.length < 2) return;
    const key = parts.shift().trim();
    const value = parts.join('=').trim();
    if (key && value) result[key] = value;
  });
  return result;
}

function firstSegmentValue(segments, keys) {
  for (const key of Object.keys(segments)) {
    if (keys.includes(key.toLowerCase())) return segments[key];
  }
  return null;
}

function parseSlotName(label) {
  const segments = parseLabeledSegments(label);
  return firstSegmentValue(segments, ['名称', '名字', '槽位', 'slot', 'name']) || label;
}

function parseSlotType(label) {
  const segments = parseLabeledSegments(label);
  const raw = firstSegmentValue(segments, ['类型', 'type']);
  const upper = String(raw || '').toUpperCase();
  if (upper.includes('图') || upper.includes('IMAGE')) return 'IMAGE';
  return 'TEXT';
}

function findBySlotName(slots, requestedName) {
  if (!slots || !requestedName) return null;
  if (Object.prototype.hasOwnProperty.call(slots, requestedName)) {
    return { key: requestedName, value: slots[requestedName] };
  }
  const requestedNorm = normalizeLabel(requestedName);
  for (const key of Object.keys(slots)) {
    if (normalizeLabel(key) === requestedNorm) {
      return { key, value: slots[key] };
    }
  }
  for (const key of Object.keys(slots)) {
    if (normalizeLabel(parseSlotName(key)) === requestedNorm) {
      return { key, value: slots[key] };
    }
  }
  return null;
}

module.exports = {
  normalizeLabel,
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  findBySlotName,
};
```

- [ ] **步骤 4：运行 label 测试并确认通过**

运行：

```bash
node --test test/shared/labels.test.js
```

预期：PASS，共 4 个测试通过。

- [ ] **步骤 5：编写 legacy wrapper 测试**

创建 `test/legacy-template/wrappers.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('legacy-template wrappers expose existing builder and validator', () => {
  const legacy = require('../../src/legacy-template');
  assert.equal(typeof legacy.buildInstructions, 'function');
  assert.equal(typeof legacy.validate, 'function');
  assert.equal(typeof legacy.ERRORS, 'object');
});
```

- [ ] **步骤 6：运行 wrapper 测试并确认失败**

运行：

```bash
node --test test/legacy-template/wrappers.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/legacy-template'`。

- [ ] **步骤 7：实现 legacy wrappers**

创建 `src/legacy-template/builder.js`：

```js
module.exports = require('../builder');
```

创建 `src/legacy-template/validator.js`：

```js
module.exports = require('../validator');
```

创建 `src/legacy-template/index.js`：

```js
const { buildInstructions } = require('./builder');
const { validate, ERRORS } = require('./validator');

module.exports = {
  buildInstructions,
  validate,
  ERRORS,
};
```

- [ ] **步骤 8：运行 wrapper 测试并确认通过**

运行：

```bash
node --test test/legacy-template/wrappers.test.js
```

预期：PASS，共 1 个测试通过。

- [ ] **步骤 9：提交**

```bash
git add src/shared/labels.js src/legacy-template test/shared/labels.test.js test/legacy-template/wrappers.test.js
git commit -m "feat: add shared labels and legacy wrappers"
```

---

### 任务 4：共享 Asset 识别

**文件：**
- 新建：`D:\AI\html-indesign\src\shared\assets.js`
- 测试：`D:\AI\html-indesign\test\shared\assets.test.js`

- [ ] **步骤 1：编写 asset 工具测试**

创建 `test/shared/assets.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
} = require('../../src/shared/assets');

test('inferAssetKind maps architecture presentation asset extensions', () => {
  assert.equal(inferAssetKind('render.jpg'), 'raster');
  assert.equal(inferAssetKind('render.PNG'), 'raster');
  assert.equal(inferAssetKind('drawing.pdf'), 'pdf');
  assert.equal(inferAssetKind('lobby.psd'), 'psd');
  assert.equal(inferAssetKind('axon.ai'), 'ai');
  assert.equal(inferAssetKind('diagram.svg'), 'svg');
  assert.equal(inferAssetKind('unknown.xyz'), 'unknown');
});

test('assetSourceFromElementLike reads img src object data and explicit kind', () => {
  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'IMG',
    attributes: { src: 'a.psd', 'data-id-asset-kind': 'psd' },
  }), { src: 'a.psd', explicitKind: 'psd' });

  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'OBJECT',
    attributes: { data: 'plan.pdf', type: 'application/pdf' },
  }), { src: 'plan.pdf', explicitKind: 'pdf' });
});

test('createAssetId is stable and filename based', () => {
  assert.equal(createAssetId('./assets/site-plan.pdf'), 'asset-site-plan-pdf');
  assert.equal(createAssetId('C:/Project/Renders/Lobby View.PNG'), 'asset-lobby-view-png');
});
```

- [ ] **步骤 2：运行 asset 测试并确认失败**

运行：

```bash
node --test test/shared/assets.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/shared/assets'`。

- [ ] **步骤 3：实现 `src/shared/assets.js`**

创建 `src/shared/assets.js`：

```js
const path = require('path');

const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.bmp']);

function cleanKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  if (['raster', 'pdf', 'psd', 'ai', 'svg', 'vector', 'fallback'].includes(kind)) return kind;
  return null;
}

function inferAssetKind(src, explicitKind) {
  const cleanExplicit = cleanKind(explicitKind);
  if (cleanExplicit) return cleanExplicit;
  const ext = path.extname(String(src || '').split(/[?#]/)[0]).toLowerCase();
  if (RASTER_EXTENSIONS.has(ext)) return 'raster';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.psd') return 'psd';
  if (ext === '.ai') return 'ai';
  if (ext === '.svg') return 'svg';
  return 'unknown';
}

function assetSourceFromElementLike(element) {
  const tagName = String(element.tagName || '').toUpperCase();
  const attrs = element.attributes || {};
  const explicitKind = cleanKind(attrs['data-id-asset-kind']);
  if (tagName === 'IMG') return { src: attrs.src || null, explicitKind };
  if (tagName === 'OBJECT') {
    const type = String(attrs.type || '').toLowerCase();
    return {
      src: attrs.data || null,
      explicitKind: explicitKind || (type === 'application/pdf' ? 'pdf' : null),
    };
  }
  if (tagName === 'EMBED') {
    const type = String(attrs.type || '').toLowerCase();
    return {
      src: attrs.src || null,
      explicitKind: explicitKind || (type === 'application/pdf' ? 'pdf' : null),
    };
  }
  return { src: attrs.src || attrs.href || attrs.data || null, explicitKind };
}

function createAssetId(src) {
  const raw = path.basename(String(src || 'asset')).replace(/\.[^.]+$/, '') + path.extname(String(src || 'asset'));
  const safe = raw
    .replace(/\.[^.]+$/, (ext) => '-' + ext.slice(1))
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `asset-${safe || 'unknown'}`;
}

module.exports = {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
};
```

- [ ] **步骤 4：运行 asset 测试并确认通过**

运行：

```bash
node --test test/shared/assets.test.js
```

预期：PASS，共 3 个测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/shared/assets.js test/shared/assets.test.js
git commit -m "feat: add shared asset detection"
```

---

### 任务 5：Browser 页面 Snapshot 核心

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\page-detector.js`
- 新建：`D:\AI\html-indesign\src\paged-html\style-reader.js`
- 新建：`D:\AI\html-indesign\src\paged-html\stacking.js`
- 新建：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 新建：`D:\AI\html-indesign\src\paged-html\index.js`
- 测试：`D:\AI\html-indesign\test\paged-html\browser-snapshot.test.js`

- [ ] **步骤 1：编写 browser snapshot 页面测试**

创建 `test/paged-html/browser-snapshot.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot captures fixed-size paged HTML pages', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });

  assert.equal(snapshot.pages.length, 2);
  assert.equal(snapshot.pages[0].id, 'page-1');
  assert.equal(snapshot.pages[0].widthMm, 528);
  assert.equal(snapshot.pages[0].heightMm, 297);
  assert.equal(snapshot.pages[0].items.some((item) => item.role === 'text' && item.text.includes('项目标题')), true);
  assert.equal(snapshot.pages[1].items.some((item) => item.role === 'text' && item.text.includes('第二页')), true);
});

test('renderSnapshot computes element bounds in page millimeters', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const title = snapshot.pages[0].items.find((item) => item.text.includes('项目标题'));

  assert.equal(title.boundsMm.x, 15);
  assert.equal(title.boundsMm.y, 20);
  assert.equal(title.boundsMm.width, 220);
  assert.equal(title.boundsMm.height, 24);
  assert.equal(title.zIndex, 10);
});
```

- [ ] **步骤 2：运行 browser snapshot 测试并确认失败**

运行：

```bash
node --test test/paged-html/browser-snapshot.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/paged-html'`。

- [ ] **步骤 3：实现 `src/paged-html/style-reader.js`**

创建 `src/paged-html/style-reader.js`：

```js
const SNAPSHOT_STYLE_PROPS = [
  'position',
  'display',
  'left',
  'top',
  'width',
  'height',
  'zIndex',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderRadius',
  'opacity',
  'objectFit',
  'objectPosition',
  'overflow',
  'transform',
];

function pickComputedStyle(style) {
  const out = {};
  for (const prop of SNAPSHOT_STYLE_PROPS) {
    out[prop] = style[prop];
  }
  return out;
}

module.exports = {
  SNAPSHOT_STYLE_PROPS,
  pickComputedStyle,
};
```

- [ ] **步骤 4：实现 `src/paged-html/stacking.js`**

创建 `src/paged-html/stacking.js`：

```js
function parseZIndex(value, fallback = 0) {
  if (value == null || value === '' || value === 'auto') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  parseZIndex,
};
```

- [ ] **步骤 5：实现 `src/paged-html/page-detector.js`**

创建 `src/paged-html/page-detector.js`：

```js
function defaultPageSelector() {
  return '[data-page], .page';
}

module.exports = {
  defaultPageSelector,
};
```

- [ ] **步骤 6：实现 `src/paged-html/browser-snapshot.js`**

创建 `src/paged-html/browser-snapshot.js`：

```js
const path = require('path');
const { chromium } = require('playwright');
const { rectPxToMm, round } = require('../shared/geometry');
const { defaultPageSelector } = require('./page-detector');

async function renderSnapshot(options) {
  const htmlPath = path.resolve(options.htmlPath);
  const pageSelector = options.pageSelector || defaultPageSelector();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map((img) => img.complete ? undefined : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
    });

    const raw = await page.evaluate((selector) => {
      function styleObject(el) {
        const style = getComputedStyle(el);
        return {
          position: style.position,
          display: style.display,
          zIndex: style.zIndex,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderTopColor: style.borderTopColor,
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderRadius: style.borderRadius,
          opacity: style.opacity,
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
          overflow: style.overflow,
          transform: style.transform,
        };
      }
      function rectObject(rect) {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      function attrs(el) {
        const out = {};
        for (const attr of Array.from(el.attributes || [])) out[attr.name] = attr.value;
        return out;
      }
      const pageEls = Array.from(document.querySelectorAll(selector));
      return pageEls.map((pageEl, pageIndex) => {
        const pageRect = rectObject(pageEl.getBoundingClientRect());
        const pageStyle = getComputedStyle(pageEl);
        const candidates = Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,[data-id-object]'));
        return {
          id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
          index: pageIndex,
          rectPx: pageRect,
          widthCss: pageStyle.width,
          heightCss: pageStyle.height,
          items: candidates.map((el, itemIndex) => ({
            id: el.id || el.getAttribute('data-id') || `p${pageIndex + 1}-el${itemIndex + 1}`,
            tagName: el.tagName.toLowerCase(),
            classList: Array.from(el.classList || []),
            attributes: attrs(el),
            rectPx: rectObject(el.getBoundingClientRect()),
            text: el.innerText || el.textContent || '',
            computedStyle: styleObject(el),
          })),
        };
      });
    }, pageSelector);

    const pages = raw.map((pageInfo) => {
      const widthMm = cssPixelsToMm(pageInfo.rectPx.width);
      const heightMm = cssPixelsToMm(pageInfo.rectPx.height);
      return {
        id: pageInfo.id,
        index: pageInfo.index,
        widthMm: round(widthMm),
        heightMm: round(heightMm),
        rectPx: pageInfo.rectPx,
        mmPerPxX: round(widthMm / pageInfo.rectPx.width),
        mmPerPxY: round(heightMm / pageInfo.rectPx.height),
        items: pageInfo.items
          .filter((item) => item.rectPx.width > 0 && item.rectPx.height > 0)
          .map((item) => ({
            id: item.id,
            role: roleFromTag(item.tagName),
            sourceSelector: selectorFor(item),
            tagName: item.tagName,
            classList: item.classList,
            attributes: item.attributes,
            text: item.text.trim(),
            rectPx: item.rectPx,
            boundsMm: rectPxToMm({
              rectPx: item.rectPx,
              pageRectPx: pageInfo.rectPx,
              pageWidthMm: widthMm,
              pageHeightMm: heightMm,
            }),
            zIndex: parseZIndex(item.computedStyle.zIndex),
            computedStyle: item.computedStyle,
          })),
      };
    });

    return {
      metadata: {
        source: htmlPath,
        capturedAt: new Date().toISOString(),
      },
      pages,
      assets: [],
      warnings: [],
    };
  } finally {
    await browser.close();
  }
}

function cssPixelsToMm(px) {
  return px * 25.4 / 96;
}

function parseZIndex(value) {
  if (value == null || value === 'auto') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roleFromTag(tagName) {
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName)) return 'text';
  if (['img', 'object', 'embed', 'svg', 'canvas'].includes(tagName)) return 'graphic';
  if (tagName === 'table') return 'table';
  return 'shape';
}

function selectorFor(item) {
  if (item.attributes.id) return `#${item.attributes.id}`;
  if (item.classList.length) return `${item.tagName}.${item.classList.join('.')}`;
  return item.tagName;
}

module.exports = {
  renderSnapshot,
};
```

- [ ] **步骤 7：实现 `src/paged-html/index.js`**

创建 `src/paged-html/index.js`：

```js
const { renderSnapshot } = require('./browser-snapshot');

module.exports = {
  renderSnapshot,
};
```

- [ ] **步骤 8：运行 browser snapshot 测试并确认通过**

运行：

```bash
node --test test/paged-html/browser-snapshot.test.js
```

预期：PASS，共 2 个测试通过。

- [ ] **步骤 9：提交**

```bash
git add src/paged-html test/paged-html/browser-snapshot.test.js
git commit -m "feat: capture paged html browser snapshot"
```

---

### 任务 6：Paged HTML Asset 识别

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\asset-detector.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 测试：`D:\AI\html-indesign\test\paged-html\asset-detector.test.js`

- [ ] **步骤 1：编写 asset detector 测试**

创建 `test/paged-html/asset-detector.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot detects raster pdf psd and ai placed assets', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const kinds = snapshot.assets.map((asset) => asset.kind).sort();

  assert.deepEqual(kinds, ['ai', 'pdf', 'psd', 'raster']);

  const pdf = snapshot.assets.find((asset) => asset.kind === 'pdf');
  assert.equal(pdf.id, 'asset-site-plan-pdf');
  assert.equal(pdf.placement.pageNumber, 3);
  assert.equal(pdf.placement.crop, 'trim');
  assert.equal(pdf.placement.fit, 'contain');

  const psd = snapshot.assets.find((asset) => asset.kind === 'psd');
  assert.equal(psd.placement.layerComp, 'presentation');

  const ai = snapshot.assets.find((asset) => asset.kind === 'ai');
  assert.equal(ai.placement.artboard, '2');
});
```

- [ ] **步骤 2：运行 asset detector 测试并确认失败**

运行：

```bash
node --test test/paged-html/asset-detector.test.js
```

预期：FAIL，因为 `snapshot.assets` 为空。

- [ ] **步骤 3：实现 `src/paged-html/asset-detector.js`**

创建 `src/paged-html/asset-detector.js`：

```js
const path = require('path');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
} = require('../shared/assets');

function detectAssetsFromItems(items, htmlPath) {
  const assets = [];
  const seen = new Set();
  for (const item of items) {
    const source = assetSourceFromElementLike({
      tagName: item.tagName,
      attributes: item.attributes,
    });
    if (!source.src) continue;
    const kind = inferAssetKind(source.src, source.explicitKind);
    if (kind === 'unknown') continue;
    const id = createAssetId(source.src);
    if (seen.has(id)) continue;
    seen.add(id);
    assets.push({
      id,
      src: source.src,
      resolvedPath: resolveAssetPath(source.src, htmlPath),
      kind,
      fileName: path.basename(source.src),
      linked: true,
      placement: placementFromAttributes(item.attributes, item.computedStyle),
      sourceSelector: item.sourceSelector,
    });
  }
  return assets;
}

function resolveAssetPath(src, htmlPath) {
  if (/^[a-z]+:\/\//i.test(src)) return src;
  if (/^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('\\\\')) return src;
  return path.resolve(path.dirname(htmlPath), src);
}

function placementFromAttributes(attributes, computedStyle) {
  return {
    fit: attributes['data-id-fit'] || computedStyle.objectFit || 'fill',
    position: computedStyle.objectPosition || '50% 50%',
    pageNumber: attributes['data-id-page'] ? Number(attributes['data-id-page']) : undefined,
    crop: attributes['data-id-crop'] || undefined,
    artboard: attributes['data-id-artboard'] || undefined,
    layerComp: attributes['data-id-layer-comp'] || undefined,
    preserveVector: attributes['data-id-preserve-vector'] === 'true',
  };
}

module.exports = {
  detectAssetsFromItems,
  resolveAssetPath,
  placementFromAttributes,
};
```

- [ ] **步骤 4：把 asset detection 接入 `browser-snapshot.js`**

修改 `src/paged-html/browser-snapshot.js` 的 imports：

```js
const { detectAssetsFromItems } = require('./asset-detector');
```

将最后的 return 代码块替换为：

```js
    const allItems = pages.flatMap((pageInfo) => pageInfo.items);
    const assets = detectAssetsFromItems(allItems, htmlPath);

    return {
      metadata: {
        source: htmlPath,
        capturedAt: new Date().toISOString(),
      },
      pages,
      assets,
      warnings: [],
    };
```

- [ ] **步骤 5：运行 asset detector 测试并确认通过**

运行：

```bash
node --test test/paged-html/asset-detector.test.js
```

预期：PASS，共 1 个测试通过。

- [ ] **步骤 6：运行全部 paged-html 测试**

运行：

```bash
node --test test/paged-html/*.test.js
```

预期：PASS，共 3 个测试通过。

- [ ] **步骤 7：提交**

```bash
git add src/paged-html/asset-detector.js src/paged-html/browser-snapshot.js test/paged-html/asset-detector.test.js
git commit -m "feat: detect placed assets in browser snapshots"
```

---

### 任务 7：Report 工具与 Snapshot Warnings

**文件：**
- 新建：`D:\AI\html-indesign\src\shared\report.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 测试：`D:\AI\html-indesign\test\shared\report.test.js`

- [ ] **步骤 1：编写 report 测试**

创建 `test/shared/report.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createReport, addMessage } = require('../../src/shared/report');

test('createReport stores info warning and error messages', () => {
  const report = createReport();
  addMessage(report, 'info', 'SNAPSHOT_START', 'Snapshot started', { source: 'deck.html' });
  addMessage(report, 'warning', 'UNSUPPORTED_CSS', 'Unsupported CSS property', { property: 'filter' });
  addMessage(report, 'error', 'MISSING_ASSET', 'Asset missing', { src: 'missing.pdf' });

  assert.equal(report.messages.length, 3);
  assert.equal(report.errorCount, 1);
  assert.equal(report.warningCount, 1);
});
```

- [ ] **步骤 2：运行 report 测试并确认失败**

运行：

```bash
node --test test/shared/report.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/shared/report'`。

- [ ] **步骤 3：实现 `src/shared/report.js`**

创建 `src/shared/report.js`：

```js
function createReport() {
  return {
    messages: [],
    errorCount: 0,
    warningCount: 0,
  };
}

function addMessage(report, level, code, message, details = {}) {
  const item = {
    level,
    code,
    message,
    details,
  };
  report.messages.push(item);
  if (level === 'error') report.errorCount += 1;
  if (level === 'warning') report.warningCount += 1;
  return item;
}

module.exports = {
  createReport,
  addMessage,
};
```

- [ ] **步骤 4：运行 report 测试并确认通过**

运行：

```bash
node --test test/shared/report.test.js
```

预期：PASS，共 1 个测试通过。

- [ ] **步骤 5：添加 snapshot report 对象**

修改 `src/paged-html/browser-snapshot.js`，引入 report helpers：

```js
const { createReport, addMessage } = require('../shared/report');
```

在 `renderSnapshot` 内、启动 Chromium 前，添加：

```js
  const report = createReport();
  addMessage(report, 'info', 'SNAPSHOT_START', 'Browser snapshot started', { htmlPath });
```

在返回的 snapshot 对象中加入：

```js
      report,
```

返回对象应同时包含 `warnings: []`（用于兼容）和 `report`（用于新的结构化报告）。

- [ ] **步骤 6：运行全部测试**

运行：

```bash
npm test
```

预期：当前所有测试 PASS。

- [ ] **步骤 7：提交**

```bash
git add src/shared/report.js src/paged-html/browser-snapshot.js test/shared/report.test.js
git commit -m "feat: add structured report utilities"
```

---

### 任务 8：公共入口与架构文档挂钩

**文件：**
- 新建：`D:\AI\html-indesign\index.js`
- 修改：`D:\AI\html-indesign\package.json`
- 修改：`D:\AI\html-indesign\docs\规范\HTML_INDESIGN_LIBRARY_SPEC.md`
- 测试：`D:\AI\html-indesign\test\public-api.test.js`

- [ ] **步骤 1：编写 public API 测试**

创建 `test/public-api.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../index');

test('public API exposes paged-html and legacy-template entry points', () => {
  assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
  assert.equal(typeof api.legacyTemplate.buildInstructions, 'function');
  assert.equal(typeof api.legacyTemplate.validate, 'function');
});
```

- [ ] **步骤 2：运行 public API 测试并确认失败**

运行：

```bash
node --test test/public-api.test.js
```

预期：FAIL，并出现 `Cannot find module '../index'` 或 API 属性缺失。

- [ ] **步骤 3：实现根级 `index.js`**

创建 `index.js`：

```js
const pagedHtml = require('./src/paged-html');
const legacyTemplate = require('./src/legacy-template');

module.exports = {
  pagedHtml,
  legacyTemplate,
};
```

- [ ] **步骤 4：确认 `package.json` 的 main 指向 `index.js`**

确认 `package.json` 包含：

```json
"main": "index.js"
```

- [ ] **步骤 5：向 spec 增加架构进展说明**

在 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 的 `## 14. 与现有代码的关系` 下，于当前迁移表之后加入这一段：

```md
第一阶段实现保留现有 legacy template 文件的位置，并通过 `src/legacy-template/*` wrappers 对外暴露。新的浏览器驱动转换代码放在 `src/paged-html/*` 下，可复用工具放在 `src/shared/*` 下。这样既保留当前模板驱动工作流，又把 paged HTML 工作流作为独立路径引入。
```

- [ ] **步骤 6：运行 public API 测试和全部测试**

运行：

```bash
node --test test/public-api.test.js
npm test
```

预期：两个命令都以状态码 `0` 退出。

- [ ] **步骤 7：提交**

```bash
git add index.js package.json docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md test/public-api.test.js
git commit -m "feat: expose html-indesign public api"
```

---

## 最终验证

- [ ] **步骤 1：运行全部 Node 测试**

运行：

```bash
npm test
```

预期：所有测试通过。

- [ ] **步骤 2：运行现有 legacy 合规脚本**

运行：

```bash
node test/workspace/run_test.js
```

预期：validator 报告 valid，builder 生成 2 页，且 errors 为空。打印出的 summary 仍可能把旧的 `slots/freeItems` 计数显示为 0，因为该脚本的汇总字段已过时；在本计划中不要把这个旧 summary 视为失败。

- [ ] **步骤 3：检查 git status**

运行：

```bash
git status --short
```

预期：在最终提交前，只有本计划有意修改的文件处于 modified 或 untracked 状态。

## 自检清单

本计划的 spec 覆盖范围：

- `PageModel` geometry：由任务 2 和任务 5 覆盖。
- `PageItemModel` 基础能力：由任务 5 覆盖。
- `AssetModel` detection：由任务 4 和任务 6 覆盖。
- Legacy workflow 保持：由任务 3 覆盖。
- Architecture boundaries：由“文件结构”和任务 8 覆盖。
- Report model 起步：由任务 7 覆盖。

明确不在本计划内的 spec 范围：

- 面向 swatches、fonts、paragraph styles、character styles、object styles 和 frame styles 的 style compiler。
- 面向新 snapshot model 的 build instructions compiler。
- InDesign executor 对 linked PDF/PSD/AI/SVG 放置的支持。
- 面向新工作流的真实 InDesign 端到端测试。

类型一致性：

- 公共入口：`require('./index').pagedHtml.renderSnapshot`。
- Snapshot pages 使用 `pages[].items[]`。
- Item geometry 使用 `boundsMm`。
- Asset records 使用 `kind`、`resolvedPath` 和 `placement`。
