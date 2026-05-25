# 正向来源标签与反向作者源码包闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让作者源码包生成的 InDesign 携带足够来源标签，并让 InDesign 反向导出时自动拆成视觉对照 HTML 和可继续编辑的作者源码包。

**Architecture:** 前向链路继续消费组装后的 `deck.html`，但在 browser snapshot、semantic model 和 instructions 中保留 `sourcePackage/sourceFile/sourceNode/structure/layout.grid` 等来源事实，再由现有 ExtendScript 标签写入能力写进 InDesign。反向链路新增独立 `author-package-writer`，从 reverse model 写出 `author/` 源码包；现有 `html-writer.js` 保持视觉对照职责，不再承担长期源码输出。

**Tech Stack:** Node.js CommonJS、现有 `src/authoring` 组装器、现有 `src/paged-html` 快照和编译层、现有 `src/indesign-reverse` 反向模型、现有 ExtendScript executor、`node --test`、真实 `indesign-cli` E2E。

---

## Scope

本计划实现：

- 正向 `deck.html` 里嵌入源码包入口信息。
- browser snapshot 捕获页面来源文件、对象 DOM 来源、网格变量和对象结构顺序。
- semantic model 和 instructions 保留并写入完整 `html_indesign` 来源标签。
- reverse snapshot 读回这些标签后，reverse model 保留来源字段。
- 反向导出同时写出：
  - `deck.visual.html`：视觉对照文件。
  - `author/`：自动拆分的作者源码包。
- 带完整标签的输入优先按原 `sourceFile` 拆页。
- 无标签或弱标签输入也必须按页面自动拆成低语义源码包，不能只输出一个超大 HTML。
- `npm run e2e:indesign -- -- --reverse-roundtrip` 审核反向源码包是否存在、可组装、页面数正确。

本计划不实现：

- 不把完整原始 CSS 文本塞进 InDesign 标签；反向源码包生成规范化 CSS。
- 不做复杂“从对象边缘反推瑞士网格”的高级推断；低置信度对象落入 `reverse-overrides.css`。
- 不把页面结构模板自动转成 InDesign 母版。
- 不重写旧 `extract_blueprint.jsx` 或旧 UI 预览工具。

## File Structure

新增：

| 文件 | 责任 |
| ---- | ---- |
| `src/paged-html/source-metadata.js` | 从 HTML 快照对象提取源码包、源码文件、DOM 节点、网格变量和结构字段 |
| `src/indesign-reverse/author-package-writer.js` | 从 reverse model 写出 `author/` 源码包 |
| `src/indesign-reverse/author-css-writer.js` | 把 reverse model 中的 token、布局、组件样式和兜底样式拆成 CSS 文件 |
| `test/paged-html/source-metadata.test.js` | 来源事实捕获与语义模型标签测试 |
| `test/indesign-reverse/author-package-writer.test.js` | 反向源码包拆分和组装测试 |

修改：

| 文件 | 责任 |
| ---- | ---- |
| `src/authoring/source-package.js` | 在生成的 `deck.html` 中写入源码包配置入口属性 |
| `src/paged-html/browser-snapshot.js` | 捕获 `data-id-source-package-config`、页面 `data-id-source-file`、对象 `sourceNode` 和 CSS 网格变量 |
| `src/semantic-model/from-snapshot.js` | 把来源事实写入 document/page/item 标签 |
| `src/semantic-model/to-instructions.js` | 保证来源标签进入 instructions，不被 fallback label 覆盖 |
| `src/indesign-reverse/reverse-model.js` | 从标签恢复 `sourcePackage/sourceFile/sourceNode/structure/layout` 字段 |
| `src/indesign-reverse/index.js` | 导出反向源码包写出 API |
| `scripts/indesign-reverse-export.js` | 写出 `deck.visual.html` 和 `author/` 源码包 |
| `scripts/indesign-e2e.js` | `--reverse-roundtrip` 增加 author package 审核 |
| `test/indesign-reverse/cli.test.js` | CLI 产物从单 HTML 扩展为视觉 HTML + 作者源码包 |
| `test/indesign-e2e-runner.test.js` | E2E 结果结构覆盖 author package |
| `docs/规范/REVERSE_EXPORT.md` | 记录反向自动拆包为硬规则 |
| `docs/规范/SEMANTIC_PROTOCOL.md` | 记录源码包来源标签和反向源码包产物 |
| `AGENTS.md` | 补充反向 roundtrip 输出说明 |

## Data Contract

### DocumentModel 新字段

```js
{
  sourcePackage: {
    schemaVersion: 1,
    config: 'deck.config.json',
    entry: 'deck.html',
    styleFiles: ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css'],
    pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    assetRoot: 'assets'
  }
}
```

### PageModel 新字段

```js
{
  sourceFile: 'pages/01-agenda.html',
  sourceNode: {
    tagName: 'section',
    id: 'agenda-page',
    classList: ['page'],
    attributes: {
      'data-page': 'agenda',
      'data-id-layout': 'contents-grid'
    }
  },
  layout: 'contents-grid',
  grid: {
    columns: 12,
    rows: 6,
    columnGutter: 6,
    rowGutter: 8,
    baseline: 4
  }
}
```

### PageItemModel 新字段

```js
{
  sourceFile: 'pages/01-agenda.html',
  sourceNode: {
    tagName: 'div',
    id: 'agenda-chapter-01',
    classList: ['chapter-card', 'grid-item'],
    attributes: {
      'data-id-object': '',
      'data-id-object-style': 'chapter-card'
    }
  },
  structure: {
    parentId: 'agenda-page',
    order: 4,
    containerPolicy: 'group'
  },
  layout: {
    grid: { col: 5, span: 3, row: 2, rowSpan: 2 },
    cssVars: {
      '--grid-col': '5',
      '--grid-span': '3',
      '--grid-row': '2',
      '--grid-row-span': '2'
    }
  }
}
```

规则：

- `sourceFile` 优先来自页面片段来源；对象没有单独来源文件时继承页面来源文件。
- `sourceNode.attributes` 只保留 `id`、`class` 之外的稳定属性，重点是 `data-id-*`、`aria-*`、`role`、`href`、`src`、`alt`、`title`。
- `style` 属性不进入 `sourceNode.attributes`，网格变量进入 `layout.cssVars`。
- 无标签反向时也生成 `sourceFile`，但来源为反向写出器合成的 `pages/NN-name.html`。

## Task 1: Embed and Capture Authoring Source Metadata

**Files:**

- Modify: `src/authoring/source-package.js`
- Modify: `src/paged-html/browser-snapshot.js`
- Create: `src/paged-html/source-metadata.js`
- Create: `test/paged-html/source-metadata.test.js`

- [x] **Step 1: Write failing tests for generated deck source package attributes**

Append to `test/authoring/source-package.test.js`:

```js
test('assembleAuthorPackage writes source package metadata on main', () => {
  const root = makePackageFixture();
  const { html } = assembleAuthorPackage(path.join(root, 'deck.config.json'));

  assert.match(html, /<main class="deck"[^>]+data-id-source-package-config="deck\.config\.json"/);
  assert.match(html, /data-id-source-package-schema="1"/);
  assert.match(html, /<style data-source-file="styles\/tokens\.css">/);
  assert.match(html, /<section[^>]+data-id-source-file="pages\/00-cover\.html"/);
});
```

