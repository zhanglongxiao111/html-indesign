# InDesign Advanced Native Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 补齐当前 HTML -> InDesign 翻译链路缺失的高级原生能力，让建筑汇报 HTML 可以转成更接近人工 InDesign 文件的可编辑文档。

**架构：** 继续坚持浏览器负责布局、Node 侧负责语义和指令编译、ExtendScript 侧只执行明确指令。新增能力先进入稳定中间指令 schema，再由 InDesign 执行器创建原生对象；无法稳定原生化的内容必须记录可审核的降级原因。

**技术栈：** Node.js CommonJS、`node:test`、Playwright/Chromium 快照、ExtendScript JSX/JSXINC、Adobe InDesign DOM、`cli-anything-indesign`。

---

## 范围确认

本计划覆盖当前明确缺口：

- 原生项目符号和编号。
- 多栏文字框、垂直对齐、文字框内边距等高级文本框属性。
- 文字框串接、文字绕图、跟随文字移动的内嵌对象。
- 脚注、尾注。
- 超链接、书签、交叉引用、目录入口。
- 母版页、章节、页码系统。
- 真正的对象分组。
- 简单 SVG 拆成 InDesign 原生矢量。
- 语义图表转成可编辑图形。
- 数据套版能力。
- 更严格的不支持项诊断。

本计划不覆盖：

- InDesign -> HTML 反向转换。
- 任意网页完整还原。
- 完整 SVG 标准解析器。
- PSD/AI 内部图层重建。
- 视频、音频、动画类交互内容。

## 文件结构

```text
src/paged-html/
  advanced-text.js                 # 列表、脚注、尾注、文字框串接、绕图、内嵌对象的快照归一化
  interactive.js                   # 超链接、书签、交叉引用、目录语义归一化
  parent-pages.js                  # 母版页、章节、页码规则归一化
  native-groups.js                 # data-id-group 到 group 指令
  native-svg.js                    # 简单 SVG 到原生矢量指令
  native-charts.js                 # 语义图表到原生图形指令
  data-merge.js                    # 数据套版源、模板、重复项归一化
  instructions-compiler.js         # 接入新增 item/document instruction
  instructions-validator.js        # 校验新增 schema 和不支持项
  browser-snapshot.js              # 抽取新增语义字段

_indesign_scripts/
  build_from_instructions.jsx      # 增加新 JSXINC 引入
  lib/
    hi_text.jsxinc                 # 列表、多栏、串接、绕图、脚注、内嵌对象
    hi_interactive.jsxinc          # 超链接、书签、交叉引用、目录标记
    hi_parent_pages.jsxinc         # 母版页、章节、页码
    hi_groups.jsxinc               # 原生分组
    hi_native_vectors.jsxinc       # SVG 拆解后的矩形、椭圆、路径、文字
    hi_charts.jsxinc               # 图表原生图形创建
    hi_data_merge.jsxinc           # 数据套版执行
    hi_items.jsxinc                # 调度新增 item 类型
    hi_styles.jsxinc               # 扩展文字框、列表、表格和对象样式落地

test/fixtures/paged-html/
  advanced-text-deck.html
  interactive-deck.html
  parent-pages-deck.html
  native-svg-deck.html
  native-chart-deck.html
  data-merge-deck.html

test/paged-html/
  advanced-text.test.js
  interactive.test.js
  parent-pages.test.js
  native-svg.test.js
  native-chart.test.js
  data-merge.test.js
  advanced-diagnostics.test.js

test/indesign-executor/
  advanced-native-static.test.js
  advanced-native-fixture-writer.js
  advanced-native-e2e.test.js
```

## 指令 schema 扩展

新增顶层字段：

```js
{
  document: {
    parentPages: [],
    sections: [],
    bookmarks: [],
    hyperlinks: [],
    crossReferences: [],
    tableOfContents: []
  },
  dataSources: [],
  stories: [],
  pages: [{
    items: [{
      type: 'TEXT' | 'GRAPHIC' | 'SHAPE' | 'LINE' | 'TABLE' | 'GROUP' | 'VECTOR_PATH' | 'CHART',
      textFeatures: {},
      wrap: {},
      anchor: {},
      groupId: null
    }]
  }]
}
```

HTML 语义入口：

| 能力 | HTML 入口 | 指令字段 |
| ---- | --------- | -------- |
| 原生列表 | `ul`、`ol`、`li`、`data-id-list-style` | `textFeatures.list` |
| 多栏文字框 | `data-id-columns`、`data-id-column-gutter` | `textFeatures.columns` |
| 文字框串接 | `data-id-story`、`data-id-story-order` | `stories[*].frames` |
| 文字绕图 | `data-id-text-wrap`、`data-id-wrap-offset` | `wrap` |
| 内嵌对象 | `data-id-anchor`、`data-id-anchor-target` | `anchor` |
| 脚注/尾注 | `data-id-footnote`、`data-id-endnote` | `textFeatures.notes` |
| 超链接 | `a[href]`、`data-id-hyperlink` | `document.hyperlinks` |
| 书签 | `data-id-bookmark` | `document.bookmarks` |
| 交叉引用 | `data-id-cross-ref` | `document.crossReferences` |
| 母版页 | `data-id-parent-page` | `document.parentPages` |
| 章节页码 | `data-id-section-start`、`data-id-page-number-style` | `document.sections` |
| 分组 | `data-id-group` | `GROUP` item |
| SVG 原生化 | `data-id-svg-mode="native"` | `VECTOR_PATH` / `SHAPE` / `TEXT` |
| 图表 | `data-id-chart` | `CHART` item |
| 数据套版 | `data-id-data-source`、`data-id-repeat` | `dataSources` |

---

### 任务 1：新增高级能力 schema 与诊断底座

**文件：**
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-validator.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\test\paged-html\advanced-diagnostics.test.js`

- [ ] **步骤 1：写失败测试**

创建 `test/paged-html/advanced-diagnostics.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInstructions } = require('../../src/paged-html');

