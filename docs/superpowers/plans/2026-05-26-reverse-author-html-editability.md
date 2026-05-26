# 反向作者 HTML 可编辑性与源码还原 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `InDesign -> reverse snapshot -> semantic model -> author/` 输出更接近原始作者源码包，优先恢复可编辑标签、资源元素、嵌套结构和网格 CSS，而不是只输出平铺的视觉对象。

**Architecture:** `deck.visual.html` 继续承担视觉对照职责，允许坐标优先和图框包装；`author/` 独立走源码还原职责，优先使用 `sourceNode`、`structure`、`layout.grid` 和资源模型重建自然 HTML。新增小型作者 HTML 树渲染模块和作者源码审计，避免继续把复杂逻辑塞进单个 `author-package-writer.js`。

**Tech Stack:** Node.js CommonJS、现有 `src/paged-html` 来源标签捕获、现有 `src/semantic-model`、现有 `src/indesign-reverse`、`node:test`、真实 `indesign-cli` E2E。

---

## Scope

本计划实现：

- 反向作者源码包恢复真实资源标签：`img`、`object`、`picture`、`svg`、`canvas` 不再退化成带 `src` / `data` 的 `div`。
- 反向作者源码包恢复页面内父子结构：卡片、图框、指标组、说明组等容器不再全部平铺到 `section.page`。
- 反向作者 CSS 以作者网格优先：有 `layout.grid` 的对象使用 CSS Grid；缺网格的对象才进入 `reverse-overrides.css` 绝对定位兜底。
- 页面属性、对象属性和资源属性去重合并，禁止重复写出 `data-id-grid`、`data-id-column-gutter` 等属性。
- 来源属性捕获范围扩展到普通稳定 `data-*`、资源属性和媒体属性，降低前向标签导致的信息损失。
- 作者源码包审计能发现资源标签退化、重复属性、非法资源属性、网格 CSS 缺失和页面拆分异常。
- 真实 InDesign E2E 的 `--reverse-roundtrip` 审计覆盖作者源码包质量。

本计划不实现：

- 不改变 `deck.visual.html` 的视觉坐标渲染策略。
- 不做复杂未标注 InDesign 的智能版式推断。
- 不把完整原始 CSS 文本塞入 InDesign 标签。
- 不自动把页面结构模板转成 InDesign 母版。
- 不把不确定的装饰碎片强行合并成父对象 CSS；本轮只为可识别来源结构恢复父子关系。

## File Structure

新增：

| 文件 | 责任 |
| ---- | ---- |
| `src/indesign-reverse/author-html-tree.js` | 从 page items 构建作者源码树，并按原始标签/属性/资源语义渲染页面片段 |
| `src/indesign-reverse/author-attribute-writer.js` | 合并、去重和排序 HTML 属性；处理布尔属性、void 标签和危险属性过滤 |
| `src/indesign-reverse/author-audit.js` | 审计反向作者源码包的可编辑性和信息保留质量 |
| `test/indesign-reverse/author-html-tree.test.js` | 作者源码树、资源标签和嵌套结构测试 |
| `test/indesign-reverse/author-audit.test.js` | 反向作者源码包质量审计测试 |

修改：

| 文件 | 责任 |
| ---- | ---- |
| `src/paged-html/browser-snapshot.js` | 捕获 DOM 父子关系、稳定属性和资源属性 |
| `src/paged-html/source-metadata.js` | 扩展 `sourceNode` 属性保留规则，提供属性分类 helper |
| `src/semantic-model/from-snapshot.js` | 把最近候选祖先映射为 `structure.parentId`，保留 `sourceNode` 和 `sourceAsset` |
| `src/indesign-reverse/reverse-model.js` | 保留反向 snapshot 里的来源结构、资源标签和父子关系字段 |
| `src/indesign-reverse/author-package-writer.js` | 改为编排写包，调用树渲染、CSS writer 和审计，不继续承担所有 HTML 细节 |
| `src/indesign-reverse/author-css-writer.js` | 改成 grid-first 作者 CSS，绝对定位只写非网格兜底 |
| `scripts/indesign-e2e.js` | `--reverse-roundtrip` 增加作者源码审计 |
| `test/indesign-reverse/author-package-writer.test.js` | 增加资源标签、嵌套、去重和 grid CSS 断言 |
| `test/paged-html/source-metadata.test.js` | 增加稳定属性和父子来源测试 |
| `test/semantic-model/from-snapshot.test.js` | 增加 `structure.parentId` 来自 DOM 祖先的测试 |
| `docs/规范/REVERSE_EXPORT.md` | 记录 `author/` 的源码还原质量要求 |
| `docs/规范/SEMANTIC_PROTOCOL.md` | 记录 sourceNode/sourceAsset/structure 的作者源码职责 |

## Data Contract

### Snapshot item 增强字段

```js
{
  id: 'metric-value-1',
  sourceNode: {
    tagName: 'p',
    id: 'metric-value-1',
    classList: ['metric-value'],
    attributes: {
      'data-id-paragraph-style': 'metric-value'
    }
  },
  sourceAsset: null,
  ancestorCandidateIds: ['metric-card-1'],
  parentElementId: 'metric-card-1',
  cssVars: {
    '--grid-col': '1',
    '--grid-span': '2',
    '--grid-row': '6',
    '--grid-row-span': '1'
  }
}
```