Expected failure:

```text
AssertionError: input did not match data-id-source-package-config
```

- [x] **Step 2: Add source package attributes in the assembler**

Modify `assembleAuthorPackage` in `src/authoring/source-package.js` so the `<main>` line is built from:

```js
const packageAttrs = [
  `data-id-document="${attr(sourcePackage.config.id)}"`,
  sourcePackage.config.profile ? `data-id-profile="${attr(sourcePackage.config.profile)}"` : null,
  `data-id-source-package-config="${attr(path.relative(sourcePackage.rootDir, sourcePackage.configPath).replace(/\\/g, '/'))}"`,
  `data-id-source-package-schema="${attr(sourcePackage.config.schemaVersion)}"`,
].filter(Boolean).join(' ');

`  <main class="deck" ${packageAttrs}>`;
```

- [x] **Step 3: Write failing unit tests for source metadata extraction**

Create `test/paged-html/source-metadata.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
} = require('../../src/paged-html/source-metadata');

test('sourcePackageFromDocument reads generated deck metadata', () => {
  const sourcePackage = sourcePackageFromDocument({
    attributes: {
      'data-id-source-package-config': 'deck.config.json',
      'data-id-source-package-schema': '1',
    },
    styleFiles: ['styles/tokens.css', 'styles/layout.css'],
    pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    assetRoot: 'assets',
  });

  assert.deepEqual(sourcePackage, {
    schemaVersion: 1,
    config: 'deck.config.json',
    entry: 'deck.html',
    styleFiles: ['styles/tokens.css', 'styles/layout.css'],
    pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    assetRoot: 'assets',
  });
});

test('sourceNodeForSnapshotItem keeps stable authoring attributes only', () => {
  const node = sourceNodeForSnapshotItem({
    tagName: 'div',
    id: 'agenda-card',
    classList: ['chapter-card', 'grid-item'],
    attributes: {
      id: 'agenda-card',
      class: 'chapter-card grid-item',
      style: '--grid-col:5',
      'data-id-object': '',
      'data-id-object-style': 'chapter-card',
      'data-id-ignore': 'true',
      'aria-label': 'agenda card',
    },
  });

  assert.deepEqual(node, {
    tagName: 'div',
    id: 'agenda-card',
    classList: ['chapter-card', 'grid-item'],
    attributes: {
      'data-id-object': '',
      'data-id-object-style': 'chapter-card',
      'aria-label': 'agenda card',
    },
  });
});

test('gridLayoutFromCssVars converts grid custom properties to numbers', () => {
  assert.deepEqual(gridLayoutFromCssVars({
    '--grid-col': '5',
    '--grid-span': '3',
    '--grid-row': '2',
    '--grid-row-span': '2',
  }), {
    grid: { col: 5, span: 3, row: 2, rowSpan: 2 },
    cssVars: {
      '--grid-col': '5',
      '--grid-span': '3',
      '--grid-row': '2',
      '--grid-row-span': '2',
    },
  });
});
```

Expected failure:

```text
Cannot find module '../../src/paged-html/source-metadata'
```

- [x] **Step 4: Implement source metadata helpers**

Create `src/paged-html/source-metadata.js`:

```js
const STABLE_ATTRIBUTE_RE = /^(data-id-|aria-|role$|href$|src$|alt$|title$)/i;
const GRID_VAR_NAMES = ['--grid-col', '--grid-span', '--grid-row', '--grid-row-span'];

function sourcePackageFromDocument(input = {}) {
  const attributes = input.attributes || {};
  const config = attributes['data-id-source-package-config'] || null;
  if (!config) return null;
  return {
    schemaVersion: Number(attributes['data-id-source-package-schema'] || 1),
    config,
    entry: input.entry || 'deck.html',
    styleFiles: (input.styleFiles || []).map(slash),
    pageFiles: (input.pageFiles || []).map((page) => ({ id: page.id, file: slash(page.file) })),
    assetRoot: input.assetRoot || 'assets',
  };
}

function sourceNodeForSnapshotItem(item = {}) {
  const attributes = {};
  for (const [name, value] of Object.entries(item.attributes || {})) {
    if (name === 'id' || name === 'class' || name === 'style') continue;
    if (name === 'data-id-ignore') continue;
    if (STABLE_ATTRIBUTE_RE.test(name)) attributes[name] = value;
  }
  return {
    tagName: String(item.tagName || 'div').toLowerCase(),
    id: item.id || item.attributes && item.attributes.id || null,
    classList: item.classList || [],
    attributes,
  };
}

function gridLayoutFromCssVars(cssVars = {}) {
  const values = {};
  for (const name of GRID_VAR_NAMES) {
    if (cssVars[name] != null && String(cssVars[name]).trim() !== '') {
      values[name] = String(cssVars[name]).trim();
    }
  }
  if (Object.keys(values).length === 0) return null;
  return {
    grid: {
      col: numberOrNull(values['--grid-col']),
      span: numberOrNull(values['--grid-span']),
      row: numberOrNull(values['--grid-row']),
      rowSpan: numberOrNull(values['--grid-row-span']),
    },
    cssVars: values,
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
  GRID_VAR_NAMES,
};
```

- [x] **Step 5: Capture source metadata in browser snapshot**

Modify the browser-side `page.evaluate` in `src/paged-html/browser-snapshot.js`:

```js
function cssVarsFor(el) {
  const style = getComputedStyle(el);
  const out = {};
  for (const name of ['--grid-col', '--grid-span', '--grid-row', '--grid-row-span']) {
    const value = style.getPropertyValue(name);
    if (value && value.trim()) out[name] = value.trim();
  }
  return out;
}

const deckEl = document.querySelector('main.deck') || document.body;
const styleFiles = Array.from(document.querySelectorAll('style[data-source-file]'))
  .map((el) => el.getAttribute('data-source-file'))
  .filter(Boolean);
const pageFiles = pageEls.map((pageEl) => ({
  id: pageEl.getAttribute('data-page') || pageEl.id || '',
  file: pageEl.getAttribute('data-id-source-file') || '',
})).filter((page) => page.id && page.file);
```

Change the browser-side return value from a raw page array to an object that carries root metadata and pages. The existing page mapper becomes the value of a `pages` constant; the page and item additions below are applied inside that same mapper.

