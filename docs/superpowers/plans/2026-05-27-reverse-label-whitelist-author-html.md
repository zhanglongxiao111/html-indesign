# 反向标签白名单与作者 HTML 稳定化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 InDesign 反向导出每次都按当前语义库复核标签，不可信标签降级为观察信息，同时让反向作者 HTML 保留真实字体样式和 NAS 原位资源引用。

**Architecture:** 在 `src/indesign-reverse/` 增加独立的标签复核层和资源路径策略层，反向模型只接收“有效标签事实”和“观察标签事实”两类明确数据。`deck.visual.html` 继续负责视觉观察，`author/` 输出负责可编辑源码包：合规语义参与后续编译，不合规标签只保留观察痕迹；字体、颜色、行距、资源路径来自 InDesign 真实观察，不依赖旧模板 class。

**Tech Stack:** Node.js CommonJS、ExtendScript 反向快照、现有 semantic preset、`node:test`、真实 `indesign-cli` E2E、HTMLHub NAS `/nas/...` 路径约定。

---

## Scope

本计划实现：

- `html_indesign` 标签按当前项目语义库或标准语义库做白名单复核。
- 页面、对象和字段级标签支持局部有效：合规字段进入有效标签，不合规字段保留为观察标签。
- 反向作者 HTML 不再因为存在旧 `sourceNode` 就丢弃字体、颜色、行距、字距、对齐、内边距、多栏、层级等真实样式。
- 反向作者 HTML 自动挂载 `pstyle-*`、`cstyle-*`、`ostyle-*` 类，让生成 CSS 真正生效。
- NAS 素材默认原位引用；浏览器发布路径写成 `/nas/...`，原始 UNC 路径保留在 `data-id-asset-path`。
- PDF 预览图等必要派生物写入导出目录缓存，源 PDF 路径不被替换丢失。
- 报告列出接受、拒绝、降级观察的标签和原因。

本计划不实现：

- 不做智能视觉语义推断模型；只为后续 Agent 语义化提供干净观察 HTML 和报告。
- 不把不合规标签直接删除到不可追溯；它们会以观察状态保留。
- 不把 SA-public / HTMLHub 服务逻辑搬进本项目；本项目只输出可发布 NAS HTML。
- 不重写真实 InDesign CLI。

## File Structure

新增：

| 文件 | 责任 |
| ---- | ---- |
| `src/indesign-reverse/label-whitelist.js` | 校验 `html_indesign` 标签字段是否符合当前语义库，输出有效字段、观察字段和拒绝原因 |
| `src/indesign-reverse/author-style-attrs.js` | 把 `textStyle`、`textFrameStyle`、`inlineStyle`、`visualStyle`、`zIndex` 合并为作者 HTML 可见样式 |
| `src/indesign-reverse/asset-reference-policy.js` | 处理 `reference` / `copy` 资源策略、UNC 到 `/nas/...` 发布路径、PDF 预览缓存映射 |
| `src/shared/nas-paths.js` | 小型路径工具：UNC、`//host/share`、`/nas/...`、file URL 到 HTMLHub 可访问路径 |
| `test/indesign-reverse/label-whitelist.test.js` | 标签白名单和局部有效测试 |
| `test/indesign-reverse/asset-reference-policy.test.js` | NAS 原位引用、复制策略和 PDF 预览映射测试 |
| `test/shared/nas-paths.test.js` | UNC 到 `/nas/...` 的中文、空格、大小写主机名测试 |

修改：

| 文件 | 责任 |
| ---- | ---- |
| `src/indesign-reverse/reverse-model.js` | 调用标签复核层，把标签拆成 `effectiveLabel` 与 `observedLabel`，不可信字段不进入结构化字段 |
| `src/indesign-reverse/author-html-tree.js` | 输出有效语义、观察标签、样式类、真实视觉样式和资源路径 |
| `src/indesign-reverse/author-css-writer.js` | 补齐反向样式类和必要覆盖 CSS，避免 class 存在但 CSS 不生效 |
| `src/indesign-reverse/author-asset-packager.js` | 从默认复制改成默认引用；保留显式 `copy` 策略 |
| `src/indesign-reverse/author-package-writer.js` | 接入标签报告、资源策略报告和样式写出策略 |
| `scripts/indesign-reverse-export.js` | 增加 `--asset-policy reference|copy` 和 `--nas-public-root /nas` |
| `test/indesign-reverse/author-html-tree.test.js` | 增加字体样式、观察标签和样式类测试 |
| `test/indesign-reverse/author-package-writer.test.js` | 更新旧“默认复制素材”断言，显式 copy 才复制 |
| `docs/规范/REVERSE_EXPORT.md` | 记录标签复核、观察标签和 NAS 原位引用行为 |

