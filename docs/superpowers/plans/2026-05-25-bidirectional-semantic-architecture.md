# 双向语义模型与架构收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 HTML -> InDesign 功能收敛到统一语义模型，并实现“当前已支持能力”的带标签 InDesign -> HTML 回读闭环。

**Architecture:** 浏览器快照和 InDesign 快照都先进入同一个 Semantic Model；正向构建指令和反向 HTML 都从 Semantic Model 派生。Build Instructions 只作为 InDesign executor 的执行命令，`html_indesign` 脚本标签作为 InDesign 端持久化协议，legacy blueprint 只保留兼容入口。

**Tech Stack:** Node CommonJS、node:test、Playwright browser snapshot、Adobe ExtendScript JSX、`indesign-cli` 真实 InDesign E2E。

## 执行进度

| 任务 | 状态 | 备注 |
| ---- | ---- | ---- |
| Task 1-13 | 已完成 | 已提交到当前分支 |
| Task 14 | 已完成 | `npm test`、严格作者规则检查、真实 InDesign E2E + 回读已通过；E2E 已硬性审计回写 HTML 双向标签 |
| Task 15 | 已完成 | 最终 `npm test`、严格作者规则检查、真实 InDesign E2E + 回读和结果 JSON 核对均通过 |
| Task 16 | 已完成 | 旧 blueprint/template 反向能力已归并到 `indesign-reverse`：支持 `legacyBlueprintToSemanticModel` 和 CLI `--blueprint` 输入，输出 `inferred`/`observation` HTML |

---

## Scope

本计划覆盖：

- 当前 `src/paged-html/` 已支持的页面、文字、字符样式、段落样式、对象样式、框架样式、图层、参考线、图形资源、表格、形状和线条。
- 正向生成完整 `html_indesign` 标签。
- 反向读取本项目生成或人工按协议打标签的 InDesign。
- 页面母版信息和页面结构模板信息互导：`data-id-parent-page` / `data-id-parent-page-name` 对应 InDesign 母版页，`data-id-layout` 只作为页面结构模板标签。
- 旧 `blueprint` 的模板构建器仍保留在 `legacyTemplate`；旧 blueprint 输入能力归并为 `indesign-reverse` 的 `legacy-blueprint` 适配入口，不再绕过新反向模型单独生成 HTML。

本计划不覆盖：

- 未标注 InDesign 的智能语义推断。
- 完整无损还原任意手工 InDesign 文件。
- 尚未实现的高级原生功能，例如目录、索引、交叉引用、脚注、图表原生对象、SVG 拆解。

## File Structure

### New Files

- `src/semantic-model/index.js`  
  统一导出 semantic model 构建、校验、标签工具和 instructions 编译入口。

- `src/semantic-model/from-snapshot.js`  
  把 styled browser snapshot 转为 `DocumentModel`。只做结构化建模，不写 InDesign 指令。

- `src/semantic-model/to-instructions.js`  
  把 `DocumentModel` 转为现有 executor 消费的 build instructions。

- `src/semantic-model/validator.js`  
  校验 `DocumentModel` 的页面、对象、资源、标签、单位、样式引用。

- `src/paged-html/layout.js`  
  从 `instructions-compiler.js` 抽出页面尺寸、单位模式、边距、参考线、坐标换算、目标尺寸解析。

- `src/indesign-reverse/index.js`  
  反向导出 Node API 入口。

- `src/indesign-reverse/snapshot-reader.js`  
  读取 `reverse-snapshot.json` 并标准化路径、标签和报告。

- `src/indesign-reverse/reverse-model.js`  
  把 InDesign reverse snapshot 转为 `DocumentModel`。

- `src/indesign-reverse/html-writer.js`  
  把 `DocumentModel` 写成固定语义 HTML。

- `src/indesign-reverse/report.js`  
  反向导出诊断报告，包括标签缺失、未知对象、资源缺失和降级信息。

- `scripts/indesign-reverse-export.js`  
  CLI 薄封装：生成临时 JSX、调用 `indesign-cli`、读取 snapshot、写 `deck.html` / `reverse-model.json` / `report.json`。

- `_indesign_scripts/export_to_html_snapshot.jsx`  
  真实 InDesign 反向快照脚本入口。

- `_indesign_scripts/lib/hi_labels.jsxinc`  
  ExtendScript 端协议标签读写工具。

- `_indesign_scripts/lib/hi_reverse.jsxinc`  
  ExtendScript 端反向快照工具。

- `test/fixtures/indesign-reverse/tagged-snapshot.json`  
  不依赖 InDesign 的反向导出测试 fixture。

- `test/semantic-model/*.test.js`  
  Semantic Model 单元测试。

- `test/indesign-reverse/*.test.js`  
  反向导出单元测试。

### Modified Files

- `src/shared/labels.js`  
  保留 legacy slot label 函数，新增 `html_indesign` JSON 标签函数。

- `src/paged-html/index.js`  
  导出 `snapshotToSemanticModel`。

- `src/paged-html/instructions-compiler.js`  
  改为调用 `snapshotToSemanticModel` 和 `semanticModelToInstructions`，保留 `compileInstructions(snapshot, options)` API。

- `src/paged-html/instructions-validator.js`  
  校验 labels、`data-id-pdf-page` 迁移 warning、token/displayName 引用结构。

- `_indesign_scripts/lib/hi_core.jsxinc`  
  `HI.insertJsonLabel` 返回成功/失败，并把关键标签写入失败记入 report。

- `_indesign_scripts/lib/hi_document.jsxinc`  
  写文档、页面、参考线和母版标签；支持应用母版页。

- `_indesign_scripts/lib/hi_styles.jsxinc`  
  写样式标签。

- `_indesign_scripts/lib/hi_items.jsxinc`  
  写页面对象 JSON 标签，同时保留紧凑 `pageItem.label`。

- `_indesign_scripts/lib/hi_executor.jsxinc`  
  把 labels、parentPages、page layout 信息接入执行流程。

- `scripts/indesign-e2e.js`  
  在真实 E2E 中增加可选 round-trip reverse 验证。

- `index.js`  
  导出 `semanticModel` 和 `indesignReverse`。

- `package.json`  
  增加 `reverse:indesign` 脚本。

- `docs/规范/*.md` 和 `AGENTS.md`  
  只同步实现中落地的命令、字段和执行基线。

---

## Task 1: Expand Shared Label Protocol Utilities

**Files:**
- Modify: `src/shared/labels.js`
- Test: `test/shared/labels.test.js`

- [ ] **Step 1: Write failing tests for protocol labels**

Add tests without removing existing legacy slot tests:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createProtocolLabel,
  parseProtocolLabel,
  normalizeStyleRef,
  labelDisplayPair,
  labelCoordinateUnit,
} = require('../../src/shared/labels');

test('createProtocolLabel creates stable html_indesign payloads', () => {
  assert.deepEqual(createProtocolLabel({
    kind: 'item',
    id: 'agenda-title',
    source: 'html-to-indesign',
    role: 'text',
    semantic: 'page-title',
  }), {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: 'agenda-title',
    source: 'html-to-indesign',
    role: 'text',
    semantic: 'page-title',
  });
});

test('parseProtocolLabel rejects invalid json and kind mismatches', () => {
  assert.equal(parseProtocolLabel('', { expectedKind: 'item' }).valid, false);
  assert.equal(parseProtocolLabel('{"protocol":"x"}', { expectedKind: 'item' }).valid, false);
  const parsed = parseProtocolLabel(JSON.stringify(createProtocolLabel({
    kind: 'page',
    id: 'page-1',
    source: 'html-to-indesign',
  })), { expectedKind: 'item' });
  assert.equal(parsed.valid, false);
  assert.equal(parsed.errors[0].code, 'LABEL_KIND_MISMATCH');
});

test('normalizeStyleRef preserves token and displayName separately', () => {
  assert.deepEqual(normalizeStyleRef({ token: 'page-title', displayName: '页面标题' }), {
    token: 'page-title',
    displayName: '页面标题',
  });
  assert.deepEqual(normalizeStyleRef('page-title'), {
    token: 'page-title',
    displayName: null,
  });
});

test('labelDisplayPair and labelCoordinateUnit provide stable defaults', () => {
  assert.deepEqual(labelDisplayPair('report-parent', '汇报母版'), {
    id: 'report-parent',
    name: '汇报母版',
  });
  assert.equal(labelCoordinateUnit({ coordinateUnit: 'pt' }), 'pt');
  assert.equal(labelCoordinateUnit({ unitMode: 'print' }), 'mm');
});
```

- [ ] **Step 2: Run the label tests and verify failure**

Run:

```powershell
npm test -- test/shared/labels.test.js
```

Expected: FAIL because `createProtocolLabel`, `parseProtocolLabel`, `normalizeStyleRef`, `labelDisplayPair`, or `labelCoordinateUnit` are not exported yet.

- [ ] **Step 3: Implement label utilities while preserving legacy exports**

Add these functions to `src/shared/labels.js`:

```js
const PROTOCOL = 'html-indesign';
const PROTOCOL_VERSION = 1;

function createProtocolLabel(input) {
  const base = {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    kind: requiredString(input.kind, 'kind'),
    id: requiredString(input.id, 'id'),
    source: input.source || 'html-to-indesign',
  };
  const payload = { ...input };
  delete payload.protocol;
  delete payload.version;
  delete payload.kind;
  delete payload.id;
  delete payload.source;
  return { ...base, ...payload };
}

function requiredString(value, field) {
  const out = String(value || '').trim();
  if (!out) throw new Error(`Protocol label requires ${field}.`);
  return out;
}

function parseProtocolLabel(raw, options = {}) {
  const errors = [];
  let value = null;
  try {
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    errors.push({ code: 'LABEL_JSON_INVALID', message: String(error) });
    return { valid: false, label: null, errors };
  }
  if (!value || value.protocol !== PROTOCOL) {
    errors.push({ code: 'LABEL_PROTOCOL_MISSING', message: 'Label protocol is missing or unsupported.' });
  }
  if (value && value.version !== PROTOCOL_VERSION) {
    errors.push({ code: 'LABEL_VERSION_UNSUPPORTED', message: `Unsupported label version: ${value.version}` });
  }
  if (options.expectedKind && value && value.kind !== options.expectedKind) {
    errors.push({ code: 'LABEL_KIND_MISMATCH', message: `Expected ${options.expectedKind}, got ${value.kind}.` });
  }
  if (!value || !value.id) {
    errors.push({ code: 'LABEL_ID_MISSING', message: 'Label id is missing.' });
  }
  return { valid: errors.length === 0, label: value || null, errors };
}

function normalizeStyleRef(value) {
  if (!value) return { token: null, displayName: null };
  if (typeof value === 'string') return { token: value, displayName: null };
  return {
    token: value.token || value.id || null,
    displayName: value.displayName || value.name || null,
  };
}

function labelDisplayPair(id, name) {
  return {
    id: String(id || '').trim(),
    name: name ? String(name).trim() : null,
  };
}