```js
const pages = pageEls.map((pageEl, pageIndex) => {
  const pageRect = rectObject(pageEl.getBoundingClientRect());
  const pageStyle = getComputedStyle(pageEl);
  const candidates = Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,div,span,[data-id-object],[data-id-paragraph-style]'))
    .filter((el) => !el.hasAttribute('data-id-ignore'))
    .filter(isCandidateElement)
    .filter((el) => el.tagName.toLowerCase() === 'table' || !el.closest('table'));
  return {
    id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
    index: pageIndex,
    classList: classList(pageEl),
    attributes: attrs(pageEl),
    sourceFile: pageEl.getAttribute('data-id-source-file') || null,
    sourceNode: {
      tagName: pageEl.tagName.toLowerCase(),
      id: pageEl.id || null,
      classList: classList(pageEl),
      attributes: attrs(pageEl),
    },
    rectPx: pageRect,
    widthCss: pageStyle.width,
    heightCss: pageStyle.height,
    computedStyle: styleObject(pageEl),
    authoredStyle: authoredStyleObject(pageEl, styleRules),
    items: candidates.map((el, itemIndex) => {
      const frameEl = visualFrameFor(el);
      const itemAttrs = attrs(el);
      const frameAttrs = attrs(frameEl);
      return {
        id: itemIdFor(el, frameEl, pageIndex, itemIndex),
        tagName: el.tagName.toLowerCase(),
        classList: mergeClassList(classList(el), classList(frameEl)),
        attributes: mergeFrameAttributes(itemAttrs, frameAttrs),
        sourceNode: {
          tagName: el.tagName.toLowerCase(),
          id: itemIdFor(el, frameEl, pageIndex, itemIndex),
          classList: mergeClassList(classList(el), classList(frameEl)),
          attributes: mergeFrameAttributes(itemAttrs, frameAttrs),
        },
        cssVars: cssVarsFor(el),
        rectPx: rectObject(frameEl.getBoundingClientRect()),
        text: el.innerText || el.textContent || '',
        computedStyle: mergeVisualFrameStyle(styleObject(el), styleObject(frameEl)),
        authoredStyle: mergeVisualFrameStyle(authoredStyleObject(el, styleRules), authoredStyleObject(frameEl, styleRules)),
        runs: textRunsFor(el),
        table: tableRowsFor(el, styleRules),
        unsupported: unsupportedFor(el),
        candidateIndex: itemIndex,
        ancestorCandidateIndexes: ancestorCandidateIndexes(el, candidates),
      };
    }),
  };
});

return {
  sourcePackageInput: {
    attributes: attrs(deckEl),
    styleFiles,
    pageFiles,
    assetRoot: 'assets',
  },
  pages,
};
```

Add page fields:

```js
sourceFile: pageEl.getAttribute('data-id-source-file') || null,
sourceNode: {
  tagName: pageEl.tagName.toLowerCase(),
  id: pageEl.id || null,
  classList: classList(pageEl),
  attributes: attrs(pageEl),
},
```

Add item fields:

```js
cssVars: cssVarsFor(el),
sourceNode: {
  tagName: el.tagName.toLowerCase(),
  id: itemIdFor(el, frameEl, pageIndex, itemIndex),
  classList: mergeClassList(classList(el), classList(frameEl)),
  attributes: mergeFrameAttributes(itemAttrs, frameAttrs),
},
```

In Node-side processing, normalize the evaluated result before mapping pages. Replace `const pages = raw.map((pageInfo) => {` with `const rawPages = Array.isArray(raw) ? raw : raw.pages || []; const sourcePackageInput = Array.isArray(raw) ? null : raw.sourcePackageInput || null; const pages = rawPages.map((pageInfo) => {` and keep the current mapping body unchanged except for the per page/item fields listed below.

Return `sourcePackageInput` in the final snapshot object:

```js
return {
  metadata: {
    source: htmlPath,
    capturedAt: new Date().toISOString(),
  },
  sourcePackageInput,
  pages,
  assets,
  warnings,
  report,
};
```

Also preserve per page/item:

```js
sourceFile: pageInfo.sourceFile || null,
sourceNode: pageInfo.sourceNode || null,
cssVars: item.cssVars || {},
sourceNode: item.sourceNode || null,
```

- [x] **Step 6: Run focused metadata tests**

Run:

```powershell
node --test test/authoring/source-package.test.js test/paged-html/source-metadata.test.js
```

Expected:

```text
pass
```

- [x] **Step 7: Commit**

```powershell
git add src/authoring/source-package.js src/paged-html/browser-snapshot.js src/paged-html/source-metadata.js test/authoring/source-package.test.js test/paged-html/source-metadata.test.js
git commit -m "feat: capture authoring source metadata"
```

## Task 2: Preserve Source Metadata Through Semantic Model and Instructions

**Files:**

- Modify: `src/semantic-model/from-snapshot.js`
- Modify: `src/semantic-model/to-instructions.js`
- Modify: `test/semantic-model/from-snapshot.test.js`
- Modify: `test/paged-html/instructions-compiler.test.js`

- [ ] **Step 1: Write failing semantic model tests**

Append to `test/semantic-model/from-snapshot.test.js`:

```js
test('snapshotToSemanticModel preserves authoring source package labels', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'deck.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
      },
      styleFiles: ['styles/tokens.css'],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    pages: [
      {
        id: 'agenda-page',
        index: 0,
        widthMm: 420,
        heightMm: 236.25,
        rectPx: { x: 0, y: 0, width: 1587.39, height: 892.91 },
        attributes: {
          'data-page': 'agenda',
          'data-id-source-file': 'pages/01-agenda.html',
          'data-id-layout': 'contents-grid',
          'data-id-grid': '12x6',
          'data-id-column-gutter': '6mm',
          'data-id-row-gutter': '8mm',
          'data-id-baseline': '4mm',
        },
        classList: ['page'],
        computedStyle: { width: '1587.39px', height: '892.91px', backgroundColor: 'rgb(255, 255, 255)' },
        items: [
          {
            id: 'agenda-card',
            role: 'shape',
            tagName: 'div',
            classList: ['chapter-card', 'grid-item'],
            attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            sourceNode: {
              tagName: 'div',
              id: 'agenda-card',
              classList: ['chapter-card', 'grid-item'],
              attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            },
            cssVars: {
              '--grid-col': '5',
              '--grid-span': '3',
              '--grid-row': '2',
              '--grid-row-span': '2',
            },
            rectPx: { x: 100, y: 100, width: 200, height: 100 },
            boundsMm: { x: 10, y: 10, width: 20, height: 10 },
            computedStyle: {},
            authoredStyle: {},
            text: '',
            runs: [],
            table: [],
          },
        ],
      },
    ],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.sourcePackage.config, 'deck.config.json');
  assert.equal(model.pages[0].sourceFile, 'pages/01-agenda.html');
  assert.equal(model.pages[0].grid.columns, 12);
  assert.equal(model.pages[0].items[0].sourceFile, 'pages/01-agenda.html');
  assert.deepEqual(model.pages[0].items[0].layout.grid, { col: 5, span: 3, row: 2, rowSpan: 2 });

  const documentLabel = model.labels.find((label) => label.kind === 'document');
  const pageLabel = model.pages[0].labels.find((label) => label.kind === 'page');
  const itemLabel = model.pages[0].items[0].labels.find((label) => label.kind === 'item');

  assert.equal(documentLabel.sourcePackage.config, 'deck.config.json');
  assert.equal(pageLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceNode.tagName, 'div');
  assert.equal(itemLabel.structure.parentId, 'agenda-page');
});
```

Expected failure:

```text
TypeError: Cannot read properties of undefined (reading 'config')
```