test('validateInstructions accepts advanced document structures', () => {
  const instructions = {
    metadata: {},
    document: {
      coordinateUnit: 'mm',
      pages: [{ id: 'p1', width: 420, height: 236.25 }],
      parentPages: [{ id: 'report-parent', name: '汇报母版', items: [] }],
      sections: [{ pageId: 'p1', marker: 'A', pageNumberStart: 1, pageNumberStyle: 'arabic' }],
      bookmarks: [{ id: 'b1', name: '总图', targetPageId: 'p1' }],
      hyperlinks: [{ id: 'h1', sourceItemId: 'title', destination: { type: 'page', pageId: 'p1' } }],
      crossReferences: [],
      tableOfContents: [],
    },
    styles: {},
    assets: [],
    dataSources: [],
    stories: [{ id: 'story-1', frameIds: ['title'] }],
    layers: [],
    pages: [{
      id: 'p1',
      items: [{
        id: 'title',
        type: 'TEXT',
        role: 'text',
        bounds: { x: 10, y: 10, width: 100, height: 20 },
        text: '总图',
        textFeatures: { columns: { count: 2, gutter: 4 } },
        wrap: null,
        anchor: null,
        zIndex: 1,
      }],
    }],
  };

  const result = validateInstructions(instructions);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateInstructions rejects unknown advanced item types', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'p1', width: 100, height: 100 }] },
    styles: {},
    assets: [],
    layers: [],
    pages: [{ id: 'p1', items: [{ id: 'bad', type: 'MYSTERY', bounds: { x: 0, y: 0, width: 1, height: 1 } }] }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'ITEM_TYPE_UNSUPPORTED'), true);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node --test test/paged-html/advanced-diagnostics.test.js
```

预期：第一个测试因新增字段未被接受或第二个测试因错误码不匹配失败。

- [ ] **步骤 3：实现 schema 校验**

在 `src/paged-html/instructions-validator.js` 中增加：

```js
const SUPPORTED_ITEM_TYPES = new Set(['TEXT', 'GRAPHIC', 'SHAPE', 'LINE', 'TABLE', 'GROUP', 'VECTOR_PATH', 'CHART']);

function validateItemType(item, errors) {
  if (!SUPPORTED_ITEM_TYPES.has(item.type)) {
    errors.push({
      code: 'ITEM_TYPE_UNSUPPORTED',
      message: `Instruction item type is not supported: ${item.type}`,
      itemId: item.id || null,
      type: item.type,
    });
  }
}

function normalizeAdvancedDocument(document) {
  return {
    parentPages: Array.isArray(document.parentPages) ? document.parentPages : [],
    sections: Array.isArray(document.sections) ? document.sections : [],
    bookmarks: Array.isArray(document.bookmarks) ? document.bookmarks : [],
    hyperlinks: Array.isArray(document.hyperlinks) ? document.hyperlinks : [],
    crossReferences: Array.isArray(document.crossReferences) ? document.crossReferences : [],
    tableOfContents: Array.isArray(document.tableOfContents) ? document.tableOfContents : [],
  };
}
```

接入现有 item 循环，在每个 item bounds 校验前调用 `validateItemType(item, errors)`。

- [ ] **步骤 4：保证 compiler 输出空数组**

在 `compileInstructions()` 返回值里保证这些字段存在：

```js
document: {
  coordinateUnit: layout.targetUnit,
  unitMode: layout.unitMode,
  pages: pages.map(...),
  parentPages: [],
  sections: [],
  bookmarks: [],
  hyperlinks: [],
  crossReferences: [],
  tableOfContents: [],
},
dataSources: [],
stories: [],
```

- [ ] **步骤 5：运行测试**

运行：

```bash
node --test test/paged-html/advanced-diagnostics.test.js
npm test
```

预期：全部通过。

---

### 任务 2：原生列表、多栏文字框和高级文字框属性

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\advanced-text.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 修改：`D:\AI\html-indesign\src\paged-html\style-compiler.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_styles.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\advanced-text-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\advanced-text.test.js`

- [ ] **步骤 1：创建 HTML fixture**

创建 `test/fixtures/paged-html/advanced-text-deck.html`，包含一页固定尺寸页面：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .page { width: 420mm; height: 236.25mm; padding: 14mm; box-sizing: border-box; }
    .body { position: absolute; left: 20mm; top: 30mm; width: 130mm; height: 120mm; column-count: 2; column-gap: 5mm; }
    .body li { margin-bottom: 2mm; }
  </style>
</head>
<body>
  <section class="page" data-page="advanced-text" data-id-margin="14mm" data-id-grid="12x8">
    <ol class="body" data-id-paragraph-style="正文列表" data-id-frame-style="双栏正文" data-id-columns="2" data-id-column-gutter="5mm">
      <li>场馆入口组织</li>
      <li>观众流线分离</li>
      <li>后勤服务靠边</li>
    </ol>
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

创建 `test/paged-html/advanced-text.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('advanced text fixture compiles native list and column metadata', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/advanced-text-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const text = instructions.pages[0].items.find((item) => item.type === 'TEXT');

  assert.equal(text.textFeatures.list.type, 'numbered');
  assert.equal(text.textFeatures.list.items.length, 3);
  assert.equal(text.textFeatures.columns.count, 2);
  assert.equal(text.textFeatures.columns.gutter, 5);
});
```

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
node --test test/paged-html/advanced-text.test.js
```

预期：FAIL，`textFeatures` 不存在。

- [ ] **步骤 4：实现 Node 侧归一化**

创建 `src/paged-html/advanced-text.js`：

```js
function listFeaturesForItem(item) {
  const tag = String(item.tagName || '').toLowerCase();
  if (!['ul', 'ol'].includes(tag) && !item.listItems) return null;
  const type = tag === 'ol' ? 'numbered' : 'bullet';
  return {
    type,
    items: (item.listItems || []).map((entry, index) => ({
      index,
      text: entry.text,
      marker: entry.marker || null,
      runs: entry.runs || [],
    })),
  };
}

function columnFeaturesForItem(item, layout) {
  const attrs = item.attributes || {};
  const style = item.computedStyle || {};
  const rawCount = attrs['data-id-columns'] || style.columnCount;
  const count = Number(rawCount || 1);
  if (!Number.isFinite(count) || count <= 1) return null;
  const gutter = attrs['data-id-column-gutter'] || style.columnGap || '0';
  return {
    count,
    gutter: layout.lengthToTargetUnit(gutter),
  };
}

function textFeaturesForItem(item, layout) {
  const features = {};
  const list = listFeaturesForItem(item);
  const columns = columnFeaturesForItem(item, layout);
  if (list) features.list = list;
  if (columns) features.columns = columns;
  return Object.keys(features).length ? features : null;
}

module.exports = {
  textFeaturesForItem,
};
```

