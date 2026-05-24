# Paged HTML To Instructions Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在现有 browser snapshot 基础上实现 Node 侧 `Paged HTML -> style resources -> styleRefs -> InDesign build instructions JSON` 编译链路。

**架构：** 保持 `renderSnapshot()` 作为浏览器布局真相来源，新建样式工具、样式资源编译器、instructions 编译器和 instructions validator。输出仍停留在 JSON 层，不升级 `_indesign_scripts/build_from_instructions.jsx`，避免把 Node 侧语义编译和 InDesign 执行调试混在一个计划里。

**技术栈：** Node.js CommonJS、`node:test`、`assert/strict`、Playwright Chromium、现有 `src/paged-html/*`、`src/shared/*`。

---

## 范围确认

本计划实现 `docs/HTML_INDESIGN_LIBRARY_SPEC.md` 中 HTML -> InDesign 第一阶段的第二个实施包：

- 扩展 browser snapshot 的 computed style 与文本 run 捕获。
- 编译 swatches、fonts、paragraph styles、character styles、object styles、frame styles。
- 给 snapshot items 增加 `styleRefs` 和可编译 `content`。
- 编译 build instructions JSON。
- 验证 build instructions 的基本结构和引用一致性。
- 扩展公共 API。

本计划不实现：

- `_indesign_scripts/build_from_instructions.jsx` 对新 instructions schema 的执行升级。
- 真实 InDesign 色板、段落样式、对象样式创建。
- PDF/PSD/AI/SVG 的真实置入执行。
- CLI 命令。
- 任意网页分页。

## 文件结构

新增和修改以下模块：

```text
src/
  paged-html/
    browser-snapshot.js          # 扩展 computedStyle 与 text runs 捕获
    style-reader.js              # 扩展 snapshot 样式字段列表
    style-utils.js               # 颜色、长度、样式命名、稳定 hash
    style-compiler.js            # snapshot -> style resources + styleRefs
    instructions-compiler.js     # styled snapshot -> build instructions JSON
    instructions-validator.js    # instructions 基础结构和引用校验
    index.js                     # 导出 compileStyles / compileInstructions / validateInstructions

test/
  fixtures/
    paged-html/
      style-deck.html
  paged-html/
    snapshot-style-runs.test.js
    style-utils.test.js
    style-compiler.test.js
    instructions-compiler.test.js
    instructions-validator.test.js
  public-api.test.js
```

模块边界：

| 模块 | 职责 | 不做什么 |
| ---- | ---- | -------- |
| `style-utils.js` | 纯函数：颜色、长度、命名、hash | 不读取 snapshot，不生成 instructions |
| `style-compiler.js` | 生成 style model，给 item/runs 写 `styleRefs` | 不创建 InDesign 对象，不访问文件系统 |
| `instructions-compiler.js` | 把 styled snapshot 编译为 build instructions JSON | 不执行 JSX，不校验真实字体是否存在 |
| `instructions-validator.js` | 校验 instructions 基础结构和引用 | 不修复数据，不调用 browser |
| `browser-snapshot.js` | 捕获浏览器布局和 computed style | 不做 InDesign 样式推理 |

---

### 任务 1：扩展 Snapshot 样式与文本 Runs

**文件：**
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\style-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\snapshot-style-runs.test.js`
- 修改：`D:\AI\html-indesign\src\paged-html\style-reader.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`

- [ ] **步骤 1：创建样式 fixture**

创建 `test/fixtures/paged-html/style-deck.html`：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
    }
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
      top: 18mm;
      width: 260mm;
      height: 30mm;
      margin: 0 0 6mm 0;
      font-family: Arial, sans-serif;
      font-size: 30pt;
      line-height: 34pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.5pt;
      color: #123456;
      z-index: 30;
    }
    .accent {
      color: #c8102e;
      font-weight: 700;
      font-style: italic;
      letter-spacing: 1pt;
    }
    .caption {
      position: absolute;
      left: 15mm;
      top: 55mm;
      width: 180mm;
      height: 18mm;
      margin: 0;
      font-size: 10pt;
      line-height: 13pt;
      color: #666666;
      z-index: 31;
    }
    .metric-card {
      position: absolute;
      left: 300mm;
      top: 24mm;
      width: 160mm;
      height: 80mm;
      padding: 6mm 8mm;
      background: #f2f2f2;
      border: 2pt solid #333333;
      border-radius: 2mm;
      opacity: 0.85;
      z-index: 20;
    }
    .hero-render {
      position: absolute;
      left: 15mm;
      top: 90mm;
      width: 240mm;
      height: 150mm;
      object-fit: cover;
      object-position: left top;
      z-index: 10;
    }
  </style>
</head>
<body>
  <section class="page" data-page id="style-page">
    <h1 class="title" data-id-paragraph-style="report-title">
      城市更新 <span class="accent" data-id-character-style="accent">重点</span>
    </h1>
    <p class="caption">建筑设计汇报图注</p>
    <div class="metric-card" data-id-object data-id-object-style="metric-card">
      <p>指标卡片</p>
    </div>
    <img class="hero-render"
         src="./assets/render.jpg"
         data-id-object
         data-id-frame-style="hero-image-frame"
         alt="render">
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败的 snapshot 样式 runs 测试**

创建 `test/paged-html/snapshot-style-runs.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot captures style properties needed by InDesign style compilation', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages[0];
  const title = page.items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const card = page.items.find((item) => item.attributes['data-id-object-style'] === 'metric-card');
  const image = page.items.find((item) => item.attributes['data-id-frame-style'] === 'hero-image-frame');

  assert.equal(title.computedStyle.textAlign, 'center');
  assert.equal(title.computedStyle.fontWeight, '700');
  assert.ok(parseFloat(title.computedStyle.marginBottom) > 20);
  assert.equal(card.computedStyle.paddingLeft.endsWith('px'), true);
  assert.equal(card.computedStyle.borderTopStyle, 'solid');
  assert.equal(image.computedStyle.objectFit, 'cover');
  assert.equal(image.computedStyle.objectPosition, '0% 0%');
});