## Data Contract

`PageItemModel` 增加这些字段：

```js
{
  labelStatus: 'accepted' | 'partial' | 'observed',
  effectiveLabel: {
    semantic: 'page-title',
    role: 'text',
    sourceNode: { tagName: 'h1', classList: ['page-title'], attributes: {} },
    structure: { parentId: 'cover-page', order: 2 },
    layout: { grid: { col: 1, span: 4, row: 1, rowSpan: 1 } }
  },
  observedLabel: {
    semantic: 'old-template-title',
    sourceNode: { tagName: 'h1', classList: ['old-title'], attributes: { 'data-old': '1' } },
    rejectionReasons: ['unknown-semantic', 'unknown-class-token']
  },
  rejectedFields: {
    semantic: 'unknown-semantic',
    sourceNode: 'unknown-class-token'
  }
}
```

规则：

- `effectiveLabel` 才能参与 `HTML -> InDesign` 正向编译。
- `observedLabel` 只用于报告、审查和给 Agent 观察，不参与编译。
- 页面级标签、容器标签和对象标签独立校验；父级不合规不导致子级语义自动失效。
- 父级结构不合规时，子级可保留自身有效语义，但不能继续信任不合规父级结构关系。
- 没有标签的对象仍按 InDesign 观察事实导出，不伪装成有效语义。

## Task 1: 标签白名单复核模块

**Files:**

- Create: `src/indesign-reverse/label-whitelist.js`
- Create: `test/indesign-reverse/label-whitelist.test.js`
- Modify: `src/indesign-reverse/index.js`

- [x] **Step 1: 写失败测试，覆盖全合规、局部合规、全观察三种状态**

Run after writing the test:

```powershell
node --test test/indesign-reverse/label-whitelist.test.js
```

Expected before implementation: fail with `Cannot find module '../../src/indesign-reverse/label-whitelist'`.

Test shape:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReverseLabel } = require('../../src/indesign-reverse/label-whitelist');

const preset = {
  semantics: {
    'page-title': { roles: ['text'] },
    'hero-image': { roles: ['graphic'] },
  },
  layouts: { 'cover-grid': {} },
  styles: {
    paragraphStyles: { 'page-title': {} },
    objectStyles: { 'hero-frame': {} },
  },
};

test('validateReverseLabel accepts fields present in the active semantic preset', () => {
  const result = validateReverseLabel({
    semantic: 'page-title',
    role: 'text',
    layout: 'cover-grid',
    styleRefs: { paragraphStyle: 'page-title' },
  }, { preset });

  assert.equal(result.status, 'accepted');
  assert.equal(result.effective.semantic, 'page-title');
  assert.deepEqual(result.rejectionReasons, []);
});

test('validateReverseLabel keeps valid semantic but rejects unknown structure fields', () => {
  const result = validateReverseLabel({
    semantic: 'page-title',
    role: 'text',
    layout: 'copied-template-grid',
    styleRefs: { paragraphStyle: 'missing-style' },
  }, { preset });

  assert.equal(result.status, 'partial');
  assert.equal(result.effective.semantic, 'page-title');
  assert.equal(result.effective.layout, null);
  assert.equal(result.observed.layout, 'copied-template-grid');
  assert.deepEqual(result.rejectionReasons.sort(), ['unknown-layout', 'unknown-paragraph-style'].sort());
});