function labelCoordinateUnit(documentLabel) {
  const explicit = String(documentLabel && documentLabel.coordinateUnit || '').toLowerCase();
  if (explicit === 'pt' || explicit === 'mm') return explicit;
  return String(documentLabel && documentLabel.unitMode || '').toLowerCase() === 'presentation' ? 'pt' : 'mm';
}
```

Update `module.exports` to include the new functions and keep existing `normalizeLabel`, `parseLabeledSegments`, `parseSlotName`, `parseSlotType`, `findBySlotName`.

- [ ] **Step 4: Run the label tests and verify pass**

Run:

```powershell
npm test -- test/shared/labels.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/labels.js test/shared/labels.test.js
git commit -m "feat: add html_indesign label utilities"
```

---

## Task 2: Extract Paged Layout Helpers

**Files:**
- Create: `src/paged-html/layout.js`
- Modify: `src/paged-html/instructions-compiler.js`
- Test: `test/paged-html/layout.test.js`

- [ ] **Step 1: Write failing tests for layout helpers**

Create `test/paged-html/layout.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../../src/paged-html/layout');

test('resolveLayout maps presentation source pixels to pt target size', () => {
  const layout = resolveLayout({
    pages: [{ rectPx: { width: 1920, height: 1080 }, widthMm: 508, heightMm: 285.75 }],
  }, { unitMode: 'presentation', targetSize: 'qhd' });
  assert.equal(layout.unitMode, 'presentation');
  assert.equal(layout.targetUnit, 'pt');
  assert.deepEqual(layout.targetSize, { width: 2560, height: 1440, name: 'qhd' });
  assert.equal(layout.scale, 2560 / 1920);
});

test('pageMargins reads data-id-margin before CSS padding', () => {
  const layout = { unitMode: 'print', targetUnit: 'mm', scale: 1 };
  const margins = pageMargins({
    attributes: { 'data-id-margin': '14mm 16mm 10mm 18mm' },
    computedStyle: { paddingTop: '1mm', paddingRight: '1mm', paddingBottom: '1mm', paddingLeft: '1mm' },
  }, layout);
  assert.deepEqual(margins, { top: 14, right: 16, bottom: 10, left: 18 });
});

test('pageGuides creates gutter-aware grid guides', () => {
  const layout = { unitMode: 'print', targetUnit: 'mm', scale: 1 };
  const guides = pageGuides({
    attributes: {
      'data-id-grid': '4x2',
      'data-id-column-gutter': '4mm',
      'data-id-row-gutter': '6mm',
    },
    computedStyle: {},
    items: [],
  }, { width: 100, height: 60 }, { top: 10, right: 10, bottom: 10, left: 10 }, layout);
  assert.deepEqual(guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [29, 33, 52, 56, 75, 79]);
  assert.deepEqual(guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [27, 33]);
});

test('itemBounds converts browser pixels in presentation mode', () => {
  const bounds = itemBounds({
    rectPx: { x: 110, y: 70, width: 200, height: 80 },
    boundsMm: { x: 10, y: 10, width: 20, height: 20 },
  }, {
    rectPx: { x: 100, y: 50, width: 1000, height: 500 },
  }, {
    unitMode: 'presentation',
    scale: 2,
  });
  assert.deepEqual(bounds, { x: 20, y: 40, width: 400, height: 160 });
});
```

- [ ] **Step 2: Run layout tests and verify failure**

Run:

```powershell
npm test -- test/paged-html/layout.test.js
```

Expected: FAIL because `src/paged-html/layout.js` does not exist.

- [ ] **Step 3: Move layout helpers out of instructions compiler**

Create `src/paged-html/layout.js` by moving these existing functions from `src/paged-html/instructions-compiler.js` without changing behavior:

```js
const { parseCssLength, round } = require('../shared/geometry');
```

Functions to move: `resolveLayout`, `targetSizeFor`, `assertCompatibleAspectRatio`, `pageDimensions`, `pageMargins`, `pageStyleLength`, `boxLengths`, `pageGuides`, `usesUsedSnapGuides`, `usedSnapGuides`, `usedSnapGuideCandidate`, `coversWholePage`, `semanticGridSpec`, `semanticGridGuides`, `baselineGridGuides`, `cssGridGuides`, `evenGridGuides`, `trackGuides`, `parseTrackLengths`, `uniqueGuides`, `itemBounds`, `boundsFromRect`, `cssLengthToTarget`, `cssLengthToMm`, `normalizeVisualMm`.

The exported API must be:

```js
module.exports = {
  resolveLayout,
  targetSizeFor,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
  cssLengthToTarget,
  cssLengthToMm,
  normalizeVisualMm,
};
```

In `src/paged-html/instructions-compiler.js`, replace local definitions with imports:

```js
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
  cssLengthToTarget,
  cssLengthToMm,
  normalizeVisualMm,
} = require('./layout');
```

Remove the moved local functions from `instructions-compiler.js`.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- test/paged-html/layout.test.js test/paged-html/instructions-compiler.test.js
```

Expected: PASS. Existing `compileInstructions` output remains compatible.

- [ ] **Step 5: Commit**

```powershell
git add src/paged-html/layout.js src/paged-html/instructions-compiler.js test/paged-html/layout.test.js
git commit -m "refactor: extract paged html layout helpers"
```

---

## Task 3: Create Semantic Model From Browser Snapshot

**Files:**
- Create: `src/semantic-model/from-snapshot.js`
- Create: `src/semantic-model/index.js`
- Modify: `src/paged-html/index.js`
- Test: `test/semantic-model/from-snapshot.test.js`

- [ ] **Step 1: Write failing semantic model tests**

Create `test/semantic-model/from-snapshot.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');
const { snapshotToSemanticModel } = require('../../src/semantic-model');

test('snapshotToSemanticModel builds document pages, styles, assets, and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, {
    unitMode: 'presentation',
    targetSize: 'same',
  });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.unitMode, 'presentation');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].items.length > 0, true);
  assert.equal(model.pages[0].labels[0].kind, 'page');
  assert.equal(model.styles.paragraphStyles && typeof model.styles.paragraphStyles, 'object');
  assert.equal(Array.isArray(model.assets), true);
});

test('snapshotToSemanticModel preserves page layout and parent page metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      widthMm: 508,
      heightMm: 285.75,
      rectPx: { x: 0, y: 0, width: 1920, height: 1080 },
      classList: ['page'],
      attributes: {
        'data-page': 'agenda',
        'data-id-semantic': 'agenda',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-name': '汇报母版',
        'data-id-layout': 'contents-grid',
        'data-id-margin': '14mm',
        'data-id-grid': '12x6',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].semantic, 'agenda');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.deepEqual(model.pages[0].margins, { top: 14, right: 14, bottom: 14, left: 14 });
});
```

- [ ] **Step 2: Run semantic model tests and verify failure**

Run:

```powershell
npm test -- test/semantic-model/from-snapshot.test.js
```

Expected: FAIL because `src/semantic-model` does not exist.

- [ ] **Step 3: Implement snapshotToSemanticModel**

Create `src/semantic-model/from-snapshot.js`:

```js
const { compileStyles } = require('../paged-html/style-compiler');
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../paged-html/layout');
const { createProtocolLabel } = require('../shared/labels');

function snapshotToSemanticModel(snapshot, options = {}) {
  const layout = resolveLayout(snapshot, options);
  const styled = snapshot.styles ? snapshot : compileStyles(snapshot, { ...options, layout });
  const documentId = documentIdFor(styled, options);
  const coordinateUnit = layout.targetUnit;
  const pages = (styled.pages || []).map((page) => pageModelFor(page, layout));
  const parentPages = parentPagesFor(pages);
  return {
    kind: 'DocumentModel',
    id: documentId,
    title: options.title || documentId,
    source: styled.metadata && styled.metadata.source,
    unitMode: layout.unitMode,
    coordinateUnit,
    pageSize: pages[0] ? { width: pages[0].width, height: pages[0].height, unit: coordinateUnit } : null,
    labels: [createProtocolLabel({
      kind: 'document',
      id: documentId,
      source: 'html-to-indesign',
      unitMode: layout.unitMode,
      coordinateUnit,
      profile: options.profile || null,
    })],
    parentPages,
    pages,
    layers: [],
    styles: styled.styles || {},
    assets: styled.assets || [],
    warnings: styled.warnings || [],
    report: styled.report || null,
  };
}

function documentIdFor(snapshot, options) {
  if (options.documentId) return options.documentId;
  const source = snapshot.metadata && snapshot.metadata.source;
  if (!source) return 'html-document';
  return String(source).split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || 'html-document';
}

function pageModelFor(page, layout) {
  const dimensions = pageDimensions(page, layout);
  const margins = pageMargins(page, layout);
  const attrs = page.attributes || {};
  const pageId = page.id || attrs['data-page'] || `page-${Number(page.index || 0) + 1}`;
  return {
    id: pageId,
    index: page.index,
    pageToken: attrs['data-page'] || null,
    semantic: attrs['data-id-semantic'] || attrs['data-page'] || null,
    parentPageId: attrs['data-id-parent-page'] || null,
    parentPageName: attrs['data-id-parent-page-name'] || null,
    layout: attrs['data-id-layout'] || null,
    width: dimensions.width,
    height: dimensions.height,
    rectPx: page.rectPx,
    margins,
    guides: pageGuides(page, dimensions, margins, layout).map((guide, index) => ({
      ...guide,
      id: `${pageId}-guide-${index + 1}`,
      labels: [createProtocolLabel({
        kind: 'guide',
        id: `${pageId}-guide-${index + 1}`,
        source: 'html-to-indesign',
        pageId,
        guideSource: guide.source || 'grid',
        axis: guide.orientation === 'vertical' ? 'x' : 'y',
        position: guide.position,
      })],
    })),
    items: (page.items || []).map((item) => itemModelFor(item, page, layout)),
    labels: [createProtocolLabel({
      kind: 'page',
      id: pageId,
      source: 'html-to-indesign',
      semantic: attrs['data-id-semantic'] || attrs['data-page'] || null,
      parentPageId: attrs['data-id-parent-page'] || null,
      parentPageName: attrs['data-id-parent-page-name'] || null,
      layout: attrs['data-id-layout'] || null,
      margins,
    })],
  };
}

function itemModelFor(item, page, layout) {
  const attrs = item.attributes || {};
  const semantic = attrs['data-id-semantic']
    || attrs['data-id-paragraph-style']
    || attrs['data-id-object-style']
    || firstClass(item)
    || item.role;
  return {
    id: item.id,
    role: item.role,
    sourceSelector: item.sourceSelector,
    tagName: item.tagName,
    semantic,
    htmlClass: (item.classList || []).join(' '),
    bounds: itemBounds(item, page, layout),
    zIndex: item.zIndex || 0,
    layerToken: attrs['data-id-layer'] || null,
    styleRefs: item.styleRefs || {},
    content: item.content || null,
    raw: item,
    labels: [createProtocolLabel({
      kind: 'item',
      id: item.id,
      source: 'html-to-indesign',
      role: item.role,
      semantic,
      htmlTag: item.tagName,
      className: (item.classList || []).join(' '),
      sourceSelector: item.sourceSelector,
    })],
  };
}

function firstClass(item) {
  return item.classList && item.classList.length ? item.classList[0] : null;
}

function parentPagesFor(pages) {
  const byId = new Map();
  for (const page of pages) {
    if (!page.parentPageId) continue;
    if (!byId.has(page.parentPageId)) {
      byId.set(page.parentPageId, {
        id: page.parentPageId,
        name: page.parentPageName || page.parentPageId,
        semantic: page.parentPageId,
        provides: ['guides'],
        items: [],
        labels: [createProtocolLabel({
          kind: 'parentPage',
          id: page.parentPageId,
          source: 'html-to-indesign',
          name: page.parentPageName || page.parentPageId,
          semantic: page.parentPageId,
          provides: ['guides'],
        })],
      });
    }
  }
  return Array.from(byId.values());
}

module.exports = {
  snapshotToSemanticModel,
};
```