test('renderSnapshot captures inline character runs for text items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const title = snapshot.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const accentRun = title.runs.find((run) => run.attributes['data-id-character-style'] === 'accent');

  assert.equal(Array.isArray(title.runs), true);
  assert.equal(accentRun.text, '重点');
  assert.equal(accentRun.tagName, 'span');
  assert.equal(accentRun.computedStyle.fontStyle, 'italic');
  assert.match(accentRun.computedStyle.color, /rgb\(200,\s*16,\s*46\)/);
});
```

- [ ] **步骤 3：运行 snapshot 样式 runs 测试并确认失败**

运行：

```bash
node --test test/paged-html/snapshot-style-runs.test.js
```

预期：FAIL，失败点为 `computedStyle.textAlign` 或 `title.runs` 缺失。

- [ ] **步骤 4：扩展 `style-reader.js` 样式字段**

把 `src/paged-html/style-reader.js` 替换为：

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
  'textAlign',
  'textDecorationLine',
  'textTransform',
  'verticalAlign',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'backgroundColor',
  'borderTopColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderRightColor',
  'borderRightWidth',
  'borderRightStyle',
  'borderBottomColor',
  'borderBottomWidth',
  'borderBottomStyle',
  'borderLeftColor',
  'borderLeftWidth',
  'borderLeftStyle',
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

- [ ] **步骤 5：扩展 `browser-snapshot.js` 的浏览器端 styleObject 与 runs 捕获**

在 `src/paged-html/browser-snapshot.js` 的 `page.evaluate((selector) => { ... })` 内，把当前 `styleObject` 函数替换为：

```js
      const snapshotStyleProps = [
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
        'textAlign',
        'textDecorationLine',
        'textTransform',
        'verticalAlign',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'backgroundColor',
        'borderTopColor',
        'borderTopWidth',
        'borderTopStyle',
        'borderRightColor',
        'borderRightWidth',
        'borderRightStyle',
        'borderBottomColor',
        'borderBottomWidth',
        'borderBottomStyle',
        'borderLeftColor',
        'borderLeftWidth',
        'borderLeftStyle',
        'borderRadius',
        'opacity',
        'objectFit',
        'objectPosition',
        'overflow',
        'transform',
      ];
      function styleObject(el) {
        const style = getComputedStyle(el);
        const out = {};
        for (const prop of snapshotStyleProps) {
          out[prop] = style[prop];
        }
        return out;
      }
```

在同一个 `page.evaluate` 内，紧跟 `attrs(el)` 函数后添加：

```js
      function classList(el) {
        return Array.from(el.classList || []);
      }
      function isTextTag(tagName) {
        return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName);
      }
      function textRunsFor(el) {
        const tagName = el.tagName.toLowerCase();
        if (!isTextTag(tagName)) return [];
        const inlineSelector = 'span,strong,b,em,i,mark,sup,sub,[data-id-character-style]';
        const inlineEls = Array.from(el.querySelectorAll(inlineSelector));
        if (inlineEls.length === 0) {
          return [{
            text: (el.innerText || el.textContent || '').trim(),
            tagName,
            classList: classList(el),
            attributes: attrs(el),
            computedStyle: styleObject(el),
          }].filter((run) => run.text);
        }
        return inlineEls.map((runEl) => ({
          text: (runEl.innerText || runEl.textContent || '').trim(),
          tagName: runEl.tagName.toLowerCase(),
          classList: classList(runEl),
          attributes: attrs(runEl),
          computedStyle: styleObject(runEl),
        })).filter((run) => run.text);
      }
```

在 candidates `map` 的 item 对象中加入 `runs`：

```js
            runs: textRunsFor(el),
```

在 Node 侧 item map 的输出对象中加入：

```js
            runs: item.runs,