- [ ] **Step 2: Implement semantic model source fields and labels**

Modify `src/semantic-model/from-snapshot.js`:

```js
const {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
} = require('../paged-html/source-metadata');
```

In `snapshotToSemanticModel`:

```js
const sourcePackage = sourcePackageFromDocument(styled.sourcePackageInput || {});
```

Add this field to the returned document model:

```js
sourcePackage,
```

Update the document label payload to include the same field:

```js
labels: [createProtocolLabel({
  kind: 'document',
  id: documentId,
  source: 'html-to-indesign',
  unitMode: layout.unitMode,
  coordinateUnit: layout.targetUnit,
  profile: options.profile || null,
  sourcePackage,
})],
```

In `pageModelFor`:

```js
const sourceFile = attrs['data-id-source-file'] || page.sourceFile || null;
const grid = pageGridFromAttributes(attrs);
const sourceNode = page.sourceNode || sourceNodeForSnapshotItem(Object.assign({}, page, { tagName: 'section' }));
```

Add these fields to the returned page model:

```js
sourceFile,
sourceNode,
grid,
```

Update the page label payload:

```js
labels: [createProtocolLabel({
  kind: 'page',
  id: pageId,
  source: 'html-to-indesign',
  semantic,
  parentPage: parentPageId ? { id: parentPageId, name: parentPageName } : null,
  layout: layoutToken,
  sourceFile,
  sourceNode,
  grid,
})],
```

In `itemModelFor`:

```js
const sourceFile = attrs['data-id-source-file'] || page.sourceFile || page.attributes && page.attributes['data-id-source-file'] || null;
const sourceNode = item.sourceNode || sourceNodeForSnapshotItem(item);
const itemLayout = gridLayoutFromCssVars(item.cssVars || {});
const structure = { parentId: page.id, order: item.documentOrder || 0, containerPolicy: 'group' };
```

Add these fields to the returned item model:

```js
sourceFile,
sourceNode,
structure,
layout: itemLayout,
```

Update the item label payload:

```js
labels: [createProtocolLabel({
  kind: 'item',
  id: item.id,
  source: 'html-to-indesign',
  role: item.role,
  semantic,
  htmlTag: item.tagName || null,
  className: (item.classList || []).join(' '),
  sourceFile,
  sourceNode,
  structure,
  layout: itemLayout,
})],
```

Add helper:

```js
function pageGridFromAttributes(attrs = {}) {
  const grid = String(attrs['data-id-grid'] || '').match(/^(\d+)x(\d+)$/);
  if (!grid) return null;
  return {
    columns: Number(grid[1]),
    rows: Number(grid[2]),
    columnGutter: lengthNumber(attrs['data-id-column-gutter']),
    rowGutter: lengthNumber(attrs['data-id-row-gutter']),
    baseline: lengthNumber(attrs['data-id-baseline']),
  };
}

function lengthNumber(value) {
  const match = String(value || '').match(/^([+-]?(?:\d+|\d*\.\d+))/);
  return match ? Number(match[1]) : null;
}
```

- [ ] **Step 3: Write failing instruction compiler tests**

Append to `test/paged-html/instructions-compiler.test.js`:

```js
test('compileInstructions carries source package labels into instructions', async () => {
  const htmlPath = path.resolve('test/fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: 'presentation',
    targetSize: 'same',
  });

  const documentLabel = instructions.document.labels.find((label) => label.kind === 'document');
  const pageLabel = instructions.pages[0].labels.find((label) => label.kind === 'page');
  const itemWithSource = instructions.pages[0].items.find((item) => {
    const label = (item.labels || []).find((candidate) => candidate.kind === 'item');
    return label && label.sourceFile;
  });
  const itemLabel = itemWithSource.labels.find((label) => label.kind === 'item');

  assert.equal(documentLabel.sourcePackage.config, 'deck.config.json');
  assert.match(pageLabel.sourceFile, /^pages\/\d\d-/);
  assert.match(itemLabel.sourceFile, /^pages\/\d\d-/);
  assert.ok(itemLabel.sourceNode.tagName);
  assert.equal(itemLabel.structure.parentId, instructions.pages[0].id);
});
```

Expected failure:

```text
AssertionError: expected documentLabel.sourcePackage.config to equal deck.config.json
```

- [ ] **Step 4: Preserve enriched labels in instructions**

`src/semantic-model/to-instructions.js` already keeps `model.labels`, `page.labels` and `modelItem.labels`. Confirm `ensureItemLabels` only fills missing labels:

```js
function labelsFor(labels, fallback) {
  return Array.isArray(labels) && labels.length ? labels : [createProtocolLabel(fallback)];
}
```

If a new decoration/background item lacks labels, keep current fallback; do not copy source metadata onto generated decoration items.

- [ ] **Step 5: Run semantic model and compiler tests**

Run:

```powershell
node --test test/semantic-model/from-snapshot.test.js test/paged-html/instructions-compiler.test.js
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```powershell
git add src/semantic-model/from-snapshot.js src/semantic-model/to-instructions.js test/semantic-model/from-snapshot.test.js test/paged-html/instructions-compiler.test.js
git commit -m "feat: preserve source metadata in instructions"
```

## Task 3: Read Source Labels Back Into Reverse Model

**Files:**

- Modify: `src/indesign-reverse/reverse-model.js`
- Modify: `test/fixtures/indesign-reverse/tagged-snapshot.json`
- Modify: `test/indesign-reverse/reverse-model.test.js`
- Modify: `test/indesign-executor/executor-script-static.test.js`

- [ ] **Step 1: Extend tagged reverse fixture with source labels**

In `test/fixtures/indesign-reverse/tagged-snapshot.json`, add to document label:

```json
"sourcePackage": {
  "schemaVersion": 1,
  "config": "deck.config.json",
  "entry": "deck.html",
  "styleFiles": ["styles/tokens.css", "styles/layout.css", "styles/components.css", "styles/pages.css"],
  "pageFiles": [{ "id": "agenda", "file": "pages/01-agenda.html" }],
  "assetRoot": "assets"
}
```

Add to page label:

```json
"sourceFile": "pages/01-agenda.html",
"sourceNode": {
  "tagName": "section",
  "id": "agenda-page",
  "classList": ["page"],
  "attributes": {
    "data-page": "agenda",
    "data-id-layout": "contents-grid"
  }
},
"grid": { "columns": 12, "rows": 6, "columnGutter": 6, "rowGutter": 8, "baseline": 4 }
```

Add to item label:

```json
"sourceFile": "pages/01-agenda.html",
"sourceNode": {
  "tagName": "h2",
  "id": "agenda-title",
  "classList": ["page-title", "grid-item"],
  "attributes": {
    "data-id-object": "",
    "data-id-paragraph-style": "page-title"
  }
},
"structure": { "parentId": "agenda-page", "order": 1, "containerPolicy": "group" },
"layout": {
  "grid": { "col": 1, "span": 4, "row": 1, "rowSpan": 1 },
  "cssVars": {
    "--grid-col": "1",
    "--grid-span": "4",
    "--grid-row": "1",
    "--grid-row-span": "1"
  }
}
```

- [ ] **Step 2: Write failing reverse model assertions**

Append to the first test in `test/indesign-reverse/reverse-model.test.js`:

```js
assert.equal(model.sourcePackage.config, 'deck.config.json');
assert.equal(model.pages[0].sourceFile, 'pages/01-agenda.html');
assert.equal(model.pages[0].sourceNode.tagName, 'section');
assert.equal(model.pages[0].grid.columns, 12);
assert.equal(model.pages[0].items[0].sourceFile, 'pages/01-agenda.html');
assert.equal(model.pages[0].items[0].sourceNode.tagName, 'h2');
assert.deepEqual(model.pages[0].items[0].layout.grid, { col: 1, span: 4, row: 1, rowSpan: 1 });
assert.equal(model.pages[0].items[0].structure.parentId, 'agenda-page');
```

Expected failure:

```text
TypeError: Cannot read properties of undefined (reading 'config')
```

- [ ] **Step 3: Restore source labels in reverse model**

Modify `src/indesign-reverse/reverse-model.js`:

```js
sourcePackage: documentLabel.sourcePackage || null,
```

In `reversePage`:

```js
sourceFile: label.sourceFile || null,
sourceNode: label.sourceNode || null,
grid: label.grid || null,
```

In `reverseItem`:

```js
sourceFile: label.sourceFile || null,
sourceNode: label.sourceNode || null,
structure: label.structure || null,
layout: label.layout || null,
```

- [ ] **Step 4: Add static test that executor/reverse scripts can carry labels**

Append to `test/indesign-executor/executor-script-static.test.js`:

```js
test('executor and reverse scripts use html_indesign protocol labels for source metadata', () => {
  const labels = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_labels.jsxinc'), 'utf8');
  const document = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_document.jsxinc'), 'utf8');
  const items = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_items.jsxinc'), 'utf8');
  const reverse = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(labels, /insertLabel\("html_indesign"/);
  assert.match(document, /HI\.writeProtocolLabels\(doc/);
  assert.match(document, /HI\.writeProtocolLabels\(page/);
  assert.match(items, /HI\.writeProtocolLabels\(frame/);
  assert.match(items, /HI\.writeProtocolLabels\(rect/);
  assert.match(reverse, /HI\.readProtocolLabel\(target\)/);
});
```

Expected:

```text
pass
```

- [ ] **Step 5: Run reverse model and static tests**

Run:

```powershell
node --test test/indesign-reverse/reverse-model.test.js test/indesign-executor/executor-script-static.test.js
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```powershell
git add src/indesign-reverse/reverse-model.js test/fixtures/indesign-reverse/tagged-snapshot.json test/indesign-reverse/reverse-model.test.js test/indesign-executor/executor-script-static.test.js
git commit -m "feat: restore source labels in reverse model"
```

## Task 4: Write Reverse Authoring Source Packages

**Files:**

- Create: `src/indesign-reverse/author-css-writer.js`
- Create: `src/indesign-reverse/author-package-writer.js`
- Modify: `src/indesign-reverse/index.js`
- Create: `test/indesign-reverse/author-package-writer.test.js`

- [ ] **Step 1: Write failing author package writer tests**

Create `test/indesign-reverse/author-package-writer.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { writeReverseAuthorPackage } = require('../../src/indesign-reverse');
const { checkAuthorPackageEntry } = require('../../src/authoring');

test('writeReverseAuthorPackage splits tagged model into author source package', () => {
  const outDir = path.resolve('test/workspace/reverse-author-package-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(taggedModel(), { outDir, mode: 'authoring' });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.config.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'pages/01-agenda.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/tokens.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/layout.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/components.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/pages.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/reverse-overrides.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'reports/authoring-report.json')), true);

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.match(pageHtml, /<section class="page"/);
  assert.match(pageHtml, /data-id-source-file="pages\/01-agenda\.html"/);
  assert.match(pageHtml, /<h2[^>]+class="page-title grid-item"/);
  assert.match(pageHtml, /--grid-col:1/);

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.deepEqual(config.pages, [{ id: 'agenda', file: 'pages/01-agenda.html' }]);
  assert.equal(checkAuthorPackageEntry(path.join(outDir, 'deck.config.json')).ok, true);
});

test('writeReverseAuthorPackage still splits observation models by page', () => {
  const outDir = path.resolve('test/workspace/reverse-author-observed-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(observedModel(), { outDir, mode: 'observation' });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'pages/00-page-1.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/reverse-overrides.css')), true);

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-page-1.html'), 'utf8');
  assert.match(pageHtml, /data-id-reverse-mode="observation"/);
  assert.match(pageHtml, /data-id-observed="true"/);
  assert.match(pageHtml, /class="observed-text id-object"/);

  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');
  assert.match(overrides, /#observed-title/);
  assert.match(overrides, /position:absolute/);
});

function taggedModel() {
  return {
    kind: 'DocumentModel',
    id: 'architecture-report',
    title: '建筑汇报',
    reverseMode: 'structured',
    sourcePackage: {
      schemaVersion: 1,
      config: 'deck.config.json',
      entry: 'deck.html',
      styleFiles: ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css'],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    styles: {
      paragraphStyles: {
        '页面标题': { token: 'page-title', name: '页面标题', safeName: 'page-title', css: 'font-size:32pt; color:#123456' },
      },
      objectStyles: {},
      characterStyles: {},
    },
    pages: [
      {
        id: 'agenda-page',
        semantic: 'agenda',
        sourceFile: 'pages/01-agenda.html',
        sourceNode: {
          tagName: 'section',
          id: 'agenda-page',
          classList: ['page'],
          attributes: { 'data-page': 'agenda', 'data-id-layout': 'contents-grid' },
        },
        layout: 'contents-grid',
        width: 1587.39,
        height: 892.91,
        grid: { columns: 12, rows: 6, columnGutter: 6, rowGutter: 8, baseline: 4 },
        items: [
          {
            id: 'agenda-title',
            role: 'text',
            semantic: 'page-title',
            tagName: 'h2',
            sourceFile: 'pages/01-agenda.html',
            sourceNode: {
              tagName: 'h2',
              id: 'agenda-title',
              classList: ['page-title', 'grid-item'],
              attributes: { 'data-id-object': '', 'data-id-paragraph-style': 'page-title' },
            },
            structure: { parentId: 'agenda-page', order: 1, containerPolicy: 'group' },
            layout: {
              grid: { col: 1, span: 4, row: 1, rowSpan: 1 },
              cssVars: { '--grid-col': '1', '--grid-span': '4', '--grid-row': '1', '--grid-row-span': '1' },
            },
            bounds: { x: 120, y: 140, width: 460, height: 80 },
            styleRefs: { paragraphStyle: '页面标题' },
            content: { text: '汇报结构', runs: [] },
          },
        ],
      },
    ],
  };
}

function observedModel() {
  return {
    kind: 'DocumentModel',
    id: 'observed-report',
    title: 'Observed',
    reverseMode: 'observation',
    pages: [
      {
        id: 'page-1',
        width: 800,
        height: 450,
        items: [
          {
            id: 'observed-title',
            role: 'text',
            semantic: 'unknown',
            tagName: 'p',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            styleRefs: {},
            content: { text: '未标注标题', runs: [] },
            textStyle: { pointSize: 32, fillColor: '#123456' },
          },
        ],
      },
    ],
  };
}
```

Expected failure:

```text
TypeError: writeReverseAuthorPackage is not a function
```

- [ ] **Step 2: Implement CSS writer**

Create `src/indesign-reverse/author-css-writer.js`:

```js
function writeAuthorCssFiles(model) {
  return {
    'styles/tokens.css': tokensCss(model),
    'styles/layout.css': layoutCss(model),
    'styles/components.css': componentsCss(model),
    'styles/pages.css': pagesCss(model),
    'styles/reverse-overrides.css': reverseOverridesCss(model),
  };
}

function tokensCss(model) {
  return [
    ':root {',
    '  --id-page-bg: #ffffff;',
    '  --id-text: #14324a;',
    '}',
    '',
  ].join('\n');
}

function layoutCss(model) {
  const first = model.pages && model.pages[0] || {};
  return [
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #f3f5f6; color: var(--id-text); font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '.deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `.page { position: relative; width: ${px(first.width || 0)}; height: ${px(first.height || 0)}; background: var(--id-page-bg); overflow: hidden; }`,
    '.grid-item { position: absolute; }',
    '.id-object { position: absolute; margin: 0; overflow: hidden; }',
    '',
  ].join('\n');
}

function componentsCss(model) {
  const styles = model.styles || {};
  return [
    styleCollectionCss(styles.paragraphStyles, 'pstyle'),
    styleCollectionCss(styles.characterStyles, 'cstyle'),
    styleCollectionCss(styles.objectStyles, 'ostyle'),
    '',
  ].filter(Boolean).join('\n');
}

function pagesCss(model) {
  return [
    '/* Page-specific reverse styles are emitted here when a page cannot use shared components. */',
    '',
  ].join('\n');
}

function reverseOverridesCss(model) {
  const lines = ['/* Generated fallback geometry for reverse-exported objects. */'];
  for (const page of model.pages || []) {
    for (const item of page.items || []) {
      if (item.layout && item.layout.grid) continue;
      if (!item.bounds) continue;
      lines.push(`#${cssId(item.id)} { position:absolute; left:${px(item.bounds.x)}; top:${px(item.bounds.y)}; width:${px(item.bounds.width)}; height:${px(item.bounds.height)}; }`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {}).filter((style) => style && style.css).map((style) => {
    return `.${prefix}-${safeClass(style.safeName || style.token || style.name)} { ${String(style.css).replace(/pt\b/g, 'px')} }`;
  }).join('\n');
}

function px(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0}px`;
}

function cssId(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function safeClass(value) {
  return String(value || 'style').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-');
}

module.exports = {
  writeAuthorCssFiles,
};
```

- [ ] **Step 3: Implement author package writer**

Create `src/indesign-reverse/author-package-writer.js`:

```js
const fs = require('fs');
const path = require('path');
const { writeAuthorPackageEntry } = require('../authoring');
const { writeAuthorCssFiles } = require('./author-css-writer');

function writeReverseAuthorPackage(model, options = {}) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('writeReverseAuthorPackage requires a DocumentModel');
  }
  const outDir = path.resolve(options.outDir || 'reverse-export/author');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });

  const pages = pageEntries(model, options);
  const config = deckConfigFor(model, pages);
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify(config, null, 2), 'utf8');

  for (const [relativePath, css] of Object.entries(writeAuthorCssFiles(model))) {
    writeText(outDir, relativePath, css);
  }
  for (const page of pages) {
    writeText(outDir, page.file, pageHtml(page.modelPage, page.file, options));
  }

  const report = authoringReport(model, pages, options);
  fs.writeFileSync(path.join(outDir, 'reports/authoring-report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reports/inference-report.json'), JSON.stringify(report.inference, null, 2), 'utf8');
  writeAuthorPackageEntry(path.join(outDir, 'deck.config.json'));

  return {
    ok: true,
    outDir,
    configPath: path.join(outDir, 'deck.config.json'),
    entryPath: path.join(outDir, 'deck.html'),
    pages: pages.map((page) => page.file),
    report,
  };
}

function deckConfigFor(model, pages) {
  const sourcePackage = model.sourcePackage || {};
  return {
    schemaVersion: 1,
    id: model.id,
    title: model.title || model.id,
    profile: model.profile || null,
    unitMode: model.unitMode || 'presentation',
    targetSize: 'source',
    entry: 'deck.html',
    styles: ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css', 'styles/reverse-overrides.css'],
    pages: pages.map((page) => ({ id: page.id, file: page.file })),
    assets: { root: sourcePackage.assetRoot || 'assets' },
  };
}

function pageEntries(model, options) {
  return (model.pages || []).map((page, index) => {
    const file = page.sourceFile || `pages/${String(index).padStart(2, '0')}-${safeFile(page.semantic || page.id || `page-${index + 1}`)}.html`;
    return { id: page.semantic || page.pageToken || page.id || `page-${index + 1}`, file, modelPage: page };
  });
}

function pageHtml(page, sourceFile, options) {
  const attrs = sourcePageAttrs(page, sourceFile, options);
  const items = (page.items || []).slice().sort((a, b) => {
    const orderA = a.structure && Number(a.structure.order);
    const orderB = b.structure && Number(b.structure.order);
    return (Number.isFinite(orderA) ? orderA : 0) - (Number.isFinite(orderB) ? orderB : 0);
  }).map((item) => itemHtml(item, options)).join('\n');
  return [`<section ${attrs.join(' ')}>`, indent(items, 2), `</section>`, ''].join('\n');
}

function sourcePageAttrs(page, sourceFile, options) {
  const sourceNode = page.sourceNode || {};
  const classes = sourceNode.classList && sourceNode.classList.length ? sourceNode.classList.join(' ') : 'page';
  const attrs = [`class="${attr(classes)}"`];
  if (sourceNode.id || page.id) attrs.push(`id="${attr(sourceNode.id || page.id)}"`);
  attrs.push(`data-page="${attr(page.semantic || page.id)}"`);
  attrs.push(`data-id-source-file="${attr(sourceFile)}"`);
  if (options.mode === 'observation' || page.semantic === 'unknown') attrs.push('data-id-observed="true"');
  if (options.mode) attrs.push(`data-id-reverse-mode="${attr(options.mode)}"`);
  for (const [name, value] of Object.entries(sourceNode.attributes || {})) {
    if (['id', 'class', 'data-page', 'data-id-source-file'].includes(name)) continue;
    attrs.push(`${name}="${attr(value)}"`);
  }
  if (page.grid) {
    attrs.push(`data-id-grid="${attr(`${page.grid.columns}x${page.grid.rows}`)}"`);
    if (page.grid.columnGutter != null) attrs.push(`data-id-column-gutter="${attr(`${page.grid.columnGutter}px`)}"`);
    if (page.grid.rowGutter != null) attrs.push(`data-id-row-gutter="${attr(`${page.grid.rowGutter}px`)}"`);
    if (page.grid.baseline != null) attrs.push(`data-id-baseline="${attr(`${page.grid.baseline}px`)}"`);
  }
  return attrs;
}

function itemHtml(item, options) {
  const node = item.sourceNode || {};
  const tag = safeTag(node.tagName || item.tagName || tagForRole(item.role));
  const classes = itemClasses(item, options, node);
  const attrs = [`id="${attr(node.id || item.id)}"`, `class="${attr(classes)}"`];
  for (const [name, value] of Object.entries(node.attributes || {})) {
    if (['id', 'class', 'style'].includes(name)) continue;
    attrs.push(`${name}="${attr(value)}"`);
  }
  if (!attrs.some((part) => /^data-id-object=/.test(part))) attrs.push(`data-id-object="${attr(item.id)}"`);
  if (item.semantic) attrs.push(`data-id-semantic="${attr(item.semantic)}"`);
  const style = gridStyle(item);
  if (style) attrs.push(`style="${attr(style)}"`);
  return `<${tag} ${attrs.join(' ')}>${itemContent(item)}</${tag}>`;
}

function itemClasses(item, options, node) {
  const classes = new Set(node.classList || []);
  if (options.mode === 'observation' && item.role === 'text') classes.add('observed-text');
  if (!classes.size) classes.add('id-object');
  return Array.from(classes).join(' ');
}

function gridStyle(item) {
  const cssVars = item.layout && item.layout.cssVars;
  if (!cssVars) return '';
  return Object.entries(cssVars).map(([name, value]) => `${name}:${value}`).join(';');
}

function itemContent(item) {
  if (item.role === 'table' && item.table) return tableContent(item.table);
  return escapeHtml(item.content && item.content.text || '').replace(/\r\n|\r|\n/g, '<br>');
}

function tableContent(table) {
  const rows = table.rows || [];
  return rows.map((row) => `<tr>${(row.cells || []).map((cell) => {
    const tag = cell.header ? 'th' : 'td';
    return `<${tag}>${escapeHtml(cell.text || '')}</${tag}>`;
  }).join('')}</tr>`).join('');
}

function authoringReport(model, pages, options) {
  const inferred = pages.filter((page) => !page.modelPage.sourceFile).length;
  return {
    ok: true,
    mode: options.mode || model.reverseMode || 'structured',
    pages: pages.length,
    inferredPageFiles: inferred,
    inference: {
      source: inferred ? 'observation-page-split' : 'source-labels',
      confidence: inferred ? 'low' : 'high',
    },
  };
}

function writeText(root, relativePath, text) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

function safeFile(value) {
  return String(value || 'page').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function safeTag(value) {
  return /^(section|div|p|h1|h2|h3|h4|h5|h6|figure|table|span)$/i.test(value) ? String(value).toLowerCase() : 'div';
}

function tagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'table') return 'table';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(value || '').split(/\r?\n/).map((line) => line ? `${prefix}${line}` : line).join('\n');
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  writeReverseAuthorPackage,
};
```

- [ ] **Step 4: Export writer API**

Modify `src/indesign-reverse/index.js`:

```js
const { writeReverseAuthorPackage } = require('./author-package-writer');

module.exports = Object.assign(
  {},
  require('./snapshot-reader'),
  require('./reverse-model'),
  require('./html-writer'),
  require('./legacy-blueprint'),
  { writeReverseAuthorPackage }
);
```

- [ ] **Step 5: Run author package writer tests**

Run:

```powershell
node --test test/indesign-reverse/author-package-writer.test.js
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```powershell
git add src/indesign-reverse/author-css-writer.js src/indesign-reverse/author-package-writer.js src/indesign-reverse/index.js test/indesign-reverse/author-package-writer.test.js
git commit -m "feat: write reverse authoring packages"
```

## Task 5: Wire Reverse CLI and E2E Roundtrip

**Files:**

- Modify: `scripts/indesign-reverse-export.js`
- Modify: `scripts/indesign-e2e.js`
- Modify: `test/indesign-reverse/cli.test.js`
- Modify: `test/indesign-e2e-runner.test.js`

- [ ] **Step 1: Write failing CLI tests for visual HTML and author package**

Modify `test/indesign-reverse/cli.test.js`:

```js
test('compileReverseSnapshotToHtml writes visual HTML and author package', () => {
  const outDir = path.resolve('test/workspace/reverse-cli-author-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.visual.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.structured.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/deck.config.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/pages/01-agenda.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/deck.html')), true);
  assert.equal(result.files.visualHtml, path.join(outDir, 'deck.visual.html'));
  assert.equal(result.files.author.config, path.join(outDir, 'author/deck.config.json'));
});
```

Expected failure:

```text
AssertionError: expected false to equal true
```

- [ ] **Step 2: Update reverse CLI writer**

Modify `scripts/indesign-reverse-export.js` imports:

```js
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  semanticModelToHtml,
  legacyBlueprintToSemanticModel,
  writeReverseAuthorPackage,
} = require('../src/indesign-reverse');
```

Modify output writes:

```js
const visualHtml = semanticModelToHtml(model, { outputDir: outDir });
const authorResult = writeReverseAuthorPackage(model, {
  outDir: path.join(outDir, 'author'),
  mode: options.mode,
});