### PageItemModel 增强字段

```js
{
  sourceNode: {
    tagName: 'img',
    id: 'hero-media',
    classList: ['hero-media'],
    attributes: {
      src: '../smoke-assets/photos/industrial-site.jpg',
      alt: 'industrial roof aerial'
    }
  },
  sourceAsset: {
    tagName: 'img',
    src: '../smoke-assets/photos/industrial-site.jpg',
    data: null,
    type: null,
    alt: 'industrial roof aerial'
  },
  structure: {
    parentId: 'cover-page',
    order: 2,
    containerPolicy: 'group'
  }
}
```

规则：

- `sourceNode.tagName` 是作者源码标签，不等于视觉 HTML 标签。
- `sourceAsset` 只描述作者源码中的资源引用，不能替代 `asset` 中的 InDesign 置入事实。
- `structure.parentId` 优先来自 DOM 最近候选祖先；没有祖先时才使用页面 ID。
- `author/` 输出优先使用 `sourceNode` 和 `sourceAsset`；缺失时才从 `role`、`asset` 和 `content` 合成观察节点。
- `deck.visual.html` 不消费这些作者还原规则。

## Task 1: Add Author HTML Fidelity Tests

**Files:**

- Modify: `test/indesign-reverse/author-package-writer.test.js`
- Create: `test/indesign-reverse/author-html-tree.test.js`

- [x] **Step 1: Add failing tests for resource tag restoration**

Append to `test/indesign-reverse/author-package-writer.test.js`:

```js
test('writeReverseAuthorPackage restores source resource tags instead of div placeholders', () => {
  const outDir = path.resolve('test/workspace/reverse-author-resource-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(resourceModel(), { outDir, mode: 'authoring' });

  const html = fs.readFileSync(path.join(outDir, 'pages/00-cover.html'), 'utf8');
  assert.match(html, /<img[^>]+class="hero-media"/);
  assert.match(html, /src="\.\.\/smoke-assets\/photos\/industrial-site\.jpg"/);
  assert.doesNotMatch(html, /<div[^>]+src="/);
  assert.match(html, /<object[^>]+class="pdf-source"/);
  assert.match(html, /data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"/);
  assert.doesNotMatch(html, /<div[^>]+data="\.\.\/reference-pdfs/);
});
```

Add this helper in the same file:

```js
function resourceModel() {
  return {
    kind: 'DocumentModel',
    id: 'resource-report',
    title: 'Resource Report',
    unitMode: 'presentation',
    sourcePackage: {
      entry: 'deck.html',
      assetRoot: 'assets',
    },
    styles: {},
    pages: [
      {
        id: 'cover-page',
        semantic: 'cover',
        sourceFile: 'pages/00-cover.html',
        sourceNode: {
          tagName: 'section',
          id: 'cover-page',
          classList: ['page'],
          attributes: { 'data-page': 'cover', 'data-id-grid': '12x8' },
        },
        width: 1920,
        height: 1080,
        grid: { columns: 12, rows: 8, columnGutter: 24, rowGutter: 20, baseline: 16 },
        items: [
          {
            id: 'hero-media',
            role: 'graphic',
            semantic: 'hero-media',
            sourceNode: {
              tagName: 'img',
              id: 'hero-media',
              classList: ['hero-media'],
              attributes: {
                src: '../smoke-assets/photos/industrial-site.jpg',
                alt: 'industrial roof aerial',
                'data-id-object': '',
              },
            },
            structure: { parentId: 'cover-page', order: 1, containerPolicy: 'leaf' },
            layout: { grid: { col: 1, span: 12, row: 1, rowSpan: 8 }, cssVars: { '--grid-col': '1', '--grid-span': '12', '--grid-row': '1', '--grid-row-span': '8' } },
            asset: { path: '../smoke-assets/photos/industrial-site.jpg', graphicType: 'image' },
          },
          {
            id: 'pdf-source',
            role: 'graphic',
            semantic: 'drawing-pdf',
            sourceNode: {
              tagName: 'object',
              id: 'pdf-source',
              classList: ['pdf-source'],
              attributes: {
                data: '../reference-pdfs/ice-rink-layout-reference.pdf',
                type: 'application/pdf',
                'data-id-object': '',
                'data-id-pdf-page': '1',
              },
            },
            structure: { parentId: 'cover-page', order: 2, containerPolicy: 'leaf' },
            layout: { grid: { col: 7, span: 5, row: 2, rowSpan: 5 }, cssVars: { '--grid-col': '7', '--grid-span': '5', '--grid-row': '2', '--grid-row-span': '5' } },
            asset: { path: '../reference-pdfs/ice-rink-layout-reference.pdf', graphicType: 'pdf' },
          },
        ],
      },
    ],
  };
}
```

Expected failure:

```text
AssertionError: input did not match /<img/
```

- [x] **Step 2: Add failing tests for nested author tree rendering**