```

- [ ] **步骤 6：运行 snapshot 样式 runs 测试并确认通过**

运行：

```bash
node --test test/paged-html/snapshot-style-runs.test.js
```

预期：PASS，共 2 个测试通过。

- [ ] **步骤 7：运行既有 paged-html 测试**

运行：

```bash
node --test test/paged-html/*.test.js
```

预期：PASS，既有 browser snapshot 与 asset detector 测试保持通过。

- [ ] **步骤 8：提交**

```bash
git add src/paged-html/browser-snapshot.js src/paged-html/style-reader.js test/fixtures/paged-html/style-deck.html test/paged-html/snapshot-style-runs.test.js
git commit -m "feat: capture style runs in paged html snapshots"
```

---

### 任务 2：样式编译工具函数

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\style-utils.js`
- 新建：`D:\AI\html-indesign\test\paged-html\style-utils.test.js`

- [ ] **步骤 1：写失败的 style-utils 测试**

创建 `test/paged-html/style-utils.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCssColor,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
} = require('../../src/paged-html/style-utils');

test('normalizeCssColor converts browser rgb colors to hex swatches', () => {
  assert.deepEqual(normalizeCssColor('rgb(18, 52, 86)'), { hex: '#123456', name: 'color-123456' });
  assert.deepEqual(normalizeCssColor('rgba(200, 16, 46, 1)'), { hex: '#c8102e', name: 'color-c8102e' });
  assert.equal(normalizeCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(normalizeCssColor('transparent'), null);
});

test('cssLengthToPt converts px pt and mm to InDesign points', () => {
  assert.equal(cssLengthToPt('40px'), 30);
  assert.equal(cssLengthToPt('30pt'), 30);
  assert.equal(cssLengthToPt('25.4mm'), 72);
  assert.equal(cssLengthToPt('normal'), null);
});

test('sanitizeStyleName keeps stable human-readable style names', () => {
  assert.equal(sanitizeStyleName('report-title'), 'report-title');
  assert.equal(sanitizeStyleName('Metric Card'), 'Metric-Card');
  assert.equal(sanitizeStyleName('  重点 标题  '), '重点-标题');
});

test('stableAutoName generates deterministic auto names from signatures', () => {
  const a = stableAutoName('paragraph', { fontSize: 30, fillColor: 'color-123456' });
  const b = stableAutoName('paragraph', { fontSize: 30, fillColor: 'color-123456' });
  assert.equal(a, b);
  assert.match(a, /^auto-paragraph-[a-f0-9]{8}$/);
});

test('firstClassName ignores empty class lists', () => {
  assert.equal(firstClassName({ classList: ['title', 'large'] }), 'title');
  assert.equal(firstClassName({ classList: [] }), null);
});
```

- [ ] **步骤 2：运行 style-utils 测试并确认失败**

运行：

```bash
node --test test/paged-html/style-utils.test.js
```

预期：FAIL，并出现 `Cannot find module '../../src/paged-html/style-utils'`。

- [ ] **步骤 3：实现 `style-utils.js`**

创建 `src/paged-html/style-utils.js`：

```js
const crypto = require('crypto');
const { parseCssLength, round } = require('../shared/geometry');

function normalizeCssColor(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === 'transparent') return null;
  const rgba = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d?(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/);
  if (!rgba) return null;
  const alpha = rgba[4] == null ? 1 : Number(rgba[4]);
  if (alpha === 0) return null;
  const r = clampColor(Number(rgba[1]));
  const g = clampColor(Number(rgba[2]));
  const b = clampColor(Number(rgba[3]));
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return {
    hex,
    name: `color-${hex.slice(1)}`,
  };
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(value) {
  return value.toString(16).padStart(2, '0');
}

function cssLengthToPt(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  if (parsed.unit === 'pt') return round(parsed.value, 4);
  if (parsed.unit === 'px') return round(parsed.value * 72 / 96, 4);
  if (parsed.unit === 'mm') return round(parsed.value * 72 / 25.4, 4);
  return null;
}

function sanitizeStyleName(value) {
  const safe = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || null;
}

function stableAutoName(prefix, signature) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(sortObject(signature)))
    .digest('hex')
    .slice(0, 8);
  return `auto-${prefix}-${hash}`;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = sortObject(value[key]);
    return out;
  }, {});
}

function firstClassName(item) {
  const first = (item.classList || []).find((name) => String(name || '').trim());
  return first ? sanitizeStyleName(first) : null;
}

function explicitName(attributes, names) {
  for (const name of names) {
    const value = attributes && attributes[name];
    const safe = sanitizeStyleName(value);
    if (safe) return safe;
  }
  return null;
}

module.exports = {
  normalizeCssColor,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
  explicitName,
};
```

- [ ] **步骤 4：运行 style-utils 测试并确认通过**

运行：

```bash
node --test test/paged-html/style-utils.test.js
```

预期：PASS，共 5 个测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/paged-html/style-utils.js test/paged-html/style-utils.test.js
git commit -m "feat: add paged html style utilities"
```

---

### 任务 3：Style Resource Compiler

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\style-compiler.js`
- 新建：`D:\AI\html-indesign\test\paged-html\style-compiler.test.js`
- 修改：`D:\AI\html-indesign\src\paged-html\index.js`

- [ ] **步骤 1：写失败的 style compiler 测试**

创建 `test/paged-html/style-compiler.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileStyles } = require('../../src/paged-html');

test('compileStyles creates swatches fonts and named paragraph styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');

  assert.equal(styled.styles.swatches['color-123456'].value, '#123456');
  assert.equal(styled.styles.fonts.Arial.family, 'Arial');
  assert.equal(title.styleRefs.paragraphStyle, 'report-title');
  assert.equal(styled.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(styled.styles.paragraphStyles['report-title'].leading, 34);
  assert.equal(styled.styles.paragraphStyles['report-title'].fillColor, 'color-123456');
  assert.equal(styled.styles.paragraphStyles['report-title'].justification, 'center');
});

test('compileStyles creates character object and frame styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const card = styled.pages[0].items.find((item) => item.attributes['data-id-object-style'] === 'metric-card');
  const image = styled.pages[0].items.find((item) => item.attributes['data-id-frame-style'] === 'hero-image-frame');
  const accentRun = title.content.runs.find((run) => run.text === '重点');

  assert.equal(accentRun.characterStyle, 'accent');
  assert.equal(styled.styles.characterStyles.accent.fillColor, 'color-c8102e');
  assert.equal(card.styleRefs.objectStyle, 'metric-card');
  assert.equal(styled.styles.objectStyles['metric-card'].fillColor, 'color-f2f2f2');
  assert.equal(styled.styles.objectStyles['metric-card'].strokeColor, 'color-333333');
  assert.equal(image.styleRefs.frameStyle, 'hero-image-frame');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].fit, 'cover');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].position, '0% 0%');
});
```

- [ ] **步骤 2：运行 style compiler 测试并确认失败**

运行：

```bash
node --test test/paged-html/style-compiler.test.js
```

预期：FAIL，并出现 `compileStyles is not a function` 或 `Cannot find module './style-compiler'`。

- [ ] **步骤 3：实现 `style-compiler.js`**

创建 `src/paged-html/style-compiler.js`：

```js
const { createReport, addMessage } = require('../shared/report');
const {
  normalizeCssColor,
  cssLengthToPt,
  stableAutoName,
  firstClassName,
  explicitName,
} = require('./style-utils');

function createEmptyStyleModel() {
  return {
    swatches: {},
    fonts: {},
    compositeFonts: {},
    paragraphStyles: {},
    characterStyles: {},
    objectStyles: {},
    frameStyles: {},
    tableStyles: {},
    cellStyles: {},
  };
}

function compileStyles(snapshot, options = {}) {
  const styles = createEmptyStyleModel();
  const report = createReport();
  addMessage(report, 'info', 'STYLE_COMPILE_START', 'Style resource compilation started', {
    pageCount: snapshot.pages.length,
  });

  const pages = snapshot.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => compileItemStyles(item, styles, report, options)),
  }));

  return {
    metadata: snapshot.metadata,
    pages,
    assets: snapshot.assets || [],
    warnings: snapshot.warnings || [],
    styles,
    report,
  };
}

function compileItemStyles(item, styles, report, options) {
  const styleRefs = {
    swatch: null,
    paragraphStyle: null,
    characterStyles: [],
    objectStyle: null,
    frameStyle: null,
    tableStyle: null,
    cellStyle: null,
  };
  const compiled = {
    ...item,
    styleRefs,
    content: contentForItem(item),
  };

  if (item.role === 'text') {
    styleRefs.paragraphStyle = ensureParagraphStyle(styles, item, report, options);
    compiled.content.runs = compileTextRuns(item, styles, styleRefs, report, options);
  }

  if (item.role === 'graphic' || item.role === 'shape') {
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    styleRefs.frameStyle = ensureFrameStyle(styles, item, options);
  }

  if (item.role === 'table') {
    styleRefs.tableStyle = explicitName(item.attributes, ['data-id-table-style']) || firstClassName(item) || 'default-table';
    if (!styles.tableStyles[styleRefs.tableStyle]) {
      styles.tableStyles[styleRefs.tableStyle] = { name: styleRefs.tableStyle };
    }
  }

  return compiled;
}

function contentForItem(item) {
  if (item.role === 'text') {
    return {
      text: item.text || '',
      runs: [],
    };
  }
  if (item.role === 'graphic') {
    return {
      alt: item.attributes.alt || '',
      src: item.attributes.src || item.attributes.data || '',
    };
  }
  return {};
}

function compileTextRuns(item, styles, styleRefs, report, options) {
  const runs = item.runs && item.runs.length > 0
    ? item.runs
    : [{ text: item.text || '', attributes: {}, classList: [], computedStyle: item.computedStyle, tagName: item.tagName }];
  return runs.map((run) => {
    const characterStyle = ensureCharacterStyle(styles, run, report, options);
    if (characterStyle && !styleRefs.characterStyles.includes(characterStyle)) {
      styleRefs.characterStyles.push(characterStyle);
    }
    return {
      text: run.text,
      characterStyle,
    };
  });
}

function ensureParagraphStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.color);
  const fontName = ensureFont(styles, style.fontFamily, options);
  const signature = {
    appliedFont: fontName,
    pointSize: cssLengthToPt(style.fontSize),
    leading: cssLengthToPt(style.lineHeight),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    justification: style.textAlign || 'left',
    tracking: cssLengthToPt(style.letterSpacing),
    spaceBefore: cssLengthToPt(style.marginTop),
    spaceAfter: cssLengthToPt(style.marginBottom),
  };
  const name = explicitName(item.attributes, ['data-id-paragraph-style', 'data-id-style'])
    || firstClassName(item)
    || stableAutoName('paragraph', signature);
  if (!styles.paragraphStyles[name]) {
    styles.paragraphStyles[name] = {
      name,
      ...signature,
    };
  }
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text item has no computed font family', { itemId: item.id });
  }
  return name;
}

function ensureCharacterStyle(styles, run, report, options) {
  const style = run.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.color);
  const fontName = ensureFont(styles, style.fontFamily, options);
  const signature = {
    appliedFont: fontName,
    pointSize: cssLengthToPt(style.fontSize),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    tracking: cssLengthToPt(style.letterSpacing),
    verticalPosition: style.verticalAlign || 'baseline',
    textDecoration: style.textDecorationLine || 'none',
  };
  const name = explicitName(run.attributes, ['data-id-character-style', 'data-id-style'])
    || firstClassName(run)
    || stableAutoName('character', signature);
  if (!styles.characterStyles[name]) {
    styles.characterStyles[name] = {
      name,
      ...signature,
    };
  }
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text run has no computed font family', { text: run.text });
  }
  return name;
}

function ensureObjectStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.backgroundColor);
  const strokeColor = ensureSwatch(styles, style.borderTopColor);
  const signature = {
    fillColor,
    strokeColor,
    strokeWeight: cssLengthToPt(style.borderTopWidth),
    strokeStyle: style.borderTopStyle || 'none',
    cornerRadius: style.borderRadius || '0px',
    opacity: Number(style.opacity || 1),
    overflow: style.overflow || 'visible',
  };
  const name = explicitName(item.attributes, ['data-id-object-style', 'data-id-style'])
    || firstClassName(item)
    || stableAutoName('object', signature);
  if (!styles.objectStyles[name]) {
    styles.objectStyles[name] = {
      name,
      ...signature,
    };
  }
  if (style.transform && style.transform !== 'none') {
    addMessage(report, 'warning', 'TRANSFORM_NOT_NATIVE', 'CSS transform captured but not compiled to native InDesign transform in this plan', {
      itemId: item.id,
      transform: style.transform,
    });
  }
  return name;
}

function ensureFrameStyle(styles, item, options) {
  const style = item.computedStyle || {};
  const signature = {
    fit: style.objectFit || 'fill',
    position: style.objectPosition || '50% 50%',
    inset: {
      top: cssLengthToPt(style.paddingTop),
      right: cssLengthToPt(style.paddingRight),
      bottom: cssLengthToPt(style.paddingBottom),
      left: cssLengthToPt(style.paddingLeft),
    },
    overflow: style.overflow || 'visible',
  };
  const name = explicitName(item.attributes, ['data-id-frame-style'])
    || (firstClassName(item) ? `${firstClassName(item)}-frame` : null)
    || stableAutoName('frame', signature);
  if (!styles.frameStyles[name]) {
    styles.frameStyles[name] = {
      name,
      ...signature,
    };
  }
  return name;
}

function ensureSwatch(styles, cssColor) {
  const normalized = normalizeCssColor(cssColor);
  if (!normalized) return null;
  if (!styles.swatches[normalized.name]) {
    styles.swatches[normalized.name] = {
      name: normalized.name,
      model: 'process',
      space: 'RGB',
      value: normalized.hex,
    };
  }
  return normalized.name;
}

function ensureFont(styles, fontFamily, options) {
  const family = firstFontFamily(fontFamily) || options.fontFallback || 'Arial';
  if (!family) return null;
  if (!styles.fonts[family]) {
    styles.fonts[family] = {
      family,
      fallback: options.fontFallback || 'Arial',
    };
  }
  return family;
}

function firstFontFamily(fontFamily) {
  const first = String(fontFamily || '')
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .find(Boolean);
  return first || null;
}

module.exports = {
  createEmptyStyleModel,
  compileStyles,
};
```

- [ ] **步骤 4：导出 `compileStyles`**

把 `src/paged-html/index.js` 替换为：

```js
const { renderSnapshot } = require('./browser-snapshot');
const { compileStyles } = require('./style-compiler');

module.exports = {
  renderSnapshot,
  compileStyles,
};
```

- [ ] **步骤 5：运行 style compiler 测试并确认通过**

运行：

```bash
node --test test/paged-html/style-compiler.test.js
```

预期：PASS，共 2 个测试通过。

- [ ] **步骤 6：运行 public API 和 paged-html 测试**

运行：

```bash
node --test test/public-api.test.js test/paged-html/*.test.js
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/paged-html/index.js src/paged-html/style-compiler.js test/paged-html/style-compiler.test.js
git commit -m "feat: compile paged html style resources"
```

---

### 任务 4：Build Instructions Compiler

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\test\paged-html\instructions-compiler.test.js`
- 修改：`D:\AI\html-indesign\src\paged-html\index.js`

- [ ] **步骤 1：写失败的 instructions compiler 测试**

创建 `test/paged-html/instructions-compiler.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('compileInstructions emits document styles pages and text items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, { mode: 'editable-first' });
  const page = instructions.pages[0];
  const title = page.items.find((item) => item.id.includes('el1'));

  assert.equal(instructions.metadata.mode, 'editable-first');
  assert.equal(instructions.document.pages[0].width, 528);
  assert.equal(instructions.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(title.type, 'TEXT');
  assert.equal(title.paragraphStyle, 'report-title');
  assert.equal(title.runs.some((run) => run.characterStyle === 'accent'), true);
  assert.deepEqual(title.bounds, { x: 15, y: 18, width: 260, height: 30 });
  assert.equal(title.layer, 'text');
});

test('compileInstructions emits graphic placed assets and layers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const graphicItems = instructions.pages[0].items.filter((item) => item.type === 'GRAPHIC');
  const pdf = graphicItems.find((item) => item.placed && item.placed.assetId === 'asset-site-plan-pdf');

  assert.equal(instructions.assets.length, 4);
  assert.equal(instructions.layers.some((layer) => layer.name === 'graphics'), true);
  assert.equal(pdf.frameStyle, 'drawing-frame');
  assert.equal(pdf.placed.pageNumber, 3);
  assert.equal(pdf.placed.crop, 'trim');
});
```

- [ ] **步骤 2：运行 instructions compiler 测试并确认失败**

运行：

```bash
node --test test/paged-html/instructions-compiler.test.js
```

预期：FAIL，并出现 `compileInstructions is not a function`。

- [ ] **步骤 3：实现 `instructions-compiler.js`**

创建 `src/paged-html/instructions-compiler.js`：

```js
const { createReport, addMessage } = require('../shared/report');
const { compileStyles } = require('./style-compiler');

function compileInstructions(snapshot, options = {}) {
  const styled = snapshot.styles ? snapshot : compileStyles(snapshot, options);
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: styled.pages.length,
  });

  const pages = styled.pages.map((page) => ({
    id: page.id,
    index: page.index,
    width: page.widthMm,
    height: page.heightMm,
    items: page.items
      .map((item) => instructionItemFor(item, styled.assets || []))
      .filter(Boolean)
      .sort((a, b) => a.zIndex - b.zIndex),
  }));
  const layers = collectLayers(pages);

  return {
    metadata: {
      source: styled.metadata && styled.metadata.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/paged-html-to-instructions',
      mode: options.mode || 'editable-first',
    },
    document: {
      pages: styled.pages.map((page) => ({
        id: page.id,
        width: page.widthMm,
        height: page.heightMm,
      })),
    },
    styles: styled.styles,
    assets: styled.assets || [],
    layers,
    pages,
    warnings: styled.warnings || [],
    report,
  };
}

function instructionItemFor(item, assets) {
  const base = {
    id: item.id,
    role: item.role,
    bounds: item.boundsMm,
    zIndex: item.zIndex || 0,
    layer: layerForItem(item),
    sourceSelector: item.sourceSelector,
    styleRefs: item.styleRefs,
  };
  if (item.role === 'text') {
    return {
      ...base,
      type: 'TEXT',
      text: item.content.text,
      paragraphStyle: item.styleRefs.paragraphStyle,
      runs: item.content.runs,
    };
  }
  if (item.role === 'graphic') {
    const asset = assetForItem(item, assets);
    return {
      ...base,
      type: 'GRAPHIC',
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      placed: asset ? {
        assetId: asset.id,
        fit: asset.placement.fit,
        position: asset.placement.position,
        pageNumber: asset.placement.pageNumber,
        crop: asset.placement.crop,
        artboard: asset.placement.artboard,
        layerComp: asset.placement.layerComp,
        preserveVector: asset.placement.preserveVector,
      } : null,
    };
  }
  if (item.role === 'table') {
    return {
      ...base,
      type: 'TABLE',
      tableStyle: item.styleRefs.tableStyle,
      text: item.text,
    };
  }
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: item.styleRefs.objectStyle,
    frameStyle: item.styleRefs.frameStyle,
  };
}

function assetForItem(item, assets) {
  return assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || assets.find((asset) => asset.src === item.attributes.src || asset.src === item.attributes.data)
    || null;
}

function layerForItem(item) {
  if (item.attributes && item.attributes['data-id-layer']) return item.attributes['data-id-layer'];
  if (item.role === 'text') return 'text';
  if (item.role === 'graphic') return 'graphics';
  if (item.role === 'table') return 'tables';
  return 'content';
}

function collectLayers(pages) {
  const names = new Set(['background', 'content', 'graphics', 'text', 'tables', 'annotations']);
  for (const page of pages) {
    for (const item of page.items) {
      names.add(item.layer);
    }
  }
  return Array.from(names).map((name, index) => ({
    name,
    order: index,
  }));
}

module.exports = {
  compileInstructions,
};
```

- [ ] **步骤 4：导出 `compileInstructions`**

把 `src/paged-html/index.js` 替换为：

```js
const { renderSnapshot } = require('./browser-snapshot');
const { compileStyles } = require('./style-compiler');
const { compileInstructions } = require('./instructions-compiler');

module.exports = {
  renderSnapshot,
  compileStyles,
  compileInstructions,
};
```

- [ ] **步骤 5：运行 instructions compiler 测试并确认通过**

运行：

```bash
node --test test/paged-html/instructions-compiler.test.js
```

预期：PASS，共 2 个测试通过。

- [ ] **步骤 6：运行 paged-html 测试**

运行：

```bash
node --test test/paged-html/*.test.js
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/paged-html/index.js src/paged-html/instructions-compiler.js test/paged-html/instructions-compiler.test.js
git commit -m "feat: compile paged html build instructions"
```

---

### 任务 5：Instructions Validator 与公共 API

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\instructions-validator.js`
- 新建：`D:\AI\html-indesign\test\paged-html\instructions-validator.test.js`
- 修改：`D:\AI\html-indesign\src\paged-html\index.js`
- 修改：`D:\AI\html-indesign\test\public-api.test.js`

- [ ] **步骤 1：写失败的 validator 测试**

创建 `test/paged-html/instructions-validator.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions, validateInstructions } = require('../../src/paged-html');

test('validateInstructions accepts compiler output', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const result = validateInstructions(instructions);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateInstructions rejects missing page and style references', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [] },
    styles: {
      swatches: {},
      fonts: {},
      compositeFonts: {},
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'bad-title',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        paragraphStyle: 'missing-style',
        runs: [],
        zIndex: 1,
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'DOCUMENT_PAGE_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PARAGRAPH_STYLE_NOT_FOUND'), true);
});
```

- [ ] **步骤 2：运行 validator 测试并确认失败**

运行：

```bash
node --test test/paged-html/instructions-validator.test.js
```

预期：FAIL，并出现 `validateInstructions is not a function`。

- [ ] **步骤 3：实现 `instructions-validator.js`**

创建 `src/paged-html/instructions-validator.js`：

```js
function validateInstructions(instructions) {
  const errors = [];
  const styles = instructions.styles || {};
  const documentPages = instructions.document && Array.isArray(instructions.document.pages)
    ? instructions.document.pages
    : [];
  const pageIds = new Set(documentPages.map((page) => page.id));
  const assetIds = new Set((instructions.assets || []).map((asset) => asset.id));

  if (documentPages.length === 0) {
    errors.push({
      code: 'DOCUMENT_PAGE_MISSING',
      message: 'instructions.document.pages must contain at least one page.',
    });
  }

  for (const page of instructions.pages || []) {
    if (!pageIds.has(page.id)) {
      errors.push({
        code: 'PAGE_NOT_IN_DOCUMENT',
        message: `Page '${page.id}' is missing from instructions.document.pages.`,
        pageId: page.id,
      });
    }
    for (const item of page.items || []) {
      validateBounds(item, errors);
      validateStyleRefs(item, styles, errors);
      validatePlacedAsset(item, assetIds, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateBounds(item, errors) {
  const bounds = item.bounds;
  const valid = bounds
    && Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width >= 0
    && bounds.height >= 0;
  if (!valid) {
    errors.push({
      code: 'INVALID_BOUNDS',
      message: `Item '${item.id}' has invalid bounds.`,
      itemId: item.id,
    });
  }
}

function validateStyleRefs(item, styles, errors) {
  if (item.type === 'TEXT' && item.paragraphStyle && !(styles.paragraphStyles || {})[item.paragraphStyle]) {
    errors.push({
      code: 'PARAGRAPH_STYLE_NOT_FOUND',
      message: `Paragraph style '${item.paragraphStyle}' was not found.`,
      itemId: item.id,
      styleName: item.paragraphStyle,
    });
  }
  for (const run of item.runs || []) {
    if (run.characterStyle && !(styles.characterStyles || {})[run.characterStyle]) {
      errors.push({
        code: 'CHARACTER_STYLE_NOT_FOUND',
        message: `Character style '${run.characterStyle}' was not found.`,
        itemId: item.id,
        styleName: run.characterStyle,
      });
    }
  }
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.objectStyle && !(styles.objectStyles || {})[item.objectStyle]) {
    errors.push({
      code: 'OBJECT_STYLE_NOT_FOUND',
      message: `Object style '${item.objectStyle}' was not found.`,
      itemId: item.id,
      styleName: item.objectStyle,
    });
  }
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.frameStyle && !(styles.frameStyles || {})[item.frameStyle]) {
    errors.push({
      code: 'FRAME_STYLE_NOT_FOUND',
      message: `Frame style '${item.frameStyle}' was not found.`,
      itemId: item.id,
      styleName: item.frameStyle,
    });
  }
}

function validatePlacedAsset(item, assetIds, errors) {
  if (item.type !== 'GRAPHIC' || !item.placed || !item.placed.assetId) return;
  if (!assetIds.has(item.placed.assetId)) {
    errors.push({
      code: 'ASSET_NOT_FOUND',
      message: `Placed asset '${item.placed.assetId}' was not found.`,
      itemId: item.id,
      assetId: item.placed.assetId,
    });
  }
}

module.exports = {
  validateInstructions,
};
```

- [ ] **步骤 4：导出 validator 并扩展 public API 测试**

把 `src/paged-html/index.js` 替换为：

```js
const { renderSnapshot } = require('./browser-snapshot');
const { compileStyles } = require('./style-compiler');
const { compileInstructions } = require('./instructions-compiler');
const { validateInstructions } = require('./instructions-validator');

module.exports = {
  renderSnapshot,
  compileStyles,
  compileInstructions,
  validateInstructions,
};
```

把 `test/public-api.test.js` 替换为：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../index');

test('public API exposes paged-html and legacy-template entry points', () => {
  assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
  assert.equal(typeof api.pagedHtml.compileStyles, 'function');
  assert.equal(typeof api.pagedHtml.compileInstructions, 'function');
  assert.equal(typeof api.pagedHtml.validateInstructions, 'function');
  assert.equal(typeof api.legacyTemplate.buildInstructions, 'function');
  assert.equal(typeof api.legacyTemplate.validate, 'function');
});
```

- [ ] **步骤 5：运行 validator 和 public API 测试并确认通过**

运行：

```bash
node --test test/paged-html/instructions-validator.test.js test/public-api.test.js
```

预期：PASS，共 3 个测试通过。

- [ ] **步骤 6：运行全部测试**

运行：

```bash
npm test
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/paged-html/index.js src/paged-html/instructions-validator.js test/paged-html/instructions-validator.test.js test/public-api.test.js
git commit -m "feat: validate paged html build instructions"
```

---

## 最终验证

- [ ] **步骤 1：运行全部 Node 测试**

运行：

```bash
npm test
```

预期：所有测试通过。

- [ ] **步骤 2：运行 legacy 合规脚本**

运行：

```bash
node test/workspace/run_test.js
```

预期：validator 报告 valid，builder 生成 2 页，errors 为空。

- [ ] **步骤 3：用一条 Node 命令生成 instructions JSON 并校验**

运行：

```bash
node -e "const fs=require('fs');const path=require('path');const {pagedHtml}=require('./');const {renderSnapshot,compileInstructions,validateInstructions}=pagedHtml;(async()=>{const htmlPath=path.resolve('test/fixtures/paged-html/style-deck.html');const snapshot=await renderSnapshot({htmlPath});const instructions=compileInstructions(snapshot);const result=validateInstructions(instructions);if(!result.valid){console.error(JSON.stringify(result,null,2));process.exit(1);}fs.mkdirSync('test/workspace',{recursive:true});fs.writeFileSync('test/workspace/paged-html-instructions.json',JSON.stringify(instructions,null,2));console.log(JSON.stringify({pages:instructions.pages.length,items:instructions.pages[0].items.length,swatches:Object.keys(instructions.styles.swatches).length,paragraphStyles:Object.keys(instructions.styles.paragraphStyles).length,valid:result.valid},null,2));})().catch((error)=>{console.error(error);process.exit(1);});"
```

预期：命令以状态码 `0` 退出，并打印 `valid: true`、`pages: 1`、`items` 大于 `0`。

- [ ] **步骤 4：检查 git 状态**

运行：

```bash
git status --short
```

预期：只有本计划有意产生的已跟踪代码变更。`test/workspace/paged-html-instructions.json` 位于 ignored 目录，不进入提交。

## 自检清单

本计划覆盖：

- StyleModel：`swatches`、`fonts`、`paragraphStyles`、`characterStyles`、`objectStyles`、`frameStyles`。
- StyleRefs：页面 item 和文本 run 均有样式引用。
- Build Instructions：`metadata`、`document`、`styles`、`assets`、`layers`、`pages`、`warnings`、`report`。
- 资源置入引用：graphic item 的 `placed.assetId` 指向 `assets`。
- 基础校验：页面、bounds、style refs、asset refs。

本计划明确不覆盖：

- InDesign JSX executor 升级。
- 真实 InDesign 样式创建。
- 真实图片/PDF/PSD/AI/SVG 置入。
- CLI 命令。
- CMYK、Spot color、复合字体真实生成。

类型一致性：

- 公共入口：`require('./').pagedHtml.renderSnapshot`、`compileStyles`、`compileInstructions`、`validateInstructions`。
- Style 编译输入：browser snapshot。
- Style 编译输出：`{ metadata, pages, assets, warnings, styles, report }`。
- Instructions 编译输出：`{ metadata, document, styles, assets, layers, pages, warnings, report }`。
- Validator 输出：`{ valid, errors }`。