Create `src/semantic-model/index.js`:

```js
const { snapshotToSemanticModel } = require('./from-snapshot');

module.exports = {
  snapshotToSemanticModel,
};
```

Modify `src/paged-html/index.js` to re-export:

```js
const { snapshotToSemanticModel } = require('../semantic-model');

module.exports = {
  renderSnapshot,
  compileStyles,
  compileInstructions,
  snapshotToSemanticModel,
  validateAuthoringRules,
  validateInstructions,
};
```

- [ ] **Step 4: Run semantic model tests**

Run:

```powershell
npm test -- test/semantic-model/from-snapshot.test.js test/public-api.test.js
```

Expected: PASS after updating `test/public-api.test.js` to assert `api.pagedHtml.snapshotToSemanticModel`.

- [ ] **Step 5: Commit**

```powershell
git add src/semantic-model src/paged-html/index.js test/semantic-model/from-snapshot.test.js test/public-api.test.js
git commit -m "feat: build semantic model from browser snapshot"
```

---

## Task 4: Compile Build Instructions From Semantic Model

**Files:**
- Create: `src/semantic-model/to-instructions.js`
- Modify: `src/semantic-model/index.js`
- Modify: `src/paged-html/instructions-compiler.js`
- Test: `test/semantic-model/to-instructions.test.js`
- Test: `test/paged-html/instructions-compiler.test.js`

- [ ] **Step 1: Write failing tests for semanticModelToInstructions**

Create `test/semantic-model/to-instructions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');
const { snapshotToSemanticModel, semanticModelToInstructions } = require('../../src/semantic-model');

test('semanticModelToInstructions produces current executor schema', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.unitMode, 'presentation');
  assert.equal(instructions.document.coordinateUnit, 'pt');
  assert.equal(instructions.document.pages.length, model.pages.length);
  assert.equal(instructions.pages.length, model.pages.length);
  assert.equal(Array.isArray(instructions.layers), true);
  assert.equal(instructions.pages[0].items.every((item) => item.id && item.type && item.bounds), true);
});
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```powershell
npm test -- test/semantic-model/to-instructions.test.js
```

Expected: FAIL because `semanticModelToInstructions` is not exported.

- [ ] **Step 3: Move instruction item conversion behind semanticModelToInstructions**

Create `src/semantic-model/to-instructions.js` by moving the instruction-specific functions from `src/paged-html/instructions-compiler.js`:

```js
const { createReport, addMessage } = require('../shared/report');

function semanticModelToInstructions(model, options = {}) {
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: model.pages.length,
  });
  const pages = model.pages.map((page) => ({
    id: page.id,
    index: page.index,
    parentPageId: page.parentPageId || null,
    parentPageName: page.parentPageName || null,
    layout: page.layout || null,
    labels: page.labels || [],
    items: instructionItemsForPage(page, model, options)
      .filter(Boolean)
      .sort((a, b) => Number(a.zIndex || 0) - Number(b.zIndex || 0)),
  }));
  return {
    metadata: {
      source: model.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/semantic-model-to-instructions',
      mode: options.mode || 'editable-first',
      protocolVersion: 1,
    },
    document: {
      id: model.id,
      unitMode: model.unitMode,
      coordinateUnit: model.coordinateUnit,
      labels: model.labels || [],
      parentPages: model.parentPages || [],
      pages: model.pages.map((page) => ({
        id: page.id,
        width: page.width,
        height: page.height,
        margins: page.margins,
        guides: page.guides || [],
        labels: page.labels || [],
      })),
    },
    styles: model.styles || {},
    assets: model.assets || [],
    layers: collectLayersFromModel(model, options),
    pages,
    warnings: model.warnings || [],
    report,
  };
}
```

Move existing behavior for text, graphic, table, line, shape, decoration items, `collectLayers`, and `mappedLayerName` into this module. The moved code should read `modelItem.raw` when it still needs browser-specific computed style:

```js
function instructionItemFor(modelItem, page, model, options) {
  const item = modelItem.raw || modelItem;
  const base = {
    id: modelItem.id,
    role: modelItem.role,
    bounds: modelItem.bounds,
    zIndex: modelItem.zIndex || 0,
    layer: layerForModelItem(modelItem, options),
    sourceSelector: modelItem.sourceSelector,
    styleRefs: modelItem.styleRefs || {},
    labels: modelItem.labels || [],
    effects: item.effects || null,
  };
  if (modelItem.role === 'text') return textInstructionFor(modelItem, item, base);
  if (modelItem.role === 'graphic') return graphicInstructionFor(modelItem, item, base, model);
  if (modelItem.role === 'table') return tableInstructionFor(modelItem, item, base);
  const line = nativeLineFor(item, base.bounds, model);
  if (line) return { ...base, ...line, type: 'LINE', objectStyle: base.styleRefs.objectStyle, frameStyle: null };
  return shapeInstructionFor(modelItem, item, base);
}

function textInstructionFor(modelItem, item, base) {
  return {
    ...base,
    type: 'TEXT',
    text: item.content && item.content.text || item.text || '',
    paragraphStyle: base.styleRefs.paragraphStyle,
    objectStyle: base.styleRefs.objectStyle,
    frameStyle: base.styleRefs.frameStyle,
    runs: item.content && item.content.runs || item.runs || [],
  };
}

function graphicInstructionFor(modelItem, item, base, model) {
  const asset = assetForModelItem(modelItem, model.assets || []);
  return {
    ...base,
    type: 'GRAPHIC',
    objectStyle: base.styleRefs.objectStyle,
    frameStyle: base.styleRefs.frameStyle,
    contentBounds: item.contentBounds || null,
    placed: asset ? {
      assetId: asset.id,
      fit: item.placed && item.placed.fit || 'contain',
      position: item.placed && item.placed.position || '50% 50%',
      pageNumber: item.placed && item.placed.pageNumber,
      crop: item.placed && item.placed.crop,
      artboard: item.placed && item.placed.artboard,
      layerComp: item.placed && item.placed.layerComp,
      preserveVector: item.placed && item.placed.preserveVector,
      contentBounds: item.contentBounds || null,
    } : null,
  };
}

function tableInstructionFor(modelItem, item, base) {
  return {
    ...base,
    type: 'TABLE',
    tableStyle: base.styleRefs.tableStyle,
    objectStyle: base.styleRefs.objectStyle,
    frameStyle: base.styleRefs.frameStyle,
    text: item.text,
    rows: item.content && item.content.rows || [],
    columnCount: item.content && item.content.columnCount || 0,
    columnWidths: item.content && item.content.columnWidths || [],
    rowHeights: item.content && item.content.rowHeights || [],
  };
}

function shapeInstructionFor(modelItem, item, base) {
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: base.styleRefs.objectStyle,
    frameStyle: base.styleRefs.frameStyle,
    shapeKind: item.shapeKind || 'rectangle',
  };
}

function assetForModelItem(modelItem, assets) {
  const raw = modelItem.raw || {};
  const source = raw.attributes && (raw.attributes.src || raw.attributes.data);
  return (assets || []).find((asset) => asset.id === modelItem.assetId)
    || (assets || []).find((asset) => source && asset.src === source)
    || (assets || []).find((asset) => asset.sourceSelector === modelItem.sourceSelector)
    || null;
}

function nativeLineFor(item) {
  return item.nativeLine || null;
}
```

After this dispatch is in place, move the existing helper bodies for asset lookup, placement, native line detection, table sizing, decoration borders and object text from `src/paged-html/instructions-compiler.js` into `src/semantic-model/to-instructions.js`. Keep their current test coverage green instead of changing visual behavior in this task.

Update `src/semantic-model/index.js`:

```js
const { snapshotToSemanticModel } = require('./from-snapshot');
const { semanticModelToInstructions } = require('./to-instructions');

module.exports = {
  snapshotToSemanticModel,
  semanticModelToInstructions,
};
```

- [ ] **Step 4: Update compileInstructions to delegate**

In `src/paged-html/instructions-compiler.js`, reduce `compileInstructions` to:

```js
const { snapshotToSemanticModel, semanticModelToInstructions } = require('../semantic-model');

function compileInstructions(snapshot, options = {}) {
  const model = snapshotToSemanticModel(snapshot, options);
  return semanticModelToInstructions(model, options);
}

module.exports = {
  compileInstructions,
};
```

Delete instruction conversion functions after confirming they exist in `src/semantic-model/to-instructions.js`.

- [ ] **Step 5: Run focused and public tests**

Run:

```powershell
npm test -- test/semantic-model/to-instructions.test.js test/paged-html/instructions-compiler.test.js test/public-api.test.js
```

Expected: PASS. Existing `compileInstructions(snapshot, options)` remains compatible.

- [ ] **Step 6: Commit**

```powershell
git add src/semantic-model/to-instructions.js src/semantic-model/index.js src/paged-html/instructions-compiler.js test/semantic-model/to-instructions.test.js test/paged-html/instructions-compiler.test.js
git commit -m "refactor: compile instructions from semantic model"
```

---

## Task 5: Add Semantic Model Validation

**Files:**
- Create: `src/semantic-model/validator.js`
- Modify: `src/semantic-model/index.js`
- Test: `test/semantic-model/validator.test.js`

- [ ] **Step 1: Write failing validation tests**

Create `test/semantic-model/validator.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSemanticModel } = require('../../src/semantic-model');

test('validateSemanticModel requires pages and page labels', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    pages: [{ id: 'p1', items: [], labels: [] }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'DOCUMENT_LABEL_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PAGE_LABEL_MISSING'), true);
});