test('validateReverseLabel observes unknown semantic instead of accepting copied labels', () => {
  const result = validateReverseLabel({ semantic: 'foreign-slot', role: 'text' }, { preset });

  assert.equal(result.status, 'observed');
  assert.equal(result.effective.semantic, null);
  assert.equal(result.observed.semantic, 'foreign-slot');
  assert.deepEqual(result.rejectionReasons, ['unknown-semantic']);
});
```

- [x] **Step 2: 实现 `validateReverseLabel`**

Implementation interface:

```js
function validateReverseLabel(label = {}, options = {}) {
  const preset = options.preset || {};
  const effective = {};
  const observed = {};
  const rejectedFields = {};
  const rejectionReasons = [];

  applySemantic(label, preset, effective, observed, rejectedFields, rejectionReasons);
  applyLayout(label, preset, effective, observed, rejectedFields, rejectionReasons);
  applyStyleRefs(label, preset, effective, observed, rejectedFields, rejectionReasons);
  applySourceNode(label, preset, effective, observed, rejectedFields, rejectionReasons);

  return {
    status: statusFor(effective, observed),
    effective,
    observed,
    rejectedFields,
    rejectionReasons,
  };
}

module.exports = { validateReverseLabel };
```

- [x] **Step 3: 导出模块并运行单测**

Run:

```powershell
node --test test/indesign-reverse/label-whitelist.test.js
```

Expected: pass.

## Task 2: 反向模型接入有效标签/观察标签

**Files:**

- Modify: `src/indesign-reverse/reverse-model.js`
- Modify: `test/indesign-reverse/reverse-model.test.js`

- [x] **Step 1: 写失败测试，证明不合规标签不会进入结构化字段**

Add a reverse model test where snapshot item label contains `semantic: 'foreign-slot'` and real InDesign facts contain `textStyle`.

Expected assertions:

```js
assert.equal(item.semantic, 'unknown');
assert.equal(item.labelStatus, 'observed');
assert.equal(item.effectiveLabel.semantic, null);
assert.equal(item.observedLabel.semantic, 'foreign-slot');
assert.equal(item.textStyle.pointSize, 32);
assert.equal(item.textStyle.fillColor, '#123456');
```

Run:

```powershell
node --test test/indesign-reverse/reverse-model.test.js
```

Expected before implementation: fail because model still trusts label semantic.

- [x] **Step 2: 在 `reverseSnapshotToSemanticModel` 中加载 active preset**

Use existing semantic preset loading path:

```js
const { loadStandardSemanticPreset } = require('../semantic-preset');
```

Rules:

- `options.semanticPreset` wins.
- `documentLabel.sourcePackage.profile` or `snapshot.metadata.profile` selects standard preset.
- If profile preset missing, use `architecture-report`.

- [x] **Step 3: 在 `reversePage` 和 `reverseItem` 中调用 `validateReverseLabel`**

Required behavior:

```js
const validation = validateReverseLabel(label, { preset, kind: 'item', page });
const effective = validation.effective;

return {
  semantic: effective.semantic || 'unknown',
  sourceNode: effective.sourceNode || null,
  sourceAncestorNodes: Array.isArray(effective.sourceAncestorNodes) ? effective.sourceAncestorNodes : [],
  structure: effective.structure || null,
  layout: effective.layout || null,
  labelStatus: validation.status,
  effectiveLabel: validation.effective,
  observedLabel: validation.observed,
  rejectedFields: validation.rejectedFields,
  rejectionReasons: validation.rejectionReasons,
  textStyle: item.textStyle || null,
  textFrameStyle: item.textFrameStyle || null,
  inlineStyle: item.inlineStyle || item.inlineCSS || null,
};
```

- [x] **Step 4: 运行模型测试**

Run:

```powershell
node --test test/indesign-reverse/reverse-model.test.js
```

Expected: pass.

## Task 3: 作者 HTML 写出真实样式与观察标签

**Files:**

- Create: `src/indesign-reverse/author-style-attrs.js`
- Modify: `src/indesign-reverse/author-html-tree.js`
- Modify: `src/indesign-reverse/author-css-writer.js`
- Modify: `test/indesign-reverse/author-html-tree.test.js`
- Modify: `test/indesign-reverse/author-package-writer.test.js`

- [x] **Step 1: 写失败测试，证明带 `sourceNode` 的文本也写出真实字体样式**

Test assertion:

```js
assert.match(html, /class="[^"]*pstyle-page-title/);
assert.match(html, /style="[^"]*font-size:32px/);
assert.match(html, /style="[^"]*color:#123456/);
assert.match(html, /style="[^"]*line-height:38px/);
assert.match(html, /data-id-observed-label-status="partial"/);
```

Run:

```powershell
node --test test/indesign-reverse/author-html-tree.test.js test/indesign-reverse/author-package-writer.test.js
```

Expected before implementation: fail because current writer prefers `sourceNode.attributes.style` and misses generated visual style.

- [x] **Step 2: 实现 `author-style-attrs.js`**

Public API:

```js
function authorInlineStyleForItem(item, sourceStyle) {
  return mergeCss([
    sourceStyle,
    textStyleCss(item.textStyle),
    textFrameStyleCss(item.textFrameStyle),
    cssForHtml(item.inlineStyle),
    zIndexCss(item.zIndex),
  ]);
}