将 `browser-snapshot.js` 对 `ul`、`ol`、`li` 的抽取改为：列表容器作为一个 `text` item，`li` 内容进入 `item.listItems`，同时保留 `LIST_MARKER_UNSUPPORTED` 警告到新能力未启用前的兼容路径。

在 `instructions-compiler.js` 创建 `TEXT` item 时加入：

```js
textFeatures: textFeaturesForItem(item, layout),
```

- [ ] **步骤 5：实现 ExtendScript 侧文本框属性**

在 `_indesign_scripts/lib/hi_styles.jsxinc` 的 `HI.applyFrameStyle` 增加：

```js
if (def.columns) {
    if (def.columns.count) prefs.textColumnCount = Number(def.columns.count);
    if (def.columns.gutter !== null && typeof def.columns.gutter !== "undefined") {
        prefs.textColumnGutter = HI.measurementString(def.columns.gutter, HI.currentCoordinateUnit || "mm");
    }
}
if (def.verticalJustification) {
    var v = String(def.verticalJustification).toLowerCase();
    if (v === "center") prefs.verticalJustification = VerticalJustification.CENTER_ALIGN;
    else if (v === "bottom") prefs.verticalJustification = VerticalJustification.BOTTOM_ALIGN;
    else if (v === "justify") prefs.verticalJustification = VerticalJustification.JUSTIFY_ALIGN;
    else prefs.verticalJustification = VerticalJustification.TOP_ALIGN;
}
```

在 `_indesign_scripts/lib/hi_items.jsxinc` 的 `HI.createTextFrame` 中，设置 `frame.contents` 后调用：

```js
HI.applyTextFeatures(doc, frame, item.textFeatures || {}, report);
```

新增 `HI.applyTextFeatures` 到 `hi_text.jsxinc`，根据 `textFeatures.list.type` 设置段落的项目符号或编号。

- [ ] **步骤 6：运行测试**

运行：

```bash
node --test test/paged-html/advanced-text.test.js
npm test
```

预期：全部通过，原 `LIST_MARKER_UNSUPPORTED` 测试更新为在无列表原生模式时才提示。

---

### 任务 3：文字框串接、文字绕图、内嵌对象、脚注和尾注

**文件：**
- 修改：`D:\AI\html-indesign\src\paged-html\advanced-text.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_text.jsxinc`
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_items.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\advanced-text-flow-deck.html`
- 修改：`D:\AI\html-indesign\test\paged-html\advanced-text.test.js`

- [ ] **步骤 1：创建 fixture**

创建 `test/fixtures/paged-html/advanced-text-flow-deck.html`：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .page { width: 420mm; height: 236.25mm; position: relative; padding: 14mm; }
    .story-a { position:absolute; left:20mm; top:20mm; width:80mm; height:80mm; }
    .story-b { position:absolute; left:110mm; top:20mm; width:80mm; height:80mm; }
    .wrap-image { position:absolute; left:205mm; top:20mm; width:80mm; height:60mm; }
    .anchored-mark { display:inline-block; width:4mm; height:4mm; background:#c8102e; }
  </style>
</head>
<body>
  <section class="page" data-page="flow" data-id-margin="14mm" data-id-grid="12x8">
    <p class="story-a" data-id-story="main-story" data-id-story-order="1" data-id-paragraph-style="正文">
      第一段文字包含脚注<span data-id-footnote="首层柱网按原结构复核">1</span>和内嵌标记<span class="anchored-mark" data-id-anchor="inline-dot"></span>。
    </p>
    <p class="story-b" data-id-story="main-story" data-id-story-order="2" data-id-paragraph-style="正文">
      第二个文字框继续同一个故事。
    </p>
    <img class="wrap-image" src="../smoke-assets/photos/architecture-facade.jpg" data-id-object data-id-text-wrap="bounding-box" data-id-wrap-offset="4mm" data-id-layer="image">
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

追加到 `test/paged-html/advanced-text.test.js`：

```js
test('text flow fixture compiles stories, wrap and notes', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/advanced-text-flow-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);

  assert.deepEqual(instructions.stories[0].frameIds, ['p1-el1', 'p1-el2']);

  const graphic = instructions.pages[0].items.find((item) => item.type === 'GRAPHIC');
  assert.equal(graphic.wrap.mode, 'bounding-box');
  assert.equal(graphic.wrap.offset, 4);

  const firstFrame = instructions.pages[0].items.find((item) => item.id === 'p1-el1');
  assert.equal(firstFrame.textFeatures.notes[0].kind, 'footnote');
  assert.equal(firstFrame.textFeatures.anchors[0].id, 'inline-dot');
});
```

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
node --test test/paged-html/advanced-text.test.js
```

预期：FAIL，`stories`、`wrap`、`notes`、`anchors` 未输出。

- [ ] **步骤 4：实现 Node 编译**

在 `advanced-text.js` 增加：

```js
function storyFramesForPages(pages) {
  const byStory = new Map();
  for (const page of pages) {
    for (const item of page.items || []) {
      const storyId = item.attributes && item.attributes['data-id-story'];
      if (!storyId) continue;
      const order = Number(item.attributes['data-id-story-order'] || 0);
      if (!byStory.has(storyId)) byStory.set(storyId, []);
      byStory.get(storyId).push({ itemId: item.id, order, pageId: page.id });
    }
  }
  return Array.from(byStory.entries()).map(([id, frames]) => ({
    id,
    frameIds: frames.sort((a, b) => a.order - b.order).map((frame) => frame.itemId),
  }));
}

function wrapForItem(item, layout) {
  const attrs = item.attributes || {};
  const mode = attrs['data-id-text-wrap'];
  if (!mode) return null;
  return {
    mode,
    offset: layout.lengthToTargetUnit(attrs['data-id-wrap-offset'] || '0'),
  };
}

function notesForItem(item) {
  return (item.runs || [])
    .filter((run) => run.attributes && (run.attributes['data-id-footnote'] || run.attributes['data-id-endnote']))
    .map((run, index) => ({
      index,
      kind: run.attributes['data-id-endnote'] ? 'endnote' : 'footnote',
      markerText: run.text,
      body: run.attributes['data-id-endnote'] || run.attributes['data-id-footnote'],
    }));
}

function anchorsForItem(item) {
  return (item.inlineObjects || []).map((object) => ({
    id: object.attributes['data-id-anchor'],
    bounds: object.boundsMm,
    styleRefs: object.styleRefs || {},
  }));
}
```