fs.writeFileSync(path.join(outDir, 'deck.visual.html'), visualHtml, 'utf8');
fs.writeFileSync(path.join(outDir, modeHtmlName), visualHtml, 'utf8');
fs.writeFileSync(path.join(outDir, 'deck.html'), visualHtml, 'utf8');
```

Extend result files:

```js
files: {
  html: path.join(outDir, 'deck.html'),
  visualHtml: path.join(outDir, 'deck.visual.html'),
  modeHtml: path.join(outDir, modeHtmlName),
  model: path.join(outDir, 'reverse-model.json'),
  report: path.join(outDir, 'report.json'),
  modeReport: path.join(outDir, modeReportName),
  author: {
    config: authorResult.configPath,
    entry: authorResult.entryPath,
    outDir: authorResult.outDir,
    pages: authorResult.pages,
  },
}
```

Keep top-level `deck.html` for backward compatibility, but treat it as visual output. The editable entry is `author/deck.html`.

- [ ] **Step 3: Add E2E author package audit**

Modify `scripts/indesign-e2e.js`:

```js
function auditReverseAuthorPackage(author) {
  if (!author || !author.config || !fs.existsSync(author.config)) {
    return { ok: false, missing: ['author/deck.config.json'] };
  }
  const { checkAuthorPackageEntry } = require('../src/authoring');
  const check = checkAuthorPackageEntry(author.config);
  const config = JSON.parse(fs.readFileSync(author.config, 'utf8'));
  const pageFiles = (config.pages || []).map((page) => path.join(path.dirname(author.config), page.file));
  const missingPages = pageFiles.filter((file) => !fs.existsSync(file));
  return {
    ok: check.ok && missingPages.length === 0,
    config: author.config,
    entry: check.entryPath,
    pages: pageFiles.length,
    missingPages,
  };
}
```

In `runReverseRoundtrip`, after `htmlResult`:

```js
const authorAudit = auditReverseAuthorPackage(htmlResult.files.author);
if (!authorAudit.ok) {
  throw new Error(`Reverse author package audit failed: ${JSON.stringify(authorAudit, null, 2)}`);
}
const author = Object.assign({}, htmlResult.files.author, { audit: authorAudit });
```

Return the `author` object next to the existing `snapshot` and `html` objects in the reverse roundtrip result.

- [ ] **Step 4: Update E2E runner test**

Append to `test/indesign-e2e-runner.test.js`:

```js
test('auditReverseAuthorPackage reports generated author package health', () => {
  const outDir = path.resolve('test/workspace/e2e-author-audit-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const { writeReverseAuthorPackage } = require('../src/indesign-reverse');
  const { auditReverseAuthorPackage } = require('../scripts/indesign-e2e');

  const author = writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'audit',
    title: 'Audit',
    pages: [{ id: 'page-1', width: 800, height: 450, items: [] }],
  }, { outDir, mode: 'observation' });

  const audit = auditReverseAuthorPackage({
    config: author.configPath,
    entry: author.entryPath,
    outDir: author.outDir,
    pages: author.pages,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.pages, 1);
});
```

Export `auditReverseAuthorPackage` from `scripts/indesign-e2e.js`.

- [ ] **Step 5: Run CLI and E2E runner tests**

Run:

```powershell
node --test test/indesign-reverse/cli.test.js test/indesign-e2e-runner.test.js
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```powershell
git add scripts/indesign-reverse-export.js scripts/indesign-e2e.js test/indesign-reverse/cli.test.js test/indesign-e2e-runner.test.js
git commit -m "feat: export reverse author package from cli"
```