Create `test/indesign-reverse/author-html-tree.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { pageItemsToAuthorHtml } = require('../../src/indesign-reverse/author-html-tree');

test('pageItemsToAuthorHtml nests children under source parent items', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'card-1',
        role: 'shape',
        sourceNode: { tagName: 'div', id: 'card-1', classList: ['metric-card', 'grid-item'], attributes: { 'data-id-object': '' } },
        structure: { parentId: 'agenda-page', order: 1 },
        layout: { cssVars: { '--grid-col': '1', '--grid-span': '3', '--grid-row': '6', '--grid-row-span': '1' } },
      },
      {
        id: 'card-1-value',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'card-1-value', classList: ['metric-value'], attributes: { 'data-id-paragraph-style': 'metric-value' } },
        structure: { parentId: 'card-1', order: 1 },
        content: { text: '243.75m' },
      },
      {
        id: 'card-1-label',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'card-1-label', classList: ['metric-label'], attributes: { 'data-id-paragraph-style': 'metric-label' } },
        structure: { parentId: 'card-1', order: 2 },
        content: { text: 'grid length' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div[^>]+id="card-1"[^>]*>/);
  assert.match(html, /<div[^>]+id="card-1"[\s\S]*<p[^>]+id="card-1-value"[\s\S]*243\.75m[\s\S]*<\/p>[\s\S]*<p[^>]+id="card-1-label"[\s\S]*grid length[\s\S]*<\/p>[\s\S]*<\/div>/);
});
```

Expected failure:

```text
Cannot find module '../../src/indesign-reverse/author-html-tree'
```

- [x] **Step 3: Run the new focused tests and confirm red**

Run:

```powershell
node --test test/indesign-reverse/author-package-writer.test.js test/indesign-reverse/author-html-tree.test.js
```

Expected:

```text
fail
```

## Task 2: Implement Attribute and Resource Tag Rendering

**Files:**

- Create: `src/indesign-reverse/author-attribute-writer.js`
- Create: `src/indesign-reverse/author-html-tree.js`
- Modify: `src/indesign-reverse/author-package-writer.js`

- [x] **Step 1: Create attribute writer**

Create `src/indesign-reverse/author-attribute-writer.js`:

```js
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BOOLEAN_ATTRIBUTES = new Set(['allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'defer', 'disabled', 'hidden', 'loop', 'muted', 'open', 'playsinline', 'readonly', 'required', 'selected']);
const BLOCKED_ATTRIBUTES = new Set(['style']);

function mergeAttributes(...sources) {
  const out = new Map();
  for (const source of sources) {
    for (const [name, value] of Object.entries(source || {})) {
      const key = normalizeAttrName(name);
      if (!key || BLOCKED_ATTRIBUTES.has(key)) continue;
      if (key === 'class' || key === 'id') continue;
      if (!out.has(key)) out.set(key, value == null ? '' : String(value));
    }
  }
  return Object.fromEntries(out);
}

function attrsToHtml(attrs) {
  return Object.entries(attrs || {}).map(([name, value]) => {
    const key = normalizeAttrName(name);
    if (!key) return '';
    if (BOOLEAN_ATTRIBUTES.has(key) && (value === '' || value === true || value === key)) return key;
    return `${key}="${attr(value)}"`;
  }).filter(Boolean).join(' ');
}

function normalizeAttrName(name) {
  const key = String(name || '').trim().toLowerCase();
  return /^[a-z_:][a-z0-9_:.-]*$/.test(key) ? key : '';
}

function isVoidTag(tagName) {
  return VOID_TAGS.has(String(tagName || '').toLowerCase());
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  mergeAttributes,
  attrsToHtml,
  isVoidTag,
  escapeHtml,
  attr,
};
```

- [x] **Step 2: Create author HTML tree renderer**

Create `src/indesign-reverse/author-html-tree.js`:

```js
const { mergeAttributes, attrsToHtml, isVoidTag, escapeHtml, attr } = require('./author-attribute-writer');

const SAFE_TAGS = new Set([
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figure', 'figcaption', 'img', 'object', 'embed', 'picture', 'source',
  'svg', 'canvas', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'strong', 'em', 'small', 'sup', 'sub',
]);

function pageItemsToAuthorHtml(page, options = {}) {
  const tree = buildAuthorTree(page);
  return tree.map((node) => renderNode(node, options, 0)).join('\n');
}

function buildAuthorTree(page) {
  const rootId = page.id;
  const nodes = new Map();
  const roots = [];
  for (const item of sortedItems(page.items || [])) {
    nodes.set(item.id, { item, children: [] });
  }
  for (const node of nodes.values()) {
    const parentId = node.item.structure && node.item.structure.parentId;
    if (parentId && parentId !== rootId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of nodes.values()) node.children.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
  return roots.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
}

function renderNode(node, options, depth) {
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const tag = safeTag(sourceNode.tagName || item.tagName || tagForRole(item.role));
  const attrs = attrsForItem(item, sourceNode, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  if (isVoidTag(tag)) return `${indent(depth)}${open}`;
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const own = ownContent(item);
  if (children) {
    return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
  }
  return `${indent(depth)}${open}${own}</${tag}>`;
}

function attrsForItem(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item));
  attrs.id = sourceNode.id || item.id;
  const classes = new Set(sourceNode.classList || []);
  if (!classes.size) classes.add(options.mode === 'observation' ? 'id-object' : classForRole(item.role));
  if (item.layout && item.layout.cssVars) {
    attrs.style = Object.entries(item.layout.cssVars).map(([name, value]) => `${name}:${value}`).join(';');
  }
  attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text') attrs['data-id-object'] = '';
  if (item.semantic) attrs['data-id-semantic'] = item.semantic;
  return attrsToHtml(orderAttrs(attrs));
}

function assetAttributes(item) {
  const nodeAttrs = item.sourceNode && item.sourceNode.attributes || {};
  const asset = item.sourceAsset || item.asset || {};
  const out = {};
  const tag = item.sourceNode && String(item.sourceNode.tagName || '').toLowerCase();
  if (tag === 'img' && !nodeAttrs.src && asset.path) out.src = asset.path;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.data && asset.path) out.data = asset.path;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.type && asset.graphicType === 'pdf') out.type = 'application/pdf';
  return out;
}

function ownContent(item) {
  if (item.role === 'table' && item.table) return tableContent(item.table);
  return escapeHtml((item.content && item.content.text) || '').replace(/\r\n|\r|\n/g, '<br>');
}

function tableContent(table) {
  return (table.rows || []).map((row) => `<tr>${(row.cells || []).map((cell) => {
    const tag = cell.header ? 'th' : 'td';
    return `<${tag}>${escapeHtml(cell.text || '')}</${tag}>`;
  }).join('')}</tr>`).join('');
}

function orderAttrs(attrs) {
  const out = {};
  for (const key of ['id', 'class', 'src', 'data', 'type', 'alt', 'title', 'role', 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function sortedItems(items) {
  return items.slice().sort((a, b) => structureOrder(a) - structureOrder(b));
}

function structureOrder(item) {
  const order = item.structure && Number(item.structure.order);
  return Number.isFinite(order) ? order : 0;
}

function hasDataIdObject(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, 'data-id-object');
}

function safeTag(value) {
  const tag = String(value || '').toLowerCase();
  return SAFE_TAGS.has(tag) ? tag : 'div';
}

function tagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'table') return 'table';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function classForRole(role) {
  return role === 'graphic' ? 'graphic-object' : 'id-object';
}

function indent(spaces) {
  return ' '.repeat(spaces);
}

module.exports = {
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
```

- [x] **Step 3: Replace flat item rendering in author package writer**

Modify `src/indesign-reverse/author-package-writer.js`:

```js
const { pageItemsToAuthorHtml } = require('./author-html-tree');
const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
```

Replace the body of `pageHtml`:

```js
function pageHtml(page, sourceFile, options) {
  const attrs = sourcePageAttrs(page, sourceFile, options);
  const items = pageItemsToAuthorHtml(page, options);
  return [`<section ${attrs}>`, indent(items, 2), '</section>', ''].join('\n');
}
```

Replace `sourcePageAttrs` with a de-duplicating string writer:

```js
function sourcePageAttrs(page, sourceFile, options) {
  const sourceNode = page.sourceNode || {};
  const attrs = mergeAttributes(sourceNode.attributes);
  attrs.class = sourceNode.classList && sourceNode.classList.length ? sourceNode.classList.join(' ') : 'page';
  attrs.id = sourceNode.id || page.id;
  attrs['data-page'] = page.semantic || page.id;
  attrs['data-id-source-file'] = sourceFile;
  if (options.mode === 'observation' || page.semantic === 'unknown') attrs['data-id-observed'] = 'true';
  if (options.mode) attrs['data-id-reverse-mode'] = options.mode;
  if (page.grid) {
    attrs['data-id-grid'] = attrs['data-id-grid'] || `${page.grid.columns}x${page.grid.rows}`;
    if (page.grid.columnGutter != null) attrs['data-id-column-gutter'] = attrs['data-id-column-gutter'] || `${page.grid.columnGutter}px`;
    if (page.grid.rowGutter != null) attrs['data-id-row-gutter'] = attrs['data-id-row-gutter'] || `${page.grid.rowGutter}px`;
    if (page.grid.baseline != null) attrs['data-id-baseline'] = attrs['data-id-baseline'] || `${page.grid.baseline}px`;
  }
  return attrsToHtml(orderPageAttrs(attrs));
}
```

Add helper:

```js
function orderPageAttrs(attrs) {
  const out = {};
  for (const key of ['id', 'class', 'data-page', 'data-id-source-file', 'data-id-layout', 'data-id-grid', 'data-id-column-gutter', 'data-id-row-gutter', 'data-id-baseline', 'data-id-observed', 'data-id-reverse-mode', 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}
```

Remove old `itemHtml`, `itemClasses`, `gridStyle`, `itemContent`, `tableContent`, `safeTag`, and `tagForRole` from `author-package-writer.js` after tests pass.

- [x] **Step 4: Run focused tests**

Run:

```powershell
node --test test/indesign-reverse/author-package-writer.test.js test/indesign-reverse/author-html-tree.test.js
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```powershell
git add src/indesign-reverse/author-attribute-writer.js src/indesign-reverse/author-html-tree.js src/indesign-reverse/author-package-writer.js test/indesign-reverse/author-package-writer.test.js test/indesign-reverse/author-html-tree.test.js
git commit -m "feat: restore editable reverse author html tags"
```

## Task 3: Preserve DOM Parent Relationships Through Labels

**Files:**

- Modify: `src/paged-html/browser-snapshot.js`
- Modify: `src/semantic-model/from-snapshot.js`
- Modify: `src/paged-html/source-metadata.js`
- Modify: `test/paged-html/source-metadata.test.js`
- Modify: `test/semantic-model/from-snapshot.test.js`

- [x] **Step 1: Add failing source metadata tests for stable attributes**

Append to `test/paged-html/source-metadata.test.js`:

```js
test('sourceNodeForSnapshotItem preserves stable resource and data attributes', () => {
  const node = sourceNodeForSnapshotItem({
    tagName: 'object',
    id: 'pdf-source',
    classList: ['pdf-source'],
    attributes: {
      id: 'pdf-source',
      class: 'pdf-source',
      data: '../reference-pdfs/ice-rink-layout-reference.pdf',
      type: 'application/pdf',
      'data-asset-kind': 'pdf',
      'data-id-pdf-page': '1',
      loading: 'lazy',
      decoding: 'async',
      style: 'position:absolute',
    },
  });

  assert.deepEqual(node.attributes, {
    data: '../reference-pdfs/ice-rink-layout-reference.pdf',
    type: 'application/pdf',
    'data-asset-kind': 'pdf',
    'data-id-pdf-page': '1',
    loading: 'lazy',
    decoding: 'async',
  });
});
```

Expected failure:

```text
AssertionError
```

- [x] **Step 2: Add failing semantic model test for nearest parent**

Append to `test/semantic-model/from-snapshot.test.js`:

```js
test('snapshotToSemanticModel uses nearest candidate ancestor as structure parent', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'page-1', 'data-id-grid': '12x6' },
      computedStyle: {},
      items: [
        {
          id: 'card-1',
          role: 'shape',
          tagName: 'div',
          classList: ['metric-card'],
          attributes: { 'data-id-object': '' },
          sourceNode: { tagName: 'div', id: 'card-1', classList: ['metric-card'], attributes: { 'data-id-object': '' } },
          documentOrder: 1,
          rectPx: { x: 10, y: 10, width: 300, height: 120 },
        },
        {
          id: 'card-1-value',
          role: 'text',
          tagName: 'p',
          classList: ['metric-value'],
          attributes: { 'data-id-paragraph-style': 'metric-value' },
          sourceNode: { tagName: 'p', id: 'card-1-value', classList: ['metric-value'], attributes: { 'data-id-paragraph-style': 'metric-value' } },
          ancestorCandidateIds: ['card-1'],
          documentOrder: 2,
          text: '243.75m',
          rectPx: { x: 20, y: 20, width: 200, height: 40 },
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  assert.equal(model.pages[0].items[1].structure.parentId, 'card-1');
});
```

Expected failure:

```text
AssertionError: expected "page-1" to equal "card-1"
```

- [x] **Step 3: Expand stable attribute capture**

Modify `src/paged-html/source-metadata.js`:

```js
const STABLE_ATTRIBUTE_RE = /^(data-|aria-|role$|href$|src$|srcset$|sizes$|alt$|title$|data$|type$|width$|height$|loading$|decoding$|crossorigin$|referrerpolicy$|media$|poster$)/i;
```

Keep dropping `id`, `class`, and `style`. Preserve `data-id-ignore` only when it belongs to a captured source node; ignored DOM nodes still must not become mappable InDesign items.

- [x] **Step 4: Capture ancestor candidate ids in browser snapshot**

In `src/paged-html/browser-snapshot.js`, add a browser-side helper near `ancestorCandidateIndexes`:

```js
function ancestorCandidateIds(el, candidates, pageIndex) {
  const ids = [];
  let current = el.parentElement;
  while (current) {
    const index = candidates.indexOf(current);
    if (index >= 0) ids.push(itemIdFor(current, visualFrameFor(current), pageIndex, index));
    current = current.parentElement;
  }
  return ids;
}
```

Use the current page index when calling `itemIdFor`:

```js
ancestorCandidateIds: ancestorCandidateIds(el, candidates, pageIndex),
```

If the existing helper already receives indexes, update it to return item ids rather than only numeric indexes. Preserve `ancestorCandidateIndexes` for compatibility while adding `ancestorCandidateIds`.

- [x] **Step 5: Use nearest ancestor in semantic model**

Modify `itemModelFor` in `src/semantic-model/from-snapshot.js`:

```js
const parentId = nearestSourceParentId(item, page);
const structure = { parentId, order: item.documentOrder || 0, containerPolicy: parentId === page.id ? 'group' : 'child' };
```

Add helper:

```js
function nearestSourceParentId(item, page) {
  const ids = item.ancestorCandidateIds || [];
  for (const id of ids) {
    if ((page.items || []).some((candidate) => candidate.id === id)) return id;
  }
  return page.id;
}
```

- [x] **Step 6: Run metadata and semantic tests**

Run:

```powershell
node --test test/paged-html/source-metadata.test.js test/semantic-model/from-snapshot.test.js
```

Expected:

```text
pass
```

- [ ] **Step 7: Commit**

```powershell
git add src/paged-html/browser-snapshot.js src/paged-html/source-metadata.js src/semantic-model/from-snapshot.js test/paged-html/source-metadata.test.js test/semantic-model/from-snapshot.test.js
git commit -m "feat: preserve reverse author dom structure"
```

## Task 4: Make Reverse Author CSS Grid-First

**Files:**

- Modify: `src/indesign-reverse/author-css-writer.js`
- Modify: `src/indesign-reverse/author-package-writer.js`
- Modify: `test/indesign-reverse/author-package-writer.test.js`

- [x] **Step 1: Add failing tests for grid-first author CSS**

Append to `test/indesign-reverse/author-package-writer.test.js`:

```js
test('writeReverseAuthorPackage emits grid-first layout css and avoids absolute overrides for grid items', () => {
  const outDir = path.resolve('test/workspace/reverse-author-grid-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(taggedModel(), { outDir, mode: 'authoring' });

  const layoutCss = fs.readFileSync(path.join(outDir, 'styles/layout.css'), 'utf8');
  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');
  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');

  assert.match(layoutCss, /\.page \{[\s\S]*display: grid/);
  assert.match(layoutCss, /grid-template-columns: repeat\(var\(--id-grid-columns, 12\), minmax\(0, 1fr\)\)/);
  assert.match(layoutCss, /\.grid-item \{[\s\S]*grid-column: var\(--grid-col\) \/ span var\(--grid-span, 1\)/);
  assert.match(pageHtml, /style="[^"]*--id-grid-columns:12/);
  assert.doesNotMatch(overrides, /#agenda-title/);
});
```

Expected failure:

```text
AssertionError: input did not match /display: grid/
```

- [x] **Step 2: Emit page grid CSS variables**

Modify `sourcePageAttrs` in `src/indesign-reverse/author-package-writer.js` so page `style` contains grid and margin variables:

```js
const style = pageStyleVars(page);
if (style) attrs.style = style;
```

Add helper:

```js
function pageStyleVars(page) {
  const pairs = [];
  if (page.grid) {
    pairs.push(['--id-grid-columns', page.grid.columns]);
    pairs.push(['--id-grid-rows', page.grid.rows]);
    if (page.grid.columnGutter != null) pairs.push(['--id-column-gutter', `${page.grid.columnGutter}px`]);
    if (page.grid.rowGutter != null) pairs.push(['--id-row-gutter', `${page.grid.rowGutter}px`]);
    if (page.grid.baseline != null) pairs.push(['--id-baseline', `${page.grid.baseline}px`]);
  }
  if (page.margins) {
    pairs.push(['--id-margin-top', `${page.margins.top}px`]);
    pairs.push(['--id-margin-right', `${page.margins.right}px`]);
    pairs.push(['--id-margin-bottom', `${page.margins.bottom}px`]);
    pairs.push(['--id-margin-left', `${page.margins.left}px`]);
  }
  return pairs.map(([name, value]) => `${name}:${value}`).join(';');
}
```

Ensure `sourcePageAttrs` skips existing `style` from `sourceNode.attributes`.

- [x] **Step 3: Rewrite author layout CSS**

Modify `layoutCss` in `src/indesign-reverse/author-css-writer.js`:

```js
function layoutCss(model) {
  const first = (model.pages && model.pages[0]) || {};
  return [
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #f3f5f6; color: var(--id-text); font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '.deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `.page { width: ${px(first.width || 0)}; height: ${px(first.height || 0)}; background: var(--id-page-bg); overflow: hidden; position: relative; display: grid; grid-template-columns: repeat(var(--id-grid-columns, 12), minmax(0, 1fr)); grid-template-rows: repeat(var(--id-grid-rows, 8), minmax(0, 1fr)); column-gap: var(--id-column-gutter, 0px); row-gap: var(--id-row-gutter, 0px); padding: var(--id-margin-top, 0px) var(--id-margin-right, 0px) var(--id-margin-bottom, 0px) var(--id-margin-left, 0px); }`,
    '.grid-item { grid-column: var(--grid-col) / span var(--grid-span, 1); grid-row: var(--grid-row) / span var(--grid-row-span, 1); min-width: 0; min-height: 0; }',
    '.id-object { margin: 0; overflow: hidden; }',
    '',
  ].join('\n');
}
```

Keep `reverseOverridesCss` unchanged for items without `layout.grid`.

- [x] **Step 4: Run author package tests**

Run:

```powershell
node --test test/indesign-reverse/author-package-writer.test.js
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit**

```powershell
git add src/indesign-reverse/author-css-writer.js src/indesign-reverse/author-package-writer.js test/indesign-reverse/author-package-writer.test.js
git commit -m "feat: emit grid first reverse author css"
```

## Task 5: Add Reverse Author Package Audit

**Files:**

- Create: `src/indesign-reverse/author-audit.js`
- Modify: `src/indesign-reverse/index.js`
- Modify: `scripts/indesign-e2e.js`
- Create: `test/indesign-reverse/author-audit.test.js`
- Modify: `test/indesign-e2e-runner.test.js`

- [x] **Step 1: Add failing audit tests**

Create `test/indesign-reverse/author-audit.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { auditReverseAuthorPackage } = require('../../src/indesign-reverse/author-audit');

test('auditReverseAuthorPackage rejects div resource placeholders and duplicate attributes', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-bad');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'bad',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-cover.html'), '<section data-id-grid="12x8" data-id-grid="12x8"><div src="../a.jpg"></div></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { position: relative; }', 'utf8');

  const audit = auditReverseAuthorPackage(outDir);

  assert.equal(audit.ok, false);
  assert.deepEqual(audit.errors.map((error) => error.code).sort(), ['AUTHOR_DIV_RESOURCE_PLACEHOLDER', 'AUTHOR_DUPLICATE_ATTRIBUTE', 'AUTHOR_GRID_CSS_MISSING'].sort());
});
```

Expected failure:

```text
Cannot find module '../../src/indesign-reverse/author-audit'
```

- [x] **Step 2: Implement author audit**

Create `src/indesign-reverse/author-audit.js`:

```js
const fs = require('fs');
const path = require('path');

function auditReverseAuthorPackage(outDir) {
  const root = path.resolve(outDir);
  const errors = [];
  const warnings = [];
  const configPath = path.join(root, 'deck.config.json');
  if (!fs.existsSync(configPath)) {
    errors.push(error('AUTHOR_CONFIG_MISSING', 'author/deck.config.json is missing.', 'deck.config.json'));
    return result(errors, warnings, { pages: 0 });
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pages = config.pages || [];
  for (const page of pages) {
    const file = path.join(root, page.file);
    if (!fs.existsSync(file)) {
      errors.push(error('AUTHOR_PAGE_MISSING', `Author page is missing: ${page.file}`, page.file));
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    scanDuplicateAttributes(html, page.file, errors);
    scanResourcePlaceholders(html, page.file, errors);
  }
  const layoutCss = readOptional(root, 'styles/layout.css');
  if (!/display:\s*grid/.test(layoutCss) || !/grid-template-columns/.test(layoutCss)) {
    errors.push(error('AUTHOR_GRID_CSS_MISSING', 'styles/layout.css must define grid-first page layout.', 'styles/layout.css'));
  }
  return result(errors, warnings, { pages: pages.length });
}

function scanDuplicateAttributes(html, file, errors) {
  const tagRe = /<([a-zA-Z][\w:-]*)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(html))) {
    const attrs = new Set();
    const attrRe = /\s([a-zA-Z_:][\w:.-]*)(?:\s*=|\s|$)/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(match[2]))) {
      const name = attrMatch[1].toLowerCase();
      if (attrs.has(name)) {
        errors.push(error('AUTHOR_DUPLICATE_ATTRIBUTE', `Duplicate attribute ${name}.`, file));
        break;
      }
      attrs.add(name);
    }
  }
}

function scanResourcePlaceholders(html, file, errors) {
  if (/<div\b[^>]*(?:\ssrc=|\sdata=)[^>]*>/i.test(html)) {
    errors.push(error('AUTHOR_DIV_RESOURCE_PLACEHOLDER', 'Resource source/data attributes must not be written on div placeholders.', file));
  }
}

function readOptional(root, relativePath) {
  const file = path.join(root, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function error(code, message, file) {
  return { code, message, file };
}

function result(errors, warnings, stats) {
  return { ok: errors.length === 0, errors, warnings, stats };
}

module.exports = {
  auditReverseAuthorPackage,
};
```

- [x] **Step 3: Export audit and connect E2E**

Modify `src/indesign-reverse/index.js`:

```js
module.exports = Object.assign(
  {},
  require('./snapshot-reader'),
  require('./reverse-model'),
  require('./html-writer'),
  require('./legacy-blueprint'),
  require('./author-package-writer'),
  require('./author-audit')
);
```

Modify `scripts/indesign-e2e.js` existing author package audit function so it calls `auditReverseAuthorPackage(author.outDir)` and fails when `audit.ok` is false. Preserve existing `checkAuthorPackageEntry` page count checks.

- [x] **Step 4: Add E2E runner test for audit integration**

Append to `test/indesign-e2e-runner.test.js`:

```js
test('auditReverseAuthorPackage includes editable author html checks', () => {
  const { auditReverseAuthorPackage } = require('../scripts/indesign-e2e');
  assert.equal(typeof auditReverseAuthorPackage, 'function');
});
```

- [x] **Step 5: Run audit tests**

Run:

```powershell
node --test test/indesign-reverse/author-audit.test.js test/indesign-e2e-runner.test.js
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit**

```powershell
git add src/indesign-reverse/author-audit.js src/indesign-reverse/index.js scripts/indesign-e2e.js test/indesign-reverse/author-audit.test.js test/indesign-e2e-runner.test.js
git commit -m "test: audit reverse author html quality"
```

## Task 6: Verify Against Architecture Fixture

**Files:**

- Modify only if verification exposes a concrete bug.

- [x] **Step 1: Run focused reverse tests**

Run:

```powershell
node --test test/paged-html/source-metadata.test.js test/semantic-model/from-snapshot.test.js test/indesign-reverse/author-html-tree.test.js test/indesign-reverse/author-package-writer.test.js test/indesign-reverse/author-audit.test.js test/indesign-reverse/cli.test.js
```

Expected:

```text
pass
```

- [x] **Step 2: Run full unit suite**

Run:

```powershell
npm test
```

Expected:

```text
pass
```

- [x] **Step 3: Run real InDesign reverse roundtrip**

Run:

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip
```

Expected:

```text
ok: true
reverse.html.author.audit.ok: true
oversetTextFrames: 0
```

- [x] **Step 4: Inspect generated author package with simple static checks**

Replace `<RUN_DIR>` with the run directory printed by Step 3:

```powershell
$author = "test/workspace/<RUN_DIR>/reverse-html/author"
rg -n "<div[^>]+(src|data)=" $author/pages
rg -n "data-id-grid=.*data-id-grid" $author/pages
rg -n "<img|<object" $author/pages
rg -n "display: grid|grid-template-columns" $author/styles/layout.css
```

Expected:

```text
first command: no matches
second command: no matches
third command: at least one image/object match for the architecture fixture
fourth command: matches grid CSS rules
```

- [x] **Step 5: Commit final verification record if files changed**

If tests or docs were adjusted during verification:

```powershell
git add src test scripts docs
git commit -m "chore: verify reverse author html editability"
```

If no files changed, do not create an empty commit.

## Task 7: Document Author Source Restoration Rules

**Files:**

- Modify: `docs/规范/REVERSE_EXPORT.md`
- Modify: `docs/规范/SEMANTIC_PROTOCOL.md`
- Modify: `docs/superpowers/plans/2026-05-26-reverse-author-html-editability.md`

- [x] **Step 1: Update reverse export spec**

Add to `docs/规范/REVERSE_EXPORT.md` under `4.1 视觉 HTML 与作者入口`:

```text
作者源码包的目标不是像素对照，而是可继续编辑。`author/pages/*.html` 必须优先恢复原始作者标签、class、稳定属性、资源引用和可表达的父子结构。图片、PDF、SVG、AI/PSD 预览等资源元素不得退化为带 `src` 或 `data` 属性的 `div`。有网格信息的对象应保留为 CSS Grid 约束；绝对定位只用于缺少网格或无法映射的观察对象。
```

- [x] **Step 2: Update semantic protocol**

Add to `docs/规范/SEMANTIC_PROTOCOL.md` under `源码包来源字段`:

```text
`sourceNode` 描述作者源码节点，反向作者源码包必须优先使用它恢复标签名、class 和稳定属性。`sourceAsset` 描述作者源码中的资源引用，服务 `img`、`object`、`embed`、`picture` 等标签恢复。`structure.parentId` 描述作者源码父子关系；当它指向同页对象时，反向源码包应嵌套输出，而不是平铺。
```

- [x] **Step 3: Mark plan verification progress**

Update this plan’s checkboxes as tasks complete during execution. Do not batch all progress updates at the end.

- [x] **Step 4: Commit docs**

```powershell
git add docs/规范/REVERSE_EXPORT.md docs/规范/SEMANTIC_PROTOCOL.md docs/superpowers/plans/2026-05-26-reverse-author-html-editability.md
git commit -m "docs: specify reverse author html restoration"
```

## Self-Review

### Spec Coverage

| Requirement | Covered by |
| ----------- | ---------- |
| 作者 HTML 更利于编辑 | Tasks 1, 2, 4, 5 |
| 更利于还原原始 HTML | Tasks 2, 3, 7 |
| 资源元素不退化成 `div` | Tasks 1, 2, 5 |
| 恢复卡片、图框等嵌套结构 | Tasks 1, 2, 3 |
| 网格优先而非绝对定位优先 | Task 4 |
| 重复属性和非法属性可测 | Tasks 2, 5 |
| 真实 InDesign 回环验证 | Task 6 |
| 不影响视觉 HTML 职责 | Scope, Tasks 2, 4 |

### File Size Guard

| File | Guard |
| ---- | ----- |
| `src/indesign-reverse/author-package-writer.js` | 只做写包编排、页面属性和报告入口；超过 220 行继续拆 |
| `src/indesign-reverse/author-html-tree.js` | 只做树构建和 HTML 渲染；超过 260 行拆出 `author-resource-renderer.js` |
| `src/indesign-reverse/author-attribute-writer.js` | 只做属性合并、转义、void 标签判断；超过 180 行拆验证器 |
| `src/indesign-reverse/author-css-writer.js` | 只做 CSS 文件内容生成；超过 240 行按 tokens/layout/components/overrides 拆文件 |
| `scripts/indesign-e2e.js` | 只接入审计结果，不放 HTML 扫描细节 |

### Intentional Gaps

- 未标注 InDesign 的高质量语义推断仍走 observation/inferred 路线，不在本计划中冒充原始源码。
- 装饰碎片合并需要更强的来源标签或几何推断；本计划先保证带来源标签的结构可恢复。
- 原始 CSS 注释、选择器顺序和手写格式不恢复；反向作者 CSS 输出规范化结构。
- 真实浏览器视觉差异比较不作为本计划硬门槛；本计划关注 author 包的可编辑性和源码还原质量。