在 `compileInstructions()` 中将 `stories: storyFramesForPages(styled.pages)` 写入顶层，将 `wrapForItem()` 写入对象 item。

- [ ] **步骤 5：实现 InDesign 执行**

在 `hi_text.jsxinc` 中增加：

```js
HI.threadTextStories = function (doc, createdById, stories, report) {
    stories = stories || [];
    for (var i = 0; i < stories.length; i++) {
        var ids = stories[i].frameIds || [];
        for (var j = 0; j < ids.length - 1; j++) {
            try {
                createdById[ids[j]].nextTextFrame = createdById[ids[j + 1]];
            } catch (error) {
                HI.addMessage(report, "warning", "TEXT_THREAD_APPLY_FAILED", String(error), { storyId: stories[i].id });
            }
        }
    }
};

HI.applyTextWrap = function (pageItem, wrap, report) {
    if (!wrap) return;
    try {
        var mode = String(wrap.mode || "").toLowerCase();
        if (mode === "bounding-box") pageItem.textWrapPreferences.textWrapMode = TextWrapModes.BOUNDING_BOX_TEXT_WRAP;
        else if (mode === "none") pageItem.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
        if (wrap.offset !== null && typeof wrap.offset !== "undefined") {
            pageItem.textWrapPreferences.textWrapOffset = [Number(wrap.offset), Number(wrap.offset), Number(wrap.offset), Number(wrap.offset)];
        }
    } catch (error) {
        HI.addMessage(report, "warning", "TEXT_WRAP_APPLY_FAILED", String(error), {});
    }
};
```

在所有对象创建后调用 `HI.threadTextStories(doc, createdById, instructions.stories || [], report)`，并在 `createGraphicFrame/createShapeFrame` 后调用 `HI.applyTextWrap(pageItem, item.wrap, report)`。

脚注优先实现为 InDesign 原生脚注；尾注若当前 InDesign DOM 写入不稳定，则生成独立尾注文本框并记录 `ENDNOTE_RENDERED_AS_TEXT_FRAME` 警告。

- [ ] **步骤 6：运行验证**

运行：

```bash
node --test test/paged-html/advanced-text.test.js
npm test
```

预期：全部通过，真实 InDesign smoke 在任务 10 统一执行。

---

### 任务 4：超链接、书签、交叉引用和目录

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\interactive.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_interactive.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\interactive-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\interactive.test.js`

- [ ] **步骤 1：创建 fixture**

创建 `test/fixtures/paged-html/interactive-deck.html`：

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>.page{width:420mm;height:236.25mm;position:relative;padding:14mm}</style></head>
<body>
  <section class="page" id="cover" data-page="cover" data-id-margin="14mm" data-id-grid="12x8" data-id-bookmark="封面">
    <h1 data-id-paragraph-style="标题"><a href="#plan" data-id-hyperlink="跳转到总图">项目汇报</a></h1>
    <p data-id-cross-ref="plan-title">见总图章节</p>
  </section>
  <section class="page" id="plan" data-page="plan" data-id-margin="14mm" data-id-grid="12x8" data-id-bookmark="总图">
    <h2 id="plan-title" data-id-paragraph-style="标题">总图</h2>
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

创建 `test/paged-html/interactive.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('interactive fixture compiles bookmarks, hyperlinks and cross references', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/interactive-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);

  assert.equal(instructions.document.bookmarks.length, 2);
  assert.equal(instructions.document.hyperlinks[0].name, '跳转到总图');
  assert.deepEqual(instructions.document.hyperlinks[0].destination, { type: 'page', pageId: 'plan' });
  assert.equal(instructions.document.crossReferences[0].targetElementId, 'plan-title');
});
```

- [ ] **步骤 3：实现 Node 侧归一化**

创建 `src/paged-html/interactive.js`：

```js
function interactiveForSnapshot(snapshot) {
  const pageByDomId = new Map();
  for (const page of snapshot.pages || []) {
    if (page.attributes && page.attributes.id) pageByDomId.set(page.attributes.id, page.id);
    if (page.id) pageByDomId.set(page.id, page.id);
  }
  return {
    bookmarks: bookmarksForPages(snapshot.pages || []),
    hyperlinks: hyperlinksForPages(snapshot.pages || [], pageByDomId),
    crossReferences: crossReferencesForPages(snapshot.pages || []),
    tableOfContents: tableOfContentsForPages(snapshot.pages || []),
  };
}

function bookmarksForPages(pages) {
  return pages
    .filter((page) => page.attributes && page.attributes['data-id-bookmark'])
    .map((page) => ({ id: `bookmark-${page.id}`, name: page.attributes['data-id-bookmark'], targetPageId: page.id }));
}

function hyperlinksForPages(pages, pageByDomId) {
  const links = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      for (const run of item.runs || []) {
        const href = run.attributes && run.attributes.href;
        if (!href) continue;
        const hash = href.charAt(0) === '#' ? href.slice(1) : null;
        links.push({
          id: `hyperlink-${links.length + 1}`,
          name: run.attributes['data-id-hyperlink'] || run.text || href,
          sourceItemId: item.id,
          sourceText: run.text,
          destination: hash && pageByDomId.has(hash)
            ? { type: 'page', pageId: pageByDomId.get(hash) }
            : { type: 'url', url: href },
        });
      }
    }
  }
  return links;
}

function crossReferencesForPages(pages) {
  const refs = [];
  for (const page of pages) {
    for (const item of page.items || []) {
      const target = item.attributes && item.attributes['data-id-cross-ref'];
      if (target) refs.push({ id: `xref-${refs.length + 1}`, sourceItemId: item.id, targetElementId: target });
    }
  }
  return refs;
}

function tableOfContentsForPages(pages) {
  return pages.flatMap((page) => (page.items || [])
    .filter((item) => ['h1', 'h2', 'h3'].includes(String(item.tagName || '').toLowerCase()))
    .map((item) => ({ itemId: item.id, pageId: page.id, level: Number(item.tagName.slice(1)), text: item.content && item.content.text || item.text || '' })));
}