## Task 6: Documentation and Verification

**Files:**

- Modify: `docs/规范/REVERSE_EXPORT.md`
- Modify: `docs/规范/SEMANTIC_PROTOCOL.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-05-26-source-labels-reverse-authoring-roundtrip.md`

- [ ] **Step 1: Document reverse output split**

Update `docs/规范/REVERSE_EXPORT.md` section `4. 产物目录` so it explicitly lists:

```text
reverse-export-<timestamp>/
  deck.visual.html
  deck.<mode>.html
  deck.html                  # compatibility alias of visual output
  reverse-model.json
  report.json
  <mode>-report.json
  author/
    deck.config.json
    deck.html                # generated from author source package
    styles/
      tokens.css
      layout.css
      components.css
      pages.css
      reverse-overrides.css
    pages/
      00-page.html
    reports/
      authoring-report.json
      inference-report.json
```

Add rule:

```text
反向导出不得只生成单个超大 HTML。无论 structured、inferred 还是 observation 模式，都必须至少按页面拆出 author/pages/*.html，并生成可由组装器重建的 author/deck.html。
```

- [ ] **Step 2: Document source metadata fields**

Update `docs/规范/SEMANTIC_PROTOCOL.md` with a short subsection:

```text
源码包来源字段：

- 文档标签记录 sourcePackage。
- 页面标签记录 sourceFile、sourceNode、grid。
- 对象标签记录 sourceFile、sourceNode、structure、layout.grid 和 layout.cssVars。

这些字段只描述作者来源和结构关系，不作为视觉兜底补丁。反向源码包优先使用这些字段拆分页面和恢复 class/data-id。
```