test('validateSemanticModel rejects duplicate item ids on a page', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{ id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] }, { id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] }],
    }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'ITEM_ID_DUPLICATED');
});
```

- [ ] **Step 2: Run validation tests and verify failure**

Run:

```powershell
npm test -- test/semantic-model/validator.test.js
```

Expected: FAIL because `validateSemanticModel` is not exported.

- [ ] **Step 3: Implement validateSemanticModel**

Create `src/semantic-model/validator.js`:

```js
function validateSemanticModel(model) {
  const errors = [];
  if (!model || model.kind !== 'DocumentModel') {
    errors.push({ code: 'SEMANTIC_MODEL_INVALID', message: 'Expected DocumentModel.' });
    return { valid: false, errors, warnings: [] };
  }
  if (!hasLabel(model.labels, 'document')) {
    errors.push({ code: 'DOCUMENT_LABEL_MISSING', message: 'Document html_indesign label is missing.' });
  }
  if (!Array.isArray(model.pages) || model.pages.length === 0) {
    errors.push({ code: 'PAGE_MISSING', message: 'DocumentModel requires at least one page.' });
  }
  for (const page of model.pages || []) {
    validatePage(page, errors);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

function validatePage(page, errors) {
  if (!page.id) errors.push({ code: 'PAGE_ID_MISSING', message: 'Page id is missing.' });
  if (!hasLabel(page.labels, 'page')) {
    errors.push({ code: 'PAGE_LABEL_MISSING', pageId: page.id, message: 'Page html_indesign label is missing.' });
  }
  const ids = new Set();
  for (const item of page.items || []) {
    if (ids.has(item.id)) {
      errors.push({ code: 'ITEM_ID_DUPLICATED', pageId: page.id, itemId: item.id, message: `Duplicate item id: ${item.id}` });
    }
    ids.add(item.id);
    if (!hasLabel(item.labels, 'item')) {
      errors.push({ code: 'ITEM_LABEL_MISSING', pageId: page.id, itemId: item.id, message: 'Item html_indesign label is missing.' });
    }
  }
}

function hasLabel(labels, kind) {
  return (labels || []).some((label) => label && label.kind === kind && label.id);
}

module.exports = {
  validateSemanticModel,
};
```

Export from `src/semantic-model/index.js`.

- [ ] **Step 4: Run semantic model tests**

Run:

```powershell
npm test -- test/semantic-model
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/semantic-model/validator.js src/semantic-model/index.js test/semantic-model/validator.test.js
git commit -m "feat: validate semantic model"
```

---

## Task 6: Carry Full Labels Through Instructions and Validation

**Files:**
- Modify: `src/semantic-model/to-instructions.js`
- Modify: `src/paged-html/instructions-validator.js`
- Test: `test/paged-html/instructions-validator.test.js`
- Test: `test/semantic-model/to-instructions.test.js`

- [ ] **Step 1: Write failing tests for instruction labels**

Add to `test/semantic-model/to-instructions.test.js`:

```js
test('semanticModelToInstructions carries labels for document pages guides layers and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.labels[0].kind, 'document');
  assert.equal(instructions.document.pages[0].labels[0].kind, 'page');
  assert.equal(instructions.document.pages[0].guides[0].labels[0].kind, 'guide');
  assert.equal(instructions.pages[0].items.every((item) => Array.isArray(item.labels) && item.labels.length > 0), true);
});
```

Add to `test/paged-html/instructions-validator.test.js`:

```js
test('validateInstructions rejects missing required protocol labels in strict mode', () => {
  const instructions = {
    document: {
      unitMode: 'presentation',
      coordinateUnit: 'pt',
      pages: [{ id: 'p1', width: 100, height: 100, margins: {}, guides: [] }],
    },
    styles: {},
    assets: [],
    layers: [],
    pages: [{ id: 'p1', items: [{ id: 'i1', type: 'SHAPE', bounds: { x: 0, y: 0, width: 10, height: 10 } }] }],
  };
  const result = validateInstructions(instructions, { requireLabels: true });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'INSTRUCTION_LABEL_MISSING'), true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- test/semantic-model/to-instructions.test.js test/paged-html/instructions-validator.test.js
```

Expected: FAIL because validator does not enforce labels yet.

- [ ] **Step 3: Add label validation**

In `src/paged-html/instructions-validator.js`, add:

```js
function validateProtocolLabels(instructions, options, errors) {
  if (!options.requireLabels) return;
  if (!hasRequiredLabel(instructions.document && instructions.document.labels, 'document')) {
    errors.push({ code: 'INSTRUCTION_LABEL_MISSING', message: 'Document label is missing.', target: 'document' });
  }
  for (const page of instructions.document && instructions.document.pages || []) {
    if (!hasRequiredLabel(page.labels, 'page')) {
      errors.push({ code: 'INSTRUCTION_LABEL_MISSING', message: `Page '${page.id}' label is missing.`, pageId: page.id });
    }
    for (const guide of page.guides || []) {
      if (!hasRequiredLabel(guide.labels, 'guide')) {
        errors.push({ code: 'INSTRUCTION_LABEL_MISSING', message: `Guide on page '${page.id}' label is missing.`, pageId: page.id });
      }
    }
  }
  for (const page of instructions.pages || []) {
    for (const item of page.items || []) {
      if (!hasRequiredLabel(item.labels, 'item')) {
        errors.push({ code: 'INSTRUCTION_LABEL_MISSING', message: `Item '${item.id}' label is missing.`, pageId: page.id, itemId: item.id });
      }
    }
  }
}

function hasRequiredLabel(labels, kind) {
  return (labels || []).some((label) => label && label.protocol === 'html-indesign' && label.kind === kind && label.id);
}
```

Call it inside `validateInstructions` before returning:

```js
validateProtocolLabels(instructions, options, errors);
```

- [ ] **Step 4: Ensure instructions contain labels**

In `src/semantic-model/to-instructions.js`, ensure:

- `instructions.document.labels` exists.
- `instructions.document.pages[*].labels` exists.
- `instructions.document.pages[*].guides[*].labels` exists.
- `instructions.layers[*].labels` exists.
- `instructions.pages[*].items[*].labels` exists.

Layer objects should use stable token and display name:

```js
function layerInstruction(token, displayName, order) {
  return {
    token,
    name: displayName || token,
    order,
    labels: [createProtocolLabel({
      kind: 'layer',
      id: `layer-${token}`,
      source: 'html-to-indesign',
      token,
      displayName: displayName || token,
    })],
  };
}
```

- [ ] **Step 5: Run tests with label requirement**

Run:

```powershell
npm test -- test/semantic-model/to-instructions.test.js test/paged-html/instructions-validator.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/semantic-model/to-instructions.js src/paged-html/instructions-validator.js test/semantic-model/to-instructions.test.js test/paged-html/instructions-validator.test.js
git commit -m "feat: carry protocol labels through instructions"
```

---

## Task 7: Write Full Protocol Labels in InDesign Executor

**Files:**
- Create: `_indesign_scripts/lib/hi_labels.jsxinc`
- Modify: `_indesign_scripts/lib/hi_core.jsxinc`
- Modify: `_indesign_scripts/lib/hi_document.jsxinc`
- Modify: `_indesign_scripts/lib/hi_styles.jsxinc`
- Modify: `_indesign_scripts/lib/hi_items.jsxinc`
- Modify: `scripts/indesign-e2e.js`
- Test: `test/indesign-executor/executor-script-static.test.js`
- Test: `test/indesign-e2e-runner.test.js`

- [ ] **Step 1: Write static tests for label writer inclusion and failures**

Add to `test/indesign-executor/executor-script-static.test.js`:

```js
test('build script includes label helpers before executor runs', () => {
  const { buildBuildJsx } = require('../../scripts/indesign-e2e');
  const jsx = buildBuildJsx({
    repoRoot: 'D:/AI/html-indesign',
    instructionsPath: 'D:/AI/html-indesign/test/workspace/instructions.json',
  });
  assert.match(jsx, /includeLib\("hi_labels\.jsxinc"\)/);
  assert.match(jsx, /includeLib\("hi_document\.jsxinc"\)/);
  assert.match(jsx, /includeLib\("hi_items\.jsxinc"\)/);
});
```

Add string checks:

```js
test('executor label helpers report key label write failures', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_labels.jsxinc'), 'utf8');
  assert.match(source, /HI\.writeProtocolLabels/);
  assert.match(source, /LABEL_WRITE_FAILED/);
  assert.match(source, /critical/);
});
```

- [ ] **Step 2: Run static tests and verify failure**

Run:

```powershell
npm test -- test/indesign-executor/executor-script-static.test.js test/indesign-e2e-runner.test.js
```

Expected: FAIL because `hi_labels.jsxinc` is not included.

- [ ] **Step 3: Implement ExtendScript label helpers**

Create `_indesign_scripts/lib/hi_labels.jsxinc`:

```js
if (typeof HI === "undefined") { HI = {}; }

HI.writeProtocolLabels = function (target, labels, report, details) {
    var ok = true;
    var critical = details && details.critical === true;
    for (var i = 0; i < (labels || []).length; i++) {
        if (!HI.writeProtocolLabel(target, labels[i], report, details)) ok = false;
    }
    if (!ok && critical) {
        HI.addMessage(report, "error", "LABEL_WRITE_FAILED", "Critical html_indesign label write failed", details || {});
    }
    return ok;
};

HI.writeProtocolLabel = function (target, label, report, details) {
    try {
        target.insertLabel("html_indesign", HI.stringify(label));
        return true;
    } catch (error) {
        HI.addMessage(report, "warning", "LABEL_WRITE_FAILED", String(error), details || {});
        return false;
    }
};

HI.readProtocolLabel = function (target) {
    try {
        var raw = target.extractLabel("html_indesign");
        if (!raw) return null;
        return HI.parseJson(raw);
    } catch (_) {
        return null;
    }
};
```

Modify `_indesign_scripts/lib/hi_core.jsxinc`:

```js
HI.insertJsonLabel = function (target, key, value, report, details) {
    try {
        target.insertLabel(key, HI.stringify(value));
        return true;
    } catch (error) {
        if (report) HI.addMessage(report, "warning", "JSON_LABEL_WRITE_FAILED", String(error), details || {});
        return false;
    }
};
```

- [ ] **Step 4: Write labels from executor**

Update:

- `HI.prepareDocument`: write `instructions.document.labels` to `doc` with `critical: true`.
- `HI.getPageForInstruction`: write `pageInstruction.labels` to `page` with `critical: true`.
- `HI.applyPageGuides`: write `guide.labels` to each created guide with `critical: false`; keep `html_indesign_guide` compatibility.
- `HI.ensureLayers`: write `layerInstruction.labels` to created or reused layer.
- `HI.ensureStyles`: write style labels after creating paragraph, character, object, frame, table, and cell styles.
- `HI.createTextFrame`, `HI.createGraphicFrame`, `HI.createShapeFrame`, `HI.createLineFrame`, `HI.createTableFrame`: call `HI.writeProtocolLabels(pageItem, item.labels || [], report, { itemId: item.id, critical: true })` before or after compact `pageItem.label`.

Keep compact label:

```js
try { frame.label = HI.itemLabel(item); } catch (_) {}
HI.writeProtocolLabels(frame, item.labels || [], report, { itemId: item.id, critical: true });
```

- [ ] **Step 5: Include `hi_labels.jsxinc` in E2E build script**

Modify `scripts/indesign-e2e.js` `buildBuildJsx` include order:

```js
includeLib("hi_core.jsxinc");
includeLib("hi_labels.jsxinc");
includeLib("hi_document.jsxinc");
```

- [ ] **Step 6: Run executor static tests**

Run:

```powershell
npm test -- test/indesign-executor/executor-script-static.test.js test/indesign-e2e-runner.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add _indesign_scripts/lib/hi_labels.jsxinc _indesign_scripts/lib/hi_core.jsxinc _indesign_scripts/lib/hi_document.jsxinc _indesign_scripts/lib/hi_styles.jsxinc _indesign_scripts/lib/hi_items.jsxinc scripts/indesign-e2e.js test/indesign-executor/executor-script-static.test.js test/indesign-e2e-runner.test.js
git commit -m "feat: write full protocol labels in indesign executor"
```

---

## Task 8: Support Parent Pages and Page Layout Tags in Forward Export

**Files:**
- Modify: `src/semantic-model/from-snapshot.js`
- Modify: `src/semantic-model/to-instructions.js`
- Modify: `_indesign_scripts/lib/hi_document.jsxinc`
- Test: `test/semantic-model/from-snapshot.test.js`
- Test: `test/semantic-model/to-instructions.test.js`
- Test: `test/indesign-executor/executor-script-static.test.js`

- [ ] **Step 1: Write failing tests for parent page instructions**

Add to `test/semantic-model/to-instructions.test.js`:

```js
test('semanticModelToInstructions emits parent pages and page parent references', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'doc', source: 'html-to-indesign' }],
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      semantic: 'report-parent',
      provides: ['guides'],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'report-parent', source: 'html-to-indesign' }],
      items: [],
    }],
    pages: [{
      id: 'p1',
      index: 0,
      width: 100,
      height: 80,
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      layout: 'contents-grid',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      guides: [],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'page', id: 'p1', source: 'html-to-indesign' }],
      items: [],
    }],
    styles: {},
    assets: [],
  };
  const instructions = semanticModelToInstructions(model);
  assert.equal(instructions.document.parentPages[0].id, 'report-parent');
  assert.equal(instructions.pages[0].parentPageId, 'report-parent');
  assert.equal(instructions.pages[0].layout, 'contents-grid');
});
```

- [ ] **Step 2: Run parent page tests and verify failure**

Run:

```powershell
npm test -- test/semantic-model/to-instructions.test.js
```

Expected: FAIL if parent pages are not emitted or page parent references are missing.

- [ ] **Step 3: Preserve parent page metadata in model and instructions**

Ensure `snapshotToSemanticModel` reads:

```js
parentPageId: attrs['data-id-parent-page'] || null,
parentPageName: attrs['data-id-parent-page-name'] || attrs['data-id-parent-page-display-name'] || null,
layout: attrs['data-id-layout'] || null,
```

Ensure `semanticModelToInstructions` emits:

```js
document: {
  parentPages: model.parentPages || [],
  pages: model.pages.map((page) => ({
    id: page.id,
    width: page.width,
    height: page.height,
    parentPageId: page.parentPageId || null,
    parentPageName: page.parentPageName || null,
    layout: page.layout || null,
    margins: page.margins,
    guides: page.guides || [],
    labels: page.labels || [],
  })),
},
pages: model.pages.map((page) => ({
  id: page.id,
  parentPageId: page.parentPageId || null,
  parentPageName: page.parentPageName || null,
  layout: page.layout || null,
  labels: page.labels || [],
  items: ...
})),
```

- [ ] **Step 4: Implement minimal InDesign parent page application**

In `_indesign_scripts/lib/hi_document.jsxinc`, add:

```js
HI.ensureParentPages = function (doc, parentPages, report) {
    var out = {};
    for (var i = 0; i < (parentPages || []).length; i++) {
        var spec = parentPages[i];
        var name = spec.name || spec.id;
        var master = doc.masterSpreads.itemByName(name);
        try { master.name; } catch (_) {
            master = doc.masterSpreads.add();
            try { master.name = name; } catch (nameError) {
                HI.addMessage(report, "warning", "PARENT_PAGE_RENAME_FAILED", String(nameError), { parentPageId: spec.id });
            }
        }
        HI.writeProtocolLabels(master, spec.labels || [], report, { parentPageId: spec.id, critical: true });
        out[spec.id] = master;
    }
    return out;
};