module.exports = { interactiveForSnapshot };
```

在 `instructions-compiler.js` 中合并 `interactiveForSnapshot(styled)` 到 `document`。

- [ ] **步骤 4：实现 InDesign 执行**

创建 `hi_interactive.jsxinc`，提供：

```js
HI.applyInteractiveFeatures = function (doc, instructions, createdById, report) {
    HI.createBookmarks(doc, instructions.document && instructions.document.bookmarks || [], createdById, report);
    HI.createHyperlinks(doc, instructions.document && instructions.document.hyperlinks || [], createdById, report);
};
```

实现策略：

- 书签：页面书签指向页面对象。
- 页内超链接：建立页面目的地和文字来源。
- 外部网址：建立网址目的地和文字来源。
- 交叉引用：第一阶段作为普通文本引用和审核元数据，不自动建立 InDesign 交叉引用面板对象；执行报告记录 `CROSS_REFERENCE_METADATA_ONLY`。
- 目录：编译出目录数据；真实目录文本框由显式 HTML 负责，执行报告记录目录条目数量。

- [ ] **步骤 5：运行验证**

运行：

```bash
node --test test/paged-html/interactive.test.js
npm test
```

预期：全部通过。

---

### 任务 5：母版页、章节和页码系统

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\parent-pages.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_parent_pages.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\parent-pages-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\parent-pages.test.js`

- [ ] **步骤 1：创建 fixture 和失败测试**

创建 `test/fixtures/paged-html/parent-pages-deck.html`：

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>.page{width:420mm;height:236.25mm;position:relative;padding:14mm}.folio{position:absolute;right:14mm;bottom:10mm}</style></head>
<body>
  <section data-id-parent-page="汇报母版" data-id-parent-item="folio">
    <span class="folio" data-id-parent-page-number></span>
  </section>
  <section class="page" data-page="chapter-1" data-id-margin="14mm" data-id-grid="12x8" data-id-parent-page="汇报母版" data-id-section-start="1" data-id-page-number-style="arabic">
    <h1>第一章</h1>
  </section>
</body>
</html>
```

创建 `test/paged-html/parent-pages.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('parent page fixture compiles parent pages and sections', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/parent-pages-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);

  assert.equal(instructions.document.parentPages[0].name, '汇报母版');
  assert.equal(instructions.document.sections[0].pageId, 'chapter-1');
  assert.equal(instructions.document.sections[0].pageNumberStart, 1);
  assert.equal(instructions.pages[0].parentPage, '汇报母版');
});
```

- [ ] **步骤 2：实现 Node 侧编译**

创建 `src/paged-html/parent-pages.js`：

```js
function parentPageModelForSnapshot(snapshot) {
  const parentPages = [];
  const sections = [];
  for (const page of snapshot.pages || []) {
    const attrs = page.attributes || {};
    if (attrs['data-id-section-start']) {
      sections.push({
        pageId: page.id,
        pageNumberStart: Number(attrs['data-id-section-start']),
        pageNumberStyle: attrs['data-id-page-number-style'] || 'arabic',
      });
    }
  }
  for (const parent of snapshot.parentPages || []) {
    parentPages.push({
      id: parent.id,
      name: parent.attributes['data-id-parent-page'],
      items: parent.items || [],
    });
  }
  return { parentPages, sections };
}

module.exports = { parentPageModelForSnapshot };
```

修改 `browser-snapshot.js`：把非 `.page` 且带 `data-id-parent-page` 的 `section` 抽成 `snapshot.parentPages`。

修改 `instructions-compiler.js`：页面输出加 `parentPage: page.attributes['data-id-parent-page'] || null`。

- [ ] **步骤 3：实现 InDesign 侧母版页**

创建 `hi_parent_pages.jsxinc`：

```js
HI.ensureParentPages = function (doc, parentPages, context, report) {
    var out = {};
    parentPages = parentPages || [];
    for (var i = 0; i < parentPages.length; i++) {
        var def = parentPages[i];
        var parent = doc.masterSpreads.itemByName(def.name);
        try { parent.name; } catch (_) {
            parent = doc.masterSpreads.add();
            parent.name = def.name;
        }
        out[def.name] = parent;
    }
    context.parentPages = out;
};

HI.applyParentPageToPage = function (page, parentName, context, report) {
    if (!parentName || !context.parentPages || !context.parentPages[parentName]) return;
    try { page.appliedMaster = context.parentPages[parentName]; } catch (error) {
        HI.addMessage(report, "warning", "PARENT_PAGE_APPLY_FAILED", String(error), { parentName: parentName });
    }
};
```

在页面创建后应用 parent page；章节页码通过 `doc.sections` 创建起始章节。

- [ ] **步骤 4：运行验证**

运行：

```bash
node --test test/paged-html/parent-pages.test.js
npm test
```

预期：全部通过。

---

### 任务 6：真正的 InDesign 分组

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\native-groups.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_groups.jsxinc`
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_items.jsxinc`
- 修改：`D:\AI\html-indesign\test\paged-html\instructions-compiler.test.js`
- 修改：`D:\AI\html-indesign\test\indesign-executor\advanced-native-static.test.js`

- [ ] **步骤 1：写失败测试**

在 `instructions-compiler.test.js` 增加：

```js
test('compileInstructions emits GROUP items for data-id-group containers', () => {
  const snapshot = {
    metadata: {},
    pages: [{
      id: 'p1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { width: 378, height: 302 },
      attributes: { 'data-id-margin': '5mm', 'data-id-grid': '4x2' },
      computedStyle: {},
      items: [{
        id: 'group-a',
        role: 'group',
        tagName: 'div',
        attributes: { 'data-id-group': '指标组' },
        boundsMm: { x: 10, y: 10, width: 40, height: 20 },
        classList: [],
        children: [
          { id: 'group-a-title', role: 'text' },
          { id: 'group-a-value', role: 'text' },
        ],
      }],
    }],
  };
  const instructions = compileInstructions(snapshot);
  const group = instructions.pages[0].items.find((item) => item.type === 'GROUP');
  assert.equal(group.name, '指标组');
  assert.deepEqual(group.childItemIds, ['group-a-title', 'group-a-value']);
});
```

- [ ] **步骤 2：实现 GROUP 编译**

创建 `native-groups.js`：

```js
function groupInstructionFor(item, childItems) {
  const attrs = item.attributes || {};
  if (!attrs['data-id-group']) return null;
  return {
    type: 'GROUP',
    id: item.id,
    name: attrs['data-id-group'],
    bounds: item.boundsMm,
    childItemIds: childItems.map((child) => child.id),
    zIndex: item.zIndex || 0,
  };
}