function authorClassesForItem(item, sourceClasses, model) {
  const classes = new Set(sourceClasses || []);
  if (item.styleRefs && item.styleRefs.paragraphStyle) classes.add(`pstyle-${safeClass(item.styleRefs.paragraphStyle)}`);
  if (item.styleRefs && item.styleRefs.objectStyle) classes.add(`ostyle-${safeClass(item.styleRefs.objectStyle)}`);
  return Array.from(classes);
}

module.exports = { authorInlineStyleForItem, authorClassesForItem };
```

CSS conversion must use px because reverse snapshot uses presentation coordinates:

```js
if (textStyle.pointSize != null) styles.push(`font-size:${px(textStyle.pointSize)}`);
if (textStyle.leading != null) styles.push(`line-height:${px(textStyle.leading)}`);
if (textStyle.fillColor) styles.push(`color:${textStyle.fillColor}`);
```

- [x] **Step 3: `author-html-tree.js` 使用有效标签和观察标签**

Required behavior:

- Use `item.effectiveLabel.sourceNode` first.
- If no effective source node, use current `item.sourceNode` only when `item.labelStatus` is not `observed`.
- Emit observed data as inert attributes:

```html
data-id-observed-label-status="partial"
data-id-observed-reasons="unknown-layout unknown-paragraph-style"
```

- Do not emit rejected `data-id-semantic` as active semantic.

- [x] **Step 4: 运行作者 HTML 测试**

Run:

```powershell
node --test test/indesign-reverse/author-html-tree.test.js test/indesign-reverse/author-package-writer.test.js
```

Expected: pass.

## Task 4: NAS 原位资源策略

**Files:**

- Create: `src/shared/nas-paths.js`
- Create: `test/shared/nas-paths.test.js`
- Create: `src/indesign-reverse/asset-reference-policy.js`
- Create: `test/indesign-reverse/asset-reference-policy.test.js`
- Modify: `src/indesign-reverse/author-asset-packager.js`
- Modify: `src/indesign-reverse/author-package-writer.js`
- Modify: `scripts/indesign-reverse-export.js`
- Modify: `test/indesign-reverse/author-package-writer.test.js`

- [x] **Step 1: 写失败测试，覆盖 UNC 到 `/nas/...`**

Test cases:

```js
assert.equal(
  uncToNasUrl('\\\\daga-nas5\\daga-2025-project\\D0474_大兴城建\\图纸 A.pdf'),
  '/nas/daga-nas5/daga-2025-project/D0474_%E5%A4%A7%E5%85%B4%E5%9F%8E%E5%BB%BA/%E5%9B%BE%E7%BA%B8%20A.pdf'
);
assert.equal(uncToNasUrl('/nas/daga-nas5/share/a.png'), '/nas/daga-nas5/share/a.png');
assert.equal(uncToNasUrl('//Daga-nas5/share/a b.png'), '/nas/Daga-nas5/share/a%20b.png');
```

Run:

```powershell
node --test test/shared/nas-paths.test.js
```

- [x] **Step 2: 默认资源策略改成 `reference`**

Expected public API:

```js
function prepareAuthorAssets(model, options = {}) {
  const policy = options.assetPolicy || 'reference';
  if (policy === 'copy') return copyAuthorAssets(model, options);
  return referenceAuthorAssets(model, options);
}
```

`referenceAuthorAssets` returns:

```js
{
  pathMap,
  report: {
    policy: 'reference',
    referenced: 3,
    copied: 0,
    generated: 0,
    missing: [],
    entries: [
      {
        originalPath: '\\\\daga-nas5\\share\\a.png',
        htmlPath: '/nas/daga-nas5/share/a.png',
        reason: 'nas-reference'
      }
    ]
  }
}
```

- [x] **Step 3: 显式 `copy` 保留旧行为**

Update old copy tests to call:

```js
writeReverseAuthorPackage(resourceModel(), {
  outDir,
  sourceRoot,
  mode: 'authoring',
  assetPolicy: 'copy',
});
```

Add default reference assertion:

```js
assert.doesNotMatch(html, /src="assets\//);
assert.equal(result.report.assets.policy, 'reference');
assert.equal(result.report.assets.copied, 0);
```

- [x] **Step 4: CLI 接入参数**

Add args:

```powershell
--asset-policy reference|copy
--nas-public-root /nas
```

Usage string must include both options.

- [x] **Step 5: 运行资源相关测试**

Run:

```powershell
node --test test/shared/nas-paths.test.js test/indesign-reverse/asset-reference-policy.test.js test/indesign-reverse/author-package-writer.test.js
```

Expected: pass.

## Task 5: 报告与文档

**Files:**

- Modify: `src/indesign-reverse/author-package-writer.js`
- Modify: `docs/规范/REVERSE_EXPORT.md`
- Modify: `AGENTS.md` only if implementation reveals a sharper rule than the one already added

- [x] **Step 1: 报告写出标签复核摘要**

`reports/authoring-report.json` must include:

```json
{
  "labels": {
    "accepted": 12,
    "partial": 5,
    "observed": 8,
    "rejections": [
      {
        "pageId": "page-3",
        "itemId": "old-title",
        "reasons": ["unknown-semantic", "unknown-paragraph-style"]
      }
    ]
  }
}
```

- [x] **Step 2: 文档说明工作流**

`docs/规范/REVERSE_EXPORT.md` must describe:

- 首次人类 INDD 导出通常是观察 HTML。
- Agent 可从观察 HTML 重建白名单语义。
- Agent 也可直接观察 InDesign 后推断并写入白名单语义标签。
- 每次回读都重新复核标签，不能永久信任旧标签。
- NAS 原位引用是事务所内部默认策略。

- [x] **Step 3: 运行文档相关快速检查**

Run:

```powershell
rg -n "观察标签|白名单|NAS 原位|每次回读" AGENTS.md docs/规范/REVERSE_EXPORT.md
```

Expected: each concept appears at least once.

## Task 6: 全量验证与真实回读抽查

**Files:**

- Generated validation outputs must stay under `test/workspace/`.

- [x] **Step 1: 运行全量单元测试**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [x] **Step 2: 用现有架构汇报 fixture 跑真实 E2E 回读**

Run:

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip
```

Expected:

- `result_json.ok` is true.
- `reverse-html/author/deck.html` exists.
- `reports/authoring-report.json` includes `labels` and `assets`.
- No unexpected copied NAS source assets under `reverse-html/author/assets/` unless generated preview/cache is explicitly reported.

- [x] **Step 3: 对最新真实 NAS 导出样例做源码抽查**

Use the existing NAS output or rerun user-specified INDD export. Check generated author HTML:

```powershell
rg -n "font-size|line-height|color:|data-id-observed-label-status|/nas/|data-id-asset-path" "<reverse-html\\author>"
```

Expected:

- Text objects contain visible font styles or effective style classes.
- Rejected labels appear only as observed metadata.
- Browser-facing resource paths use `/nas/...`.
- Original UNC path is preserved in `data-id-asset-path`.

- [x] **Step 4: 更新 checklist 并准备提交**

Before final response:

```powershell
git status --short
```

Expected:

- Only intentional source, test, docs and plan files changed.
- No `test/workspace/` generated outputs staged.

Commit only after user approves or asks to commit:

```powershell
git add AGENTS.md docs/规范/REVERSE_EXPORT.md docs/superpowers/plans/2026-05-27-reverse-label-whitelist-author-html.md src test scripts
git commit -m "Plan reverse label whitelist and author html stabilization"
```

## Implementation Notes

- 当前执行按用户要求在主分支当前目录进行，不开 worktree。
- 执行过程中必须实时更新本计划 checkbox。
- 不要把不合规标签静默删除；降级观察必须可见、可测、可报告。
- 不要为了通过测试写只匹配当前 fixture 的特殊分支；所有逻辑必须基于语义库、标签状态、资源路径类型和 InDesign 观察事实。
- 不要把 HTMLHub 发布平台实现复制进本仓库；需要发布时调用 `D:\AI\SA-public` 的发布入口。