HI.applyParentPage = function (page, pageInstruction, context, report) {
    var id = pageInstruction.parentPageId;
    if (!id || !context.parentPages || !context.parentPages[id]) return;
    try {
        page.appliedMaster = context.parentPages[id];
    } catch (error) {
        HI.addMessage(report, "warning", "PARENT_PAGE_APPLY_FAILED", String(error), { pageId: pageInstruction.id, parentPageId: id });
    }
};
```

In `HI.prepareDocument`, set:

```js
context.parentPages = HI.ensureParentPages(doc, instructions.document && instructions.document.parentPages || [], report);
```

In `HI.getPageForInstruction`, after page retrieval:

```js
HI.applyParentPage(page, pageInstruction, context, report);
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- test/semantic-model/from-snapshot.test.js test/semantic-model/to-instructions.test.js test/indesign-executor/executor-script-static.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/semantic-model/from-snapshot.js src/semantic-model/to-instructions.js _indesign_scripts/lib/hi_document.jsxinc test/semantic-model/from-snapshot.test.js test/semantic-model/to-instructions.test.js test/indesign-executor/executor-script-static.test.js
git commit -m "feat: carry parent page and layout semantics"
```

---

## Task 9: Add InDesign Reverse Snapshot Script

**Files:**
- Create: `_indesign_scripts/export_to_html_snapshot.jsx`
- Create: `_indesign_scripts/lib/hi_reverse.jsxinc`
- Modify: `scripts/indesign-e2e.js`
- Test: `test/indesign-executor/executor-script-static.test.js`

- [ ] **Step 1: Write static tests for reverse snapshot script**

Add to `test/indesign-executor/executor-script-static.test.js`:

```js
test('reverse snapshot script loads reverse and label helpers', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/export_to_html_snapshot.jsx'), 'utf8');
  assert.match(source, /hi_core\.jsxinc/);
  assert.match(source, /hi_labels\.jsxinc/);
  assert.match(source, /hi_reverse\.jsxinc/);
  assert.match(source, /HI\.exportReverseSnapshot/);
});

test('reverse snapshot helper extracts labels, pages, styles, layers and assets', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');
  assert.match(source, /extractLabel\("html_indesign"\)/);
  assert.match(source, /snapshot\.pages/);
  assert.match(source, /snapshot\.styles/);
  assert.match(source, /snapshot\.layers/);
  assert.match(source, /snapshot\.assets/);
});
```

- [ ] **Step 2: Run static tests and verify failure**

Run:

```powershell
npm test -- test/indesign-executor/executor-script-static.test.js
```

Expected: FAIL because reverse scripts do not exist.

- [ ] **Step 3: Implement reverse snapshot helpers**

Create `_indesign_scripts/lib/hi_reverse.jsxinc`:

```js
if (typeof HI === "undefined") { HI = {}; }

HI.exportReverseSnapshot = function (appRef, outputPath) {
    var report = HI.makeReport();
    var doc = appRef.activeDocument;
    var snapshot = {
        metadata: {
            sourceDocument: doc.fullName ? doc.fullName.fsName : String(doc.name || "Untitled"),
            exportedAt: new Date().toISOString(),
            mode: "structured"
        },
        document: HI.reverseDocument(doc),
        parentPages: HI.reverseParentPages(doc),
        layers: HI.reverseLayers(doc),
        styles: HI.reverseStyles(doc),
        assets: HI.reverseAssets(doc),
        pages: HI.reversePages(doc),
        report: report
    };
    HI.writeJsonFile(outputPath, snapshot);
    return { ok: report.ok !== false, outputPath: outputPath, counts: HI.reverseCounts(snapshot), errors: report.errors, warnings: report.warnings };
};

HI.reverseDocument = function (doc) {
    return {
        name: String(doc.name || ""),
        labels: [HI.readProtocolLabel(doc)].filter(function (label) { return !!label; })
    };
};
```

Add helper functions in the same file:

```js
HI.reversePages = function (doc) {
    var out = [];
    var pages = doc.pages.everyItem().getElements();
    for (var i = 0; i < pages.length; i++) {
        out.push(HI.reversePage(pages[i], i));
    }
    return out;
};

HI.reversePage = function (page, index) {
    return {
        id: String(page.name || ("page-" + (index + 1))),
        index: index,
        labels: [HI.readProtocolLabel(page)].filter(function (label) { return !!label; }),
        appliedParentPageName: page.appliedMaster ? String(page.appliedMaster.name || "") : null,
        bounds: HI.pageBounds(page),
        margins: HI.reversePageMargins(page),
        guides: HI.reverseGuides(page),
        items: HI.reversePageItems(page)
    };
};
```

Add these extractors in the same file:

```js
HI.reverseParentPages = function (doc) {
    var out = [];
    var masters = doc.masterSpreads.everyItem().getElements();
    for (var i = 0; i < masters.length; i++) {
        out.push({
            name: String(masters[i].name || ""),
            labels: [HI.readProtocolLabel(masters[i])].filter(function (label) { return !!label; }),
            items: []
        });
    }
    return out;
};

HI.pageBounds = function (page) {
    var b = page.bounds;
    return { x: Number(b[1] || 0), y: Number(b[0] || 0), width: Number(b[3] - b[1]), height: Number(b[2] - b[0]) };
};

HI.reversePageMargins = function (page) {
    var prefs = page.marginPreferences;
    return { top: Number(prefs.top || 0), right: Number(prefs.right || 0), bottom: Number(prefs.bottom || 0), left: Number(prefs.left || 0) };
};

HI.reversePageItems = function (page) {
    var out = [];
    var items = page.pageItems.everyItem().getElements();
    for (var i = 0; i < items.length; i++) {
        out.push(HI.reversePageItem(items[i], i));
    }
    return out;
};

HI.reversePageItem = function (item, index) {
    return {
        id: String(item.id || ("item-" + (index + 1))),
        type: String(item.constructor && item.constructor.name || item.constructor || ""),
        bounds: HI.itemBounds(item),
        layerName: item.itemLayer ? String(item.itemLayer.name || "") : "",
        paragraphStyleName: HI.appliedParagraphStyleName(item),
        objectStyleName: item.appliedObjectStyle ? String(item.appliedObjectStyle.name || "") : "",
        text: HI.itemText(item),
        label: String(item.label || ""),
        labels: [HI.readProtocolLabel(item)].filter(function (label) { return !!label; })
    };
};

HI.itemBounds = function (item) {
    var b = item.geometricBounds;
    return { x: Number(b[1] || 0), y: Number(b[0] || 0), width: Number(b[3] - b[1]), height: Number(b[2] - b[0]) };
};

HI.itemText = function (item) {
    try { return String(item.contents || ""); } catch (_) { return ""; }
};

HI.appliedParagraphStyleName = function (item) {
    try { return String(item.paragraphs[0].appliedParagraphStyle.name || ""); } catch (_) { return ""; }
};

HI.reverseCounts = function (snapshot) {
    var itemCount = 0;
    for (var i = 0; i < (snapshot.pages || []).length; i++) itemCount += (snapshot.pages[i].items || []).length;
    return { pages: (snapshot.pages || []).length, items: itemCount, assets: (snapshot.assets || []).length };
};