module.exports = { groupInstructionFor };
```

修改 `instructions-compiler.js`：先编译组内子对象，再追加 GROUP item；组 item 只负责执行器分组，不生成额外视觉框。

- [ ] **步骤 3：实现 InDesign 分组**

创建 `hi_groups.jsxinc`：

```js
HI.applyGroups = function (doc, page, groupItems, createdById, report) {
    groupItems = groupItems || [];
    for (var i = 0; i < groupItems.length; i++) {
        var def = groupItems[i];
        var members = [];
        for (var j = 0; j < (def.childItemIds || []).length; j++) {
            var item = createdById[def.childItemIds[j]];
            if (item) members.push(item);
        }
        if (members.length < 2) continue;
        try {
            var group = page.groups.add(members);
            group.name = def.name || def.id;
            createdById[def.id] = group;
        } catch (error) {
            HI.addMessage(report, "warning", "GROUP_CREATE_FAILED", String(error), { groupId: def.id });
        }
    }
};
```

- [ ] **步骤 4：运行验证**

运行：

```bash
node --test test/paged-html/instructions-compiler.test.js
npm test
```

预期：全部通过。

---

### 任务 7：简单 SVG 原生化

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\native-svg.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_native_vectors.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\native-svg-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\native-svg.test.js`

- [ ] **步骤 1：创建 fixture**

创建 `test/fixtures/paged-html/native-svg-deck.html`：

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>.page{width:420mm;height:236.25mm;position:relative;padding:14mm}.diagram{position:absolute;left:20mm;top:20mm;width:120mm;height:70mm}</style></head>
<body>
  <section class="page" data-page="svg-native" data-id-margin="14mm" data-id-grid="12x8">
    <svg class="diagram" data-id-svg-mode="native" viewBox="0 0 120 70">
      <rect x="0" y="0" width="120" height="70" fill="#f2f2f2" stroke="#123456" stroke-width="1"/>
      <circle cx="30" cy="35" r="10" fill="#c8102e"/>
      <line x1="50" y1="35" x2="100" y2="35" stroke="#123456" stroke-width="2"/>
      <text x="10" y="62" fill="#123456" font-size="6">轴网</text>
    </svg>
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

创建 `test/paged-html/native-svg.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('native SVG fixture compiles simple shapes as editable native items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/native-svg-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const types = instructions.pages[0].items.map((item) => item.type);

  assert.equal(types.includes('VECTOR_PATH'), true);
  assert.equal(types.filter((type) => type === 'SHAPE').length >= 2, true);
  assert.equal(types.includes('TEXT'), true);
  assert.equal(instructions.report.messages.some((message) => message.code === 'INLINE_SVG_UNSUPPORTED'), false);
});
```

- [ ] **步骤 3：实现 SVG 子集解析**

创建 `native-svg.js`：

```js
function svgNativeItemsFor(item, styles, layout, report) {
  const attrs = item.attributes || {};
  if (attrs['data-id-svg-mode'] !== 'native') return null;
  const nodes = item.svg && item.svg.nodes || [];
  const out = [];
  for (const node of nodes) {
    if (node.tagName === 'rect') out.push(rectItemForSvgNode(item, node, layout));
    else if (node.tagName === 'circle' || node.tagName === 'ellipse') out.push(ovalItemForSvgNode(item, node, layout));
    else if (node.tagName === 'line') out.push(lineItemForSvgNode(item, node, layout));
    else if (node.tagName === 'text') out.push(textItemForSvgNode(item, node, layout));
    else {
      report.messages.push({ level: 'warning', code: 'SVG_NODE_PLACED_FALLBACK', message: `SVG node is not native-mapped: ${node.tagName}`, itemId: item.id });
      report.warningCount += 1;
    }
  }
  return out;
}

module.exports = { svgNativeItemsFor };
```

支持子集：`rect`、`circle`、`ellipse`、`line`、简单 `path M/L/Z`、`text`。遇到渐变、滤镜、蒙版、文字沿路径、复杂 path 曲线时保留 SVG 置入并记录警告。

- [ ] **步骤 4：实现 InDesign 原生矢量执行**

创建 `hi_native_vectors.jsxinc`：

```js
HI.createVectorPath = function (doc, page, item, context, report) {
    var polygon = page.polygons.add();
    HI.assignLayer(polygon, context, item.layer);
    HI.applyStyleOverride(doc, polygon, item.styleOverride, report);
    try { polygon.paths[0].entirePath = item.points || []; } catch (error) {
        HI.addMessage(report, "warning", "VECTOR_PATH_APPLY_FAILED", String(error), { itemId: item.id });
    }
    return polygon;
};
```

修改 `hi_items.jsxinc` 分发 `VECTOR_PATH`。

- [ ] **步骤 5：运行验证**

运行：

```bash
node --test test/paged-html/native-svg.test.js
npm test
```

预期：全部通过。

---