- [ ] **Step 3: Update AGENTS execution baseline**

Update `AGENTS.md` under real E2E description:

```text
加 `--reverse-roundtrip` 时还会生成 `reverse-html/deck.visual.html` 和 `reverse-html/author/`。其中 `reverse-html/author/deck.html` 是由反向源码包组装出来的编辑入口，顶层 `reverse-html/deck.html` 仅保留为视觉兼容入口。
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
node --test test/paged-html/source-metadata.test.js test/semantic-model/from-snapshot.test.js test/paged-html/instructions-compiler.test.js test/indesign-reverse/reverse-model.test.js test/indesign-reverse/author-package-writer.test.js test/indesign-reverse/cli.test.js test/indesign-e2e-runner.test.js
```

Expected:

```text
pass
```

- [ ] **Step 5: Run full tests**

Run:

```powershell
npm test
```

Expected:

```text
pass
```

- [ ] **Step 6: Run real InDesign reverse roundtrip**

Run:

```powershell
$env:INDESIGN_CLI_BIN='D:\AI\mcp-indesign\.indesign-cli\package-test-venv-root\Scripts\indesign-cli.exe'
npm run e2e:indesign -- -- --reverse-roundtrip
```

Expected:

```text
ok: true
reverse.html.author.audit.ok: true
reverse-html/deck.visual.html exists
reverse-html/author/deck.config.json exists
reverse-html/author/pages/*.html count is 7
reverse-html/author/deck.html is up to date
oversetTextFrames: 0
```

- [ ] **Step 7: Commit docs and checklist**

```powershell
git add docs/规范/REVERSE_EXPORT.md docs/规范/SEMANTIC_PROTOCOL.md AGENTS.md docs/superpowers/plans/2026-05-26-source-labels-reverse-authoring-roundtrip.md
git commit -m "docs: document reverse author package roundtrip"
```

## Self-Review

### Spec Coverage

| Requirement | Covered by |
| ----------- | ---------- |
| 反向不能只输出一个超大 HTML | Tasks 4, 5, 6 |
| 反向自动拆成作者源码包结构 | Task 4 |
| 带标签输入按 `sourceFile/sourceNode` 高质量拆分 | Tasks 1, 2, 3, 4 |
| 无标签输入也按页拆包 | Task 4 |
| `deck.html` 保持转换入口兼容 | Task 5 |
| 编辑入口是 `author/deck.html` | Tasks 4, 5, 6 |
| 视觉对照和作者源码分离 | Tasks 4, 5, 6 |
| 正向写入足够标签供反向读取 | Tasks 1, 2, 3 |
| 真实 InDesign 回环验证 | Task 6 |

### File Size Guard

| File | Guard |
| ---- | ----- |
| `src/paged-html/source-metadata.js` | 只放纯元数据 helper，超过 180 行就拆字段 parser |
| `src/indesign-reverse/author-package-writer.js` | 只写文件结构和 HTML 片段，超过 260 行就把 `pageHtml/itemHtml` 拆到 `author-html-writer.js` |
| `src/indesign-reverse/author-css-writer.js` | 只写 CSS 分类，超过 220 行就按 tokens/layout/components/overrides 拆文件 |
| `scripts/indesign-reverse-export.js` | 只编排 CLI，不放写出细节 |
| `scripts/indesign-e2e.js` | 只加审计函数，不放源码包生成逻辑 |

### Intentional Gaps

- 不做高级网格推断；只恢复标签中的网格，或把观察对象放进 `reverse-overrides.css`。
- 不试图恢复原始 CSS 文件的注释和选择器顺序。
- 不把未标注 InDesign 伪装成高质量 authoring 回读。
- 不删除 top-level `deck.html`，因为现有 CLI 测试和外部脚本可能依赖它；但它被明确降级为视觉兼容别名。