HI.reverseLayers = function (doc) {
    var out = [];
    var layers = doc.layers.everyItem().getElements();
    for (var i = 0; i < layers.length; i++) {
        out.push({ name: String(layers[i].name || ""), index: i, labels: [HI.readProtocolLabel(layers[i])].filter(function (label) { return !!label; }) });
    }
    return out;
};

HI.reverseAssets = function (doc) {
    var out = [];
    var links = doc.links.everyItem().getElements();
    for (var i = 0; i < links.length; i++) {
        out.push({ name: String(links[i].name || ""), path: links[i].filePath ? String(links[i].filePath) : "", status: String(links[i].status || "") });
    }
    return out;
};

HI.reverseGuides = function (page) {
    var out = [];
    var guides = page.guides.everyItem().getElements();
    for (var i = 0; i < guides.length; i++) {
        out.push({
            orientation: guides[i].orientation === HorizontalOrVertical.VERTICAL ? "vertical" : "horizontal",
            position: Number(guides[i].location || 0),
            labels: [HI.readProtocolLabel(guides[i])].filter(function (label) { return !!label; })
        });
    }
    return out;
};

HI.reverseStyles = function (doc) {
    return {
        paragraphStyles: HI.reverseStyleCollection(doc.paragraphStyles),
        characterStyles: HI.reverseStyleCollection(doc.characterStyles),
        objectStyles: HI.reverseStyleCollection(doc.objectStyles),
        tableStyles: HI.reverseStyleCollection(doc.tableStyles),
        cellStyles: HI.reverseStyleCollection(doc.cellStyles)
    };
};