### 任务 8：语义图表转原生图形

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\native-charts.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_charts.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\native-chart-deck.html`
- 新建：`D:\AI\html-indesign\test\paged-html\native-chart.test.js`

- [ ] **步骤 1：创建 fixture**

创建 `test/fixtures/paged-html/native-chart-deck.html`：

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>.page{width:420mm;height:236.25mm;position:relative;padding:14mm}.chart{position:absolute;left:30mm;top:30mm;width:160mm;height:90mm}</style></head>
<body>
  <section class="page" data-page="chart" data-id-margin="14mm" data-id-grid="12x8">
    <figure class="chart" data-id-chart="bar" data-id-chart-style="面积柱状图">
      <script type="application/json">
        {"title":"面积构成","series":[{"name":"功能","values":[
          {"label":"冰场","value":7600},
          {"label":"服务","value":2400},
          {"label":"后勤","value":5900}
        ]}]}
      </script>
    </figure>
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

创建 `test/paged-html/native-chart.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('native chart fixture compiles chart instruction and editable child items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/native-chart-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const chart = instructions.pages[0].items.find((item) => item.type === 'CHART');

  assert.equal(chart.chartType, 'bar');
  assert.equal(chart.data.series[0].values.length, 3);
  assert.equal(chart.generatedItems.some((item) => item.type === 'SHAPE'), true);
  assert.equal(chart.generatedItems.some((item) => item.type === 'TEXT'), true);
});
```

- [ ] **步骤 3：实现图表编译**

创建 `native-charts.js`：

```js
function chartInstructionFor(item, layout) {
  const attrs = item.attributes || {};
  if (!attrs['data-id-chart']) return null;
  const data = item.chartData || {};
  const bounds = item.boundsMm;
  return {
    id: item.id,
    type: 'CHART',
    chartType: attrs['data-id-chart'],
    chartStyle: attrs['data-id-chart-style'] || null,
    bounds,
    data,
    generatedItems: attrs['data-id-chart'] === 'bar'
      ? barChartItems(item.id, bounds, data, layout)
      : [],
    zIndex: item.zIndex || 0,
  };
}

function barChartItems(chartId, bounds, data) {
  const values = data.series && data.series[0] && data.series[0].values || [];
  const max = Math.max(...values.map((entry) => Number(entry.value || 0)), 1);
  const barGap = 4;
  const barWidth = (bounds.width - barGap * (values.length - 1)) / values.length;
  return values.flatMap((entry, index) => {
    const height = bounds.height * Number(entry.value || 0) / max;
    const x = bounds.x + index * (barWidth + barGap);
    const y = bounds.y + bounds.height - height;
    return [
      { id: `${chartId}-bar-${index}`, type: 'SHAPE', shapeKind: 'rectangle', bounds: { x, y, width: barWidth, height }, role: 'chart-bar' },
      { id: `${chartId}-label-${index}`, type: 'TEXT', bounds: { x, y: bounds.y + bounds.height + 2, width: barWidth, height: 6 }, text: entry.label, role: 'chart-label' },
    ];
  });
}

module.exports = { chartInstructionFor };
```

- [ ] **步骤 4：实现执行器**

创建 `hi_charts.jsxinc`：

```js
HI.createChart = function (doc, page, item, context, report) {
    var generated = item.generatedItems || [];
    var created = [];
    for (var i = 0; i < generated.length; i++) {
        var child = generated[i];
        var pageItem = null;
        if (child.type === "SHAPE") pageItem = HI.createShapeFrame(doc, page, child, context, report);
        else if (child.type === "TEXT") pageItem = HI.createTextFrame(doc, page, child, context, report);
        if (pageItem) created.push(pageItem);
    }
    try {
        if (created.length > 1) return page.groups.add(created);
    } catch (error) {
        HI.addMessage(report, "warning", "CHART_GROUP_CREATE_FAILED", String(error), { itemId: item.id });
    }
    return created.length ? created[0] : null;
};
```

- [ ] **步骤 5：运行验证**

运行：

```bash
node --test test/paged-html/native-chart.test.js
npm test
```

预期：全部通过。

---

### 任务 9：数据套版

**文件：**
- 新建：`D:\AI\html-indesign\src\paged-html\data-merge.js`
- 修改：`D:\AI\html-indesign\src\paged-html\browser-snapshot.js`
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-compiler.js`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_data_merge.jsxinc`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\data-merge-deck.html`
- 新建：`D:\AI\html-indesign\test\fixtures\paged-html\data\rooms.csv`
- 新建：`D:\AI\html-indesign\test\paged-html\data-merge.test.js`

- [ ] **步骤 1：创建 fixture**

创建 `test/fixtures/paged-html/data/rooms.csv`：

```csv
name,area,note
冰场,7600,核心功能
服务,2400,租赁与配套
后勤,5900,设备与库房
```

创建 `test/fixtures/paged-html/data-merge-deck.html`：

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>.page{width:420mm;height:236.25mm;position:relative;padding:14mm}.card{position:absolute;width:70mm;height:30mm}</style></head>
<body>
  <section class="page" data-page="merge" data-id-margin="14mm" data-id-grid="12x8" data-id-data-source="data/rooms.csv" data-id-data-source-name="房间面积">
    <template data-id-repeat="rooms" data-id-repeat-source="房间面积">
      <div class="card" data-id-object data-id-object-style="指标卡片">
        <h3>{{name}}</h3>
        <p>{{area}} 平方米</p>
        <p>{{note}}</p>
      </div>
    </template>
  </section>
</body>
</html>
```

- [ ] **步骤 2：写失败测试**

创建 `test/paged-html/data-merge.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions, validateInstructions } = require('../../src/paged-html');

test('data merge fixture compiles data source and repeated items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/data-merge-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);

  assert.equal(instructions.dataSources[0].name, '房间面积');
  assert.equal(instructions.dataSources[0].records.length, 3);
  assert.equal(instructions.pages[0].items.filter((item) => item.role === 'data-repeat-card').length, 3);

  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: path.dirname(htmlPath),
  });
  assert.equal(validation.valid, true);
});
```

- [ ] **步骤 3：实现 CSV 读取和模板展开**

创建 `data-merge.js`：

```js
const fs = require('fs');
const path = require('path');

function dataSourcesForSnapshot(snapshot, baseDir) {
  const sources = [];
  for (const page of snapshot.pages || []) {
    const attrs = page.attributes || {};
    if (!attrs['data-id-data-source']) continue;
    const sourcePath = path.resolve(baseDir, attrs['data-id-data-source']);
    const records = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
    sources.push({
      id: attrs['data-id-data-source-name'] || attrs['data-id-data-source'],
      name: attrs['data-id-data-source-name'] || attrs['data-id-data-source'],
      path: attrs['data-id-data-source'],
      records,
    });
  }
  return sources;
}

function parseCsv(text) {
  const lines = String(text).trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const record = {};
    headers.forEach((header, index) => { record[header] = cells[index] || ''; });
    return record;
  });
}