HI.reverseStyleCollection = function (collection) {
    var out = [];
    var items = collection.everyItem().getElements();
    for (var i = 0; i < items.length; i++) {
        out.push({ name: String(items[i].name || ""), labels: [HI.readProtocolLabel(items[i])].filter(function (label) { return !!label; }) });
    }
    return out;
};
```

Create `_indesign_scripts/export_to_html_snapshot.jsx`:

```js
(function () {
    var base = File($.fileName).parent.parent.fsName.replace(/\\/g, "/");
    function includeLib(name) {
        var lib = File(base + "/_indesign_scripts/lib/" + name);
        if (!lib.exists) throw new Error("Missing reverse lib: " + lib.fsName);
        $.evalFile(lib);
    }

    includeLib("hi_core.jsxinc");
    includeLib("hi_labels.jsxinc");
    includeLib("hi_reverse.jsxinc");

    var outputPath = app.extractLabel("html_indesign_reverse_output");
    if (!outputPath) outputPath = base + "/test/workspace/reverse-snapshot.json";
    return JSON.stringify(HI.exportReverseSnapshot(app, outputPath));
})();
```

Add `HI.writeJsonFile` to `hi_core.jsxinc`:

```js
HI.writeJsonFile = function (jsonPath, value) {
    var file = File(jsonPath);
    file.parent.create();
    file.encoding = "UTF-8";
    if (!file.open("w")) throw new Error("Cannot write JSON file: " + file.fsName);
    file.write(HI.stringify(value));
    file.close();
    return file.fsName;
};
```

- [ ] **Step 4: Run static tests**

Run:

```powershell
npm test -- test/indesign-executor/executor-script-static.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add _indesign_scripts/export_to_html_snapshot.jsx _indesign_scripts/lib/hi_reverse.jsxinc _indesign_scripts/lib/hi_core.jsxinc test/indesign-executor/executor-script-static.test.js
git commit -m "feat: add indesign reverse snapshot script"
```

---

## Task 10: Convert Reverse Snapshot To Semantic Model

**Files:**
- Create: `src/indesign-reverse/index.js`
- Create: `src/indesign-reverse/snapshot-reader.js`
- Create: `src/indesign-reverse/reverse-model.js`
- Create: `src/indesign-reverse/report.js`
- Create: `test/fixtures/indesign-reverse/tagged-snapshot.json`
- Test: `test/indesign-reverse/reverse-model.test.js`

- [ ] **Step 1: Add tagged reverse snapshot fixture**

Create `test/fixtures/indesign-reverse/tagged-snapshot.json`:

```json
{
  "metadata": {
    "sourceDocument": "architecture-report.indd",
    "exportedAt": "2026-05-25T00:00:00Z",
    "mode": "structured"
  },
  "document": {
    "name": "architecture-report.indd",
    "labels": [
      {
        "protocol": "html-indesign",
        "version": 1,
        "kind": "document",
        "id": "architecture-report",
        "source": "html-to-indesign",
        "unitMode": "presentation",
        "coordinateUnit": "pt"
      }
    ]
  },
  "parentPages": [
    {
      "name": "汇报母版",
      "labels": [
        {
          "protocol": "html-indesign",
          "version": 1,
          "kind": "parentPage",
          "id": "report-parent",
          "source": "html-to-indesign",
          "name": "汇报母版"
        }
      ],
      "items": []
    }
  ],
  "layers": [
    {
      "name": "文字",
      "labels": [
        {
          "protocol": "html-indesign",
          "version": 1,
          "kind": "layer",
          "id": "layer-text",
          "source": "html-to-indesign",
          "token": "text",
          "displayName": "文字"
        }
      ]
    }
  ],
  "styles": {
    "paragraphStyles": [
      {
        "name": "页面标题",
        "labels": [
          {
            "protocol": "html-indesign",
            "version": 1,
            "kind": "style",
            "id": "style-page-title",
            "source": "html-to-indesign",
            "styleKind": "paragraph",
            "token": "page-title",
            "displayName": "页面标题",
            "htmlClass": "page-title"
          }
        ]
      }
    ],
    "characterStyles": [],
    "objectStyles": [],
    "frameStyles": [],
    "tableStyles": [],
    "cellStyles": []
  },
  "assets": [],
  "pages": [
    {
      "id": "1",
      "index": 0,
      "labels": [
        {
          "protocol": "html-indesign",
          "version": 1,
          "kind": "page",
          "id": "agenda-page",
          "source": "html-to-indesign",
          "semantic": "agenda",
          "parentPageId": "report-parent",
          "parentPageName": "汇报母版",
          "layout": "contents-grid",
          "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 }
        }
      ],
      "bounds": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
      "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 },
      "guides": [],
      "items": [
        {
          "id": "agenda-title",
          "type": "TextFrame",
          "bounds": { "x": 120, "y": 140, "width": 460, "height": 80 },
          "text": "汇报结构",
          "layerName": "文字",
          "paragraphStyleName": "页面标题",
          "labels": [
            {
              "protocol": "html-indesign",
              "version": 1,
              "kind": "item",
              "id": "agenda-title",
              "source": "html-to-indesign",
              "role": "text",
              "semantic": "page-title",
              "htmlTag": "h2",
              "className": "page-title"
            }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write failing reverse model tests**

Create `test/indesign-reverse/reverse-model.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel } = require('../../src/indesign-reverse');

test('reverseSnapshotToSemanticModel restores tagged InDesign as DocumentModel', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.id, 'architecture-report');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.parentPages[0].id, 'report-parent');
  assert.equal(model.layers[0].token, 'text');
  assert.equal(model.pages[0].id, 'agenda-page');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.equal(model.pages[0].items[0].semantic, 'page-title');
});
```

- [ ] **Step 3: Run reverse model test and verify failure**

Run:

```powershell
npm test -- test/indesign-reverse/reverse-model.test.js
```

Expected: FAIL because `src/indesign-reverse` does not exist.

- [ ] **Step 4: Implement snapshot reader and reverse model compiler**

Create `src/indesign-reverse/snapshot-reader.js`:

```js
const fs = require('fs');
const path = require('path');

function readReverseSnapshot(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

module.exports = {
  readReverseSnapshot,
};
```

Create `src/indesign-reverse/reverse-model.js`:

```js
function reverseSnapshotToSemanticModel(snapshot, options = {}) {
  const documentLabel = firstLabel(snapshot.document && snapshot.document.labels, 'document') || {};
  const pages = (snapshot.pages || []).map((page) => reversePage(page, documentLabel));
  return {
    kind: 'DocumentModel',
    id: documentLabel.id || 'indesign-document',
    title: snapshot.document && snapshot.document.name || documentLabel.id || 'indesign-document',
    source: snapshot.metadata && snapshot.metadata.sourceDocument,
    unitMode: documentLabel.unitMode || 'presentation',
    coordinateUnit: documentLabel.coordinateUnit || 'pt',
    labels: snapshot.document && snapshot.document.labels || [],
    parentPages: (snapshot.parentPages || []).map(reverseParentPage),
    pages,
    layers: (snapshot.layers || []).map(reverseLayer),
    styles: reverseStyles(snapshot.styles || {}),
    assets: snapshot.assets || [],
    warnings: [],
    report: null,
    reverseMode: options.mode || snapshot.metadata && snapshot.metadata.mode || 'structured',
  };
}

function reversePage(page) {
  const label = firstLabel(page.labels, 'page') || {};
  return {
    id: label.id || page.id,
    index: page.index,
    semantic: label.semantic || null,
    parentPageId: label.parentPageId || null,
    parentPageName: label.parentPageName || page.appliedParentPageName || null,
    layout: label.layout || null,
    width: page.bounds && page.bounds.width,
    height: page.bounds && page.bounds.height,
    margins: label.margins || page.margins || null,
    guides: page.guides || [],
    labels: page.labels || [],
    items: (page.items || []).map(reverseItem),
  };
}

function reverseItem(item) {
  const label = firstLabel(item.labels, 'item') || {};
  return {
    id: label.id || item.id,
    role: label.role || roleFromInDesignType(item.type),
    semantic: label.semantic || 'unknown',
    tagName: label.htmlTag || htmlTagForRole(label.role || roleFromInDesignType(item.type)),
    htmlClass: label.className || null,
    bounds: item.bounds,
    layerName: item.layerName || null,
    styleRefs: {
      paragraphStyle: item.paragraphStyleName || null,
      objectStyle: item.objectStyleName || null,
      frameStyle: item.frameStyleName || null,
    },
    content: { text: item.text || '' },
    labels: item.labels || [],
  };
}

function firstLabel(labels, kind) {
  return (labels || []).find((label) => label && label.kind === kind) || null;
}

function reverseParentPage(parentPage) {
  const label = firstLabel(parentPage.labels, 'parentPage') || {};
  return {
    id: label.id || parentPage.name,
    name: label.name || parentPage.name,
    semantic: label.semantic || label.id || parentPage.name,
    provides: label.provides || [],
    labels: parentPage.labels || [],
    items: (parentPage.items || []).map(reverseItem),
  };
}

function reverseLayer(layer) {
  const label = firstLabel(layer.labels, 'layer') || {};
  return {
    token: label.token || layer.name,
    displayName: label.displayName || layer.name,
    name: layer.name,
    labels: layer.labels || [],
  };
}

function reverseStyles(styles) {
  return {
    paragraphStyles: reverseStyleCollection(styles.paragraphStyles || []),
    characterStyles: reverseStyleCollection(styles.characterStyles || []),
    objectStyles: reverseStyleCollection(styles.objectStyles || []),
    frameStyles: reverseStyleCollection(styles.frameStyles || []),
    tableStyles: reverseStyleCollection(styles.tableStyles || []),
    cellStyles: reverseStyleCollection(styles.cellStyles || []),
  };
}

function reverseStyleCollection(items) {
  const out = {};
  for (const item of items || []) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || item.name;
    out[token] = {
      name: label.displayName || item.name,
      token,
      displayName: label.displayName || item.name,
      labels: item.labels || [],
    };
  }
  return out;
}

function roleFromInDesignType(type) {
  const raw = String(type || '').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('table')) return 'table';
  if (raw.includes('line')) return 'line';
  if (raw.includes('rectangle') || raw.includes('oval') || raw.includes('polygon')) return 'shape';
  return 'graphic';
}

function htmlTagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'graphic') return 'figure';
  if (role === 'table') return 'table';
  return 'div';
}
```

Create `src/indesign-reverse/index.js`:

```js
const { readReverseSnapshot } = require('./snapshot-reader');
const { reverseSnapshotToSemanticModel } = require('./reverse-model');

module.exports = {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
};
```

- [ ] **Step 5: Run reverse model tests**

Run:

```powershell
npm test -- test/indesign-reverse/reverse-model.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/indesign-reverse test/fixtures/indesign-reverse/tagged-snapshot.json test/indesign-reverse/reverse-model.test.js
git commit -m "feat: convert indesign reverse snapshot to semantic model"
```

---

## Task 11: Write Fixed Semantic HTML From Semantic Model

**Files:**
- Create: `src/indesign-reverse/html-writer.js`
- Modify: `src/indesign-reverse/index.js`
- Test: `test/indesign-reverse/html-writer.test.js`

- [ ] **Step 1: Write failing HTML writer tests**

Create `test/indesign-reverse/html-writer.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel, semanticModelToHtml } = require('../../src/indesign-reverse');

test('semanticModelToHtml writes page, parent page, layout and text item tags', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  const html = semanticModelToHtml(model);

  assert.match(html, /<main class="deck"/);
  assert.match(html, /data-id-document="architecture-report"/);
  assert.match(html, /data-page="agenda-page"/);
  assert.match(html, /data-id-parent-page="report-parent"/);
  assert.match(html, /data-id-parent-page-name="汇报母版"/);
  assert.match(html, /data-id-layout="contents-grid"/);
  assert.match(html, /<h2[^>]+agenda-title/);
  assert.match(html, /汇报结构/);
});
```

- [ ] **Step 2: Run HTML writer test and verify failure**

Run:

```powershell
npm test -- test/indesign-reverse/html-writer.test.js
```

Expected: FAIL because `semanticModelToHtml` is not exported.

- [ ] **Step 3: Implement semanticModelToHtml**

Create `src/indesign-reverse/html-writer.js`:

```js
function semanticModelToHtml(model, options = {}) {
  const pages = (model.pages || []).map(pageToHtml).join('\n');
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${escapeHtml(model.title || model.id || 'InDesign Export')}</title>`,
    '  <style>',
    baseCss(model),
    '  </style>',
    '</head>',
    '<body>',
    `<main class="deck" data-id-document="${attr(model.id)}" data-id-profile="${attr(model.profile || '')}">`,
    pages,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function pageToHtml(page) {
  const attrs = [
    'class="page"',
    `id="${attr(page.id)}"`,
    `data-page="${attr(page.id)}"`,
    page.semantic ? `data-id-semantic="${attr(page.semantic)}"` : '',
    page.parentPageId ? `data-id-parent-page="${attr(page.parentPageId)}"` : '',
    page.parentPageName ? `data-id-parent-page-name="${attr(page.parentPageName)}"` : '',
    page.layout ? `data-id-layout="${attr(page.layout)}"` : '',
    page.margins ? `data-id-margin="${attr(marginValue(page.margins))}"` : '',
  ].filter(Boolean).join(' ');
  const items = (page.items || []).map(itemToHtml).join('\n');
  return `  <section ${attrs}>\n${items}\n  </section>`;
}

function itemToHtml(item) {
  const tag = item.tagName || htmlTagForRole(item.role);
  const text = item.content && item.content.text ? escapeHtml(item.content.text) : '';
  const classes = item.htmlClass || item.semantic || item.role;
  const style = item.bounds ? ` style="${attr(boundsStyle(item.bounds))}"` : '';
  return `    <${tag} id="${attr(item.id)}" class="${attr(classes)}" data-id-object data-id-semantic="${attr(item.semantic || 'unknown')}" data-id-role="${attr(item.role)}"${style}>${text}</${tag}>`;
}
```

Implement helpers in the same file:

```js
function baseCss(model) {
  const first = model.pages && model.pages[0];
  const width = first && first.width ? `${first.width}px` : '1920px';
  const height = first && first.height ? `${first.height}px` : '1080px';
  return [
    '    body { margin: 0; background: #e5e5e5; font-family: Arial, sans-serif; }',
    `    .page { position: relative; width: ${width}; height: ${height}; overflow: hidden; background: #fff; margin: 0 auto 40px; }`,
    '    [data-id-object] { position: absolute; box-sizing: border-box; }',
  ].join('\n');
}

function boundsStyle(bounds) {
  return `left:${num(bounds.x)}px;top:${num(bounds.y)}px;width:${num(bounds.width)}px;height:${num(bounds.height)}px`;
}

function marginValue(margins) {
  return `${num(margins.top)}px ${num(margins.right)}px ${num(margins.bottom)}px ${num(margins.left)}px`;
}

function htmlTagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'graphic') return 'figure';
  if (role === 'table') return 'table';
  return 'div';
}

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
```

Export from `src/indesign-reverse/index.js`.

- [ ] **Step 4: Run HTML writer tests**

Run:

```powershell
npm test -- test/indesign-reverse/html-writer.test.js test/indesign-reverse/reverse-model.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/indesign-reverse/html-writer.js src/indesign-reverse/index.js test/indesign-reverse/html-writer.test.js
git commit -m "feat: write semantic html from reverse model"
```

---

## Task 12: Add Reverse Export CLI and Public API

**Files:**
- Create: `scripts/indesign-reverse-export.js`
- Modify: `index.js`
- Modify: `package.json`
- Test: `test/indesign-reverse/cli.test.js`
- Test: `test/public-api.test.js`

- [ ] **Step 1: Write failing CLI and API tests**

Create `test/indesign-reverse/cli.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseArgs,
  compileReverseSnapshotToHtml,
} = require('../../scripts/indesign-reverse-export');

test('parseArgs accepts mode, snapshot and out dir', () => {
  const args = parseArgs(['--mode', 'structured', '--snapshot', 'reverse.json', '--out', 'out-dir']);
  assert.equal(args.mode, 'structured');
  assert.equal(args.snapshotPath, 'reverse.json');
  assert.equal(args.outDir, 'out-dir');
});

test('compileReverseSnapshotToHtml writes deck, model and report', () => {
  const outDir = path.resolve('test/workspace/reverse-cli-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
  });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'reverse-model.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'report.json')), true);
});
```

Add to `test/public-api.test.js`:

```js
assert.equal(typeof api.semanticModel.snapshotToSemanticModel, 'function');
assert.equal(typeof api.semanticModel.semanticModelToInstructions, 'function');
assert.equal(typeof api.indesignReverse.reverseSnapshotToSemanticModel, 'function');
assert.equal(typeof api.indesignReverse.semanticModelToHtml, 'function');
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- test/indesign-reverse/cli.test.js test/public-api.test.js
```

Expected: FAIL because CLI and root exports are missing.

- [ ] **Step 3: Implement reverse CLI**

Create `scripts/indesign-reverse-export.js`:

```js
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  semanticModelToHtml,
} = require('../src/indesign-reverse');

function parseArgs(argv) {
  const out = { mode: 'structured', snapshotPath: null, outDir: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--mode') out.mode = argv[++index];
    else if (arg.startsWith('--mode=')) out.mode = arg.slice('--mode='.length);
    else if (arg === '--snapshot') out.snapshotPath = argv[++index];
    else if (arg.startsWith('--snapshot=')) out.snapshotPath = arg.slice('--snapshot='.length);
    else if (arg === '--out') out.outDir = argv[++index];
    else if (arg.startsWith('--out=')) out.outDir = arg.slice('--out='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function compileReverseSnapshotToHtml(options) {
  const snapshot = readReverseSnapshot(options.snapshotPath);
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: options.mode });
  const html = semanticModelToHtml(model);
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.html'), html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'reverse-model.json'), JSON.stringify(model, null, 2), 'utf8');
  const report = { ok: true, mode: options.mode, pages: model.pages.length, unresolved: [] };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  return { ok: true, outDir, report };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.snapshotPath || !options.outDir) {
    console.log('Usage: node scripts/indesign-reverse-export.js --snapshot <reverse-snapshot.json> --out <dir> [--mode structured]');
    process.exit(options.help ? 0 : 1);
  }
  const result = compileReverseSnapshotToHtml(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  compileReverseSnapshotToHtml,
};
```

Modify `package.json`:

```json
"reverse:indesign": "node scripts/indesign-reverse-export.js"
```

Modify `index.js`:

```js
const pagedHtml = require('./src/paged-html');
const legacyTemplate = require('./src/legacy-template');
const semanticModel = require('./src/semantic-model');
const indesignReverse = require('./src/indesign-reverse');

module.exports = {
  pagedHtml,
  semanticModel,
  indesignReverse,
  legacyTemplate,
};
```

- [ ] **Step 4: Run CLI and API tests**

Run:

```powershell
npm test -- test/indesign-reverse/cli.test.js test/public-api.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/indesign-reverse-export.js package.json index.js test/indesign-reverse/cli.test.js test/public-api.test.js
git commit -m "feat: expose indesign reverse export api"
```

---

## Task 13: Add HTML -> InDesign -> HTML Round-Trip Verification

**Files:**
- Modify: `scripts/indesign-e2e.js`
- Test: `test/indesign-e2e-runner.test.js`
- Test: `test/e2e-fixtures/architecture-report-fixture.test.js`

- [ ] **Step 1: Write failing tests for round-trip options**

Add to `test/indesign-e2e-runner.test.js`:

```js
test('parseArgs accepts reverse roundtrip flag', () => {
  const options = parseArgs(['--reverse-roundtrip', '--target-size=qhd'], 'D:/AI/html-indesign');
  assert.equal(options.reverseRoundtrip, true);
  assert.equal(options.targetSize, 'qhd');
});

test('build reverse snapshot jsx writes target output label and runs reverse script', () => {
  const { buildReverseSnapshotJsx } = require('../scripts/indesign-e2e');
  const jsx = buildReverseSnapshotJsx({
    repoRoot: 'D:/AI/html-indesign',
    outputPath: 'D:/AI/html-indesign/test/workspace/reverse-snapshot.json',
  });
  assert.match(jsx, /html_indesign_reverse_output/);
  assert.match(jsx, /export_to_html_snapshot\.jsx/);
});
```

- [ ] **Step 2: Run E2E runner tests and verify failure**

Run:

```powershell
npm test -- test/indesign-e2e-runner.test.js
```

Expected: FAIL because `--reverse-roundtrip` and `buildReverseSnapshotJsx` are missing.

- [ ] **Step 3: Add optional reverse round-trip in E2E runner**

In `scripts/indesign-e2e.js`:

- Parse `--reverse-roundtrip`.
- Add paths to `createRunContext`:

```js
reverseSnapshotPath: path.join(runDir, 'reverse-snapshot.json'),
reverseOutDir: path.join(runDir, 'reverse-html'),
reverseScriptPath: path.join(runDir, 'reverse-snapshot.jsx'),
```

- Export `buildReverseSnapshotJsx`.

Implementation:

```js
function buildReverseSnapshotJsx({ repoRoot, outputPath }) {
  const base = toJsxPath(repoRoot);
  const output = toJsxPath(outputPath);
  return `(function () {
    app.insertLabel("html_indesign_reverse_output", ${JSON.stringify(output)});
    $.evalFile(File(${JSON.stringify(base + "/_indesign_scripts/export_to_html_snapshot.jsx")}));
    app.insertLabel("html_indesign_reverse_output", "");
    return JSON.stringify({ ok: true, outputPath: ${JSON.stringify(output)} });
})();`;
}
```

After build and export verification, if `options.reverseRoundtrip`:

```js
const reverse = await runReverseRoundtrip(context);
result.reverse = reverse;
```

Implement:

```js
async function runReverseRoundtrip(context) {
  fs.writeFileSync(context.reverseScriptPath, buildReverseSnapshotJsx({
    repoRoot: context.repoRoot,
    outputPath: context.reverseSnapshotPath,
  }), 'utf8');
  const reverseCli = runCli(['--json', '--pretty', 'script', 'run', context.reverseScriptPath], context.repoRoot);
  const reverseResult = parseCliResultJson(reverseCli.stdout);
  assertCliResultOk(reverseResult, 'InDesign reverse snapshot failed');
  const { compileReverseSnapshotToHtml } = require('./indesign-reverse-export');
  const htmlResult = compileReverseSnapshotToHtml({
    snapshotPath: context.reverseSnapshotPath,
    outDir: context.reverseOutDir,
    mode: 'structured',
  });
  return { snapshot: reverseResult, html: htmlResult };
}
```

- [ ] **Step 4: Run runner tests**

Run:

```powershell
npm test -- test/indesign-e2e-runner.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/indesign-e2e.js test/indesign-e2e-runner.test.js
git commit -m "feat: add optional indesign reverse roundtrip verification"
```

---

## Task 14: Real InDesign E2E For Current Architecture

**Files:**
- Modify: `test/indesign-e2e-runner.test.js`
- Modify: `docs/README.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Run unit test suite**

Run:

```powershell
npm test
```

Expected: PASS with all `node:test` tests passing.

Actual 2026-05-25: PASS, 159 tests.

- [x] **Step 2: Run authoring lint on architecture fixture**

Run:

```powershell
npm run lint:authoring -- -- --html test/fixtures/e2e/architecture-report/deck.html --strict
```

Expected: PASS. If this fails because current fixture intentionally violates a rule, fix the fixture or lower the failing rule only with a clear report entry and a test.

Actual 2026-05-25: PASS, 0 errors, 0 warnings.

- [x] **Step 3: Run real InDesign E2E with reverse roundtrip**

Run:

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip --target-size qhd
```

Expected:

- Build succeeds.
- PDF verification succeeds.
- `runDir/reverse-snapshot.json` exists.
- `runDir/reverse-html/deck.html` exists.
- `runDir/reverse-html/reverse-model.json` exists.
- `result.reverse.html.ok` is `true`.

Actual 2026-05-25: PASS with `INDESIGN_CLI_BIN` pointing to local `indesign-cli.exe`; run dir `test/workspace/indesign-e2e-20260525-220653`. E2E runner now fails if reverse HTML misses required bidirectional tags; verified counts are 7 `data-id-parent-page`, 7 `data-id-layout`, and 136 `data-id-semantic` attributes.

- [x] **Step 4: Update docs with exact commands**

Update `AGENTS.md` execution baseline:

```markdown
| 真实 InDesign E2E + 回读 | `npm run e2e:indesign -- -- --reverse-roundtrip` |
```

Update `docs/README.md` or `docs/规范/README.md` only if a new permanent command or document path was added.

Actual 2026-05-25: `AGENTS.md` and command references were updated in commit `686b91e`.

- [x] **Step 5: Commit**

```powershell
git add scripts/indesign-e2e.js AGENTS.md docs/README.md docs/规范/README.md
git commit -m "test: verify bidirectional indesign roundtrip"
```

Actual 2026-05-25: committed after the verified fixture, E2E runner audit, and plan progress updates were staged.

---

## Task 15: Final Regression and Architecture Audit

**Files:**
- Modify only if verification exposes a concrete bug.

- [x] **Step 1: Run full tests**

Run:

```powershell
npm test
```

Expected: PASS.

Actual 2026-05-25: PASS, 159 tests.

- [x] **Step 2: Run strict authoring lint**

Run:

```powershell
npm run lint:authoring -- -- --html test/fixtures/e2e/architecture-report/deck.html --strict
```

Expected: PASS.

Actual 2026-05-25: PASS, 0 errors, 0 warnings.

- [x] **Step 3: Run real InDesign E2E**

Run:

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip --target-size qhd
```

Expected: PASS and produce INDD, PDF, IDML, reverse snapshot, reverse HTML, reverse model, and report under `test/workspace/indesign-e2e-<timestamp>/`.

Actual 2026-05-25: PASS with `INDESIGN_CLI_BIN` pointing to local `indesign-cli.exe`; run dir `test/workspace/indesign-e2e-20260525-220945`.

- [x] **Step 4: Inspect output report**

Open `test/workspace/indesign-e2e-<timestamp>/e2e-result.json` and verify:

```json
{
  "ok": true,
  "reverse": {
    "html": {
      "ok": true
    }
  }
}
```

Also verify:

- `compile.styleCounts` has non-zero paragraph/object/frame style counts for architecture fixture.
- `export.audit.panelAsciiNames` is empty except allowed built-in swatches.
- `reverse-html/deck.html` contains `data-page`, `data-id-parent-page`, `data-id-layout`, and item `data-id-semantic`.

Actual 2026-05-25: PASS. `e2e-result.json` has `ok: true`, reverse snapshot/html ok, reverse HTML audit counts `{ dataPage: 7, parentPage: 7, layout: 7, semantic: 136 }`, no panel ASCII names, 0 overset text frames, and non-zero paragraph/object/frame style counts.

- [x] **Step 5: Commit final verification docs if changed**

If no files changed, do not create an empty commit. If docs or tests changed:

```powershell
git add AGENTS.md docs test scripts src _indesign_scripts package.json index.js
git commit -m "chore: finalize bidirectional architecture baseline"
```

Actual 2026-05-25: committed this final verification record.

---

## Task 16: Merge Legacy Blueprint Reverse Input

**Files:**
- Add: `src/indesign-reverse/legacy-blueprint.js`
- Modify: `src/indesign-reverse/index.js`
- Modify: `src/indesign-reverse/html-writer.js`
- Modify: `scripts/indesign-reverse-export.js`
- Test: `test/indesign-reverse/legacy-blueprint.test.js`
- Test: `test/indesign-reverse/cli.test.js`

- [x] **Step 1: Write failing tests for legacy blueprint reverse input**

Added tests requiring:

- `legacyBlueprintToSemanticModel(blueprint, { mode: 'inferred' })`.
- Legacy slot labels parsed into `slotName`, `slotType`, confidence and evidence.
- Legacy paragraph/object CSS merged into the HTML writer output.
- Placed image/PDF paths and crop state preserved as item asset metadata.
- CLI `--blueprint <blueprint.json>` support.

Actual 2026-05-25: RED confirmed. Tests failed because the function/export and CLI flag did not exist.

- [x] **Step 2: Implement `legacy-blueprint` adapter inside `indesign-reverse`**

Implemented a new adapter that maps old blueprint masters into `DocumentModel.pages`, preserves legacy styles, emits assets, and marks all items with `source: "legacy-blueprint"`.

The adapter rejects `authoring` mode because old blueprint lacks source DOM structure labels. It supports `observation` and `inferred` as open-system reverse modes.

- [x] **Step 3: Extend reverse HTML writer for inferred/observation metadata**

Added writer support for:

- `data-id-reverse-mode`.
- `data-id-source="legacy-blueprint"`.
- `data-id-legacy-slot`, `data-id-slot-name`, `data-id-slot-type`.
- `data-id-confidence`.
- `data-id-asset-path` and `data-id-image-cropped`.
- Legacy inline visual CSS appended after geometry styles.

- [x] **Step 4: Add CLI blueprint input**

Added:

```powershell
node scripts/indesign-reverse-export.js --blueprint test/artifacts/blueprint.json --mode inferred --out test/workspace/reverse-blueprint-cli-test
```

CLI now writes `deck.html`, `deck.<mode>.html`, `reverse-model.json`, `report.json`, and `<mode>-report.json`.

- [x] **Step 5: Verify**

Run:

```powershell
npm test -- test/indesign-reverse/legacy-blueprint.test.js test/indesign-reverse/cli.test.js
```

Actual 2026-05-25: PASS. Because the npm script currently includes `test/**/*.test.js`, this command executed the full suite; 163 tests passed.

---

## Self-Review

### Spec Coverage

- 统一语义模型：Tasks 2-5。
- 现有 HTML -> InDesign 功能保持：Tasks 4, 6, 14, 15。
- 完整 `html_indesign` 标签：Tasks 1, 6, 7。
- InDesign -> HTML structured 回读：Tasks 9-13。
- 母版和页面结构模板互导：Task 8 and Task 11。
- legacy blueprint 归并：Task 16 moves blueprint input into `indesign-reverse` through a dedicated adapter, while old builder/generator behavior remains isolated under `legacyTemplate`.
- 真实验证：Tasks 14-15。

### Placeholder Scan

This plan intentionally avoids unresolved markers. Every task names concrete files, commands, expected results, and code entry points.

### Type Consistency

The plan consistently uses:

- `snapshotToSemanticModel(snapshot, options)`
- `semanticModelToInstructions(model, options)`
- `validateSemanticModel(model)`
- `readReverseSnapshot(filePath)`
- `reverseSnapshotToSemanticModel(snapshot, options)`
- `legacyBlueprintToSemanticModel(blueprint, options)`
- `semanticModelToHtml(model, options)`
- `createProtocolLabel(input)`
- `parseProtocolLabel(raw, options)`

The plan consistently separates:

- `data-page`: HTML page container marker.
- `data-id-pdf-page`: PDF placed asset page number.
- `parentPageId`: stable InDesign parent page ID.
- `parentPageName`: InDesign panel display name.
- `layout`: HTML/Agent page structure template token.