module.exports = { dataSourcesForSnapshot, parseCsv };
```

在 `browser-snapshot.js` 中，快照前把 `template[data-id-repeat]` 根据 CSV 展开成普通 DOM 元素，使浏览器预览和 InDesign 输出一致。

- [ ] **步骤 4：执行器记录数据套版信息**

创建 `hi_data_merge.jsxinc`：

```js
HI.recordDataSources = function (instructions, report) {
    var sources = instructions.dataSources || [];
    report.counts.dataSources = sources.length;
    for (var i = 0; i < sources.length; i++) {
        HI.addMessage(report, "info", "DATA_SOURCE_REGISTERED", "Data source compiled into document metadata", {
            name: sources[i].name,
            recordCount: (sources[i].records || []).length
        });
    }
};
```

本项目不调用 InDesign 数据合并面板生成页面；原因是浏览器预览必须与输出一致，数据展开应发生在 HTML 快照前。

- [ ] **步骤 5：运行验证**

运行：

```bash
node --test test/paged-html/data-merge.test.js
npm test
```

预期：全部通过。

---

### 任务 10：真实 InDesign 综合 E2E

**文件：**
- 新建：`D:\AI\html-indesign\test\indesign-executor\advanced-native-fixture-writer.js`
- 新建：`D:\AI\html-indesign\test\indesign-executor\advanced-native-static.test.js`
- 修改：`D:\AI\html-indesign\scripts\indesign-e2e.js`
- 修改：`D:\AI\html-indesign\AGENTS.md`

- [ ] **步骤 1：写静态测试**

创建 `test/indesign-executor/advanced-native-static.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('build script includes advanced native feature libraries', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../../_indesign_scripts/build_from_instructions.jsx'), 'utf8');
  for (const lib of [
    'hi_text.jsxinc',
    'hi_interactive.jsxinc',
    'hi_parent_pages.jsxinc',
    'hi_groups.jsxinc',
    'hi_native_vectors.jsxinc',
    'hi_charts.jsxinc',
    'hi_data_merge.jsxinc',
  ]) {
    assert.match(script, new RegExp(`includeLib\\("${lib}"\\)`));
  }
});
```

- [ ] **步骤 2：扩展 E2E 脚本**

在 `scripts/indesign-e2e.js` 中增加参数：

```js
--fixture advanced-native
```

当 fixture 为 `advanced-native` 时，读取 `test/fixtures/paged-html/advanced-native-deck.html`，生成 instructions 到新的 runDir，并执行 `_indesign_scripts/build_from_instructions.jsx`。

- [ ] **步骤 3：创建综合 HTML fixture**

创建 `test/fixtures/paged-html/advanced-native-deck.html`，合并以下覆盖项：

- 原生列表。
- 双栏文字框。
- 两个串接文本框。
- 一个带文字绕排的图片框。
- 一个脚注。
- 一个内部超链接和两个书签。
- 一个母版页页码。
- 一个分组卡片。
- 一个原生化 SVG。
- 一个柱状图。
- 一个数据套版展开区。

- [ ] **步骤 4：运行完整验证**

运行：

```bash
npm test
cli-anything-indesign server health
node scripts/indesign-e2e.js --fixture advanced-native --target-size qhd
```

预期：

```json
{
  "ok": true,
  "warnings": [],
  "counts": {
    "oversetTextFrames": 0,
    "tables": 1,
    "placedAssets": 1,
    "groups": 3,
    "hyperlinks": 1,
    "bookmarks": 2,
    "parentPages": 1,
    "dataSources": 1
  }
}
```

如果 InDesign DOM 对某个高级对象返回版本差异错误，执行器必须返回具体 warning code；对应 Node 测试增加版本差异覆盖，不允许静默成功。

- [ ] **步骤 5：更新 AGENTS.md 使用说明**

在 `AGENTS.md` 的执行基线后增加：

```markdown
| 高级原生能力真实 E2E | `node scripts/indesign-e2e.js --fixture advanced-native --target-size qhd` |
```

---

## 执行顺序

1. 任务 1 先做，建立 schema 和诊断边界。
2. 任务 2、3 做文本能力，优先解决建筑汇报里的正文、列表、脚注和绕图。
3. 任务 4、5 做文档级能力，让输出更接近人工文件。
4. 任务 6、7 做可编辑结构，解决分组和简单 SVG。
5. 任务 8、9 做高级数据表达。
6. 任务 10 做真实 InDesign 闭环。

每完成一个任务都提交一次。提交信息建议：

```bash
git commit -m "feat: add advanced instruction schema"
git commit -m "feat: support native text lists and frame columns"
git commit -m "feat: support text threading wrap and notes"
git commit -m "feat: compile interactive document features"
git commit -m "feat: support parent pages and sections"
git commit -m "feat: create native groups"
git commit -m "feat: map simple svg to native vectors"
git commit -m "feat: render semantic charts as native objects"
git commit -m "feat: expand data merge templates before snapshot"
git commit -m "test: add advanced native indesign e2e"
```

## 风险和验收

| 风险 | 控制方式 |
| ---- | -------- |
| 高级 InDesign DOM 在不同版本表现不一致 | 每个执行函数捕获错误并返回明确 warning code |
| SVG 复杂度失控 | 只支持简单图元和简单路径，复杂内容回退为置入 SVG |
| 图表能力无限扩张 | 第一轮只实现柱状图，饼图和折线图通过同一 `CHART` schema 扩展 |
| 数据套版破坏浏览器预览 | 数据必须在浏览器快照前展开，InDesign 不单独生成隐藏结果 |
| 母版页和实体页对象重复 | 母版页只承载页码、页眉、页脚和重复装饰，不承载页面主体内容 |

验收命令：

```bash
npm test
node scripts/lint-authoring.js --html test/fixtures/e2e/architecture-report/deck.html --strict --json
node scripts/indesign-e2e.js --target-size qhd
node scripts/indesign-e2e.js --fixture advanced-native --target-size qhd
```

完成标准：

- 所有 Node 测试通过。
- 现有 architecture-report E2E 不回退。
- advanced-native E2E 在真实 InDesign 中输出 0 个文字溢出。
- 不支持项必须以 warning/error/code 形式出现。
- 生成的 InDesign 面板里能看到中文样式名、图层名、母版名、书签名和分组名。

## 自审

- 规格覆盖：当前列出的缺口均对应至少一个任务。
- 空洞扫描：计划未留空洞步骤。
- 类型一致性：新增 item 类型统一为 `GROUP`、`VECTOR_PATH`、`CHART`；文档级字段统一挂在 `document`、`stories`、`dataSources`。
