# 人工 InDesign 无丢失回环稳定化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让人工 InDesign 反向导出的作者 HTML 能再次稳定生成 InDesign，并用可复现审计证明页面、文字、资源和作者结构没有丢失或继续漂移。

**Architecture:** 先建立内容库存和作者结构签名两个硬验收，再修复当前真实用例暴露的文本框溢出。语义重建算法只负责把观察对象组织成可编辑结构，白名单语义候选仍进入报告，由 Agent 或用户纠正；内容保真、资源保留、几何稳定和回环稳定必须由程序验证。

**Tech Stack:** Node.js CommonJS、`node:test`、Cheerio、现有 HTML writer audit、InDesign build instructions、ExtendScript executor、真实 `indesign-cli` E2E。

---

## Scope

本计划实现：

- 建立 `AuthorContentInventory`，从作者源码包、反向作者包和反向 `DocumentModel` 中抽取页数、页面尺寸、文字、资源、对象角色和关键几何。
- 建立 `AuthorStructureSignature`，比较作者 HTML 的可编辑结构稳定性，而不是比较每一行源码格式。
- 把内容库存和结构签名接入 `scripts/indesign-e2e.js` 的一次回读和二次回环。
- 把当前真实人工 InDesign 用例中的文本溢出从“失败报告”推进到“安全适配或明确 unresolved”。
- 为真实人工 InDesign 回环生成固定报告：`content-inventory-report.json`、`structure-signature-report.json`、`text-fit-report.json`。
- 更新长期规范，说明“结构保真必须程序保证，语义纠正可以交给 Agent”。

本计划不实现：

- 不做页面类型语义分类。
- 不把材料页、图纸页、目录页等页面语义写成有效白名单结果。
- 不靠缩小字体、隐藏文字、复制图片、白块遮挡或静默吞错通过回环。
- 不把算法写进 ExtendScript；ExtendScript 只做执行端可测的文本框适配和报告。

## 当前风险

| 风险 | 处理方式 |
| ---- | -------- |
| 当前工作区已有文本溢出诊断改动 | 执行本计划前先提交或纳入 Task 0，不得回退这些改动 |
| `hi_items.jsxinc` 已承担较多职责 | 新增文本适配放 `hi_text_fit.jsxinc`，`hi_items.jsxinc` 只调用 helper |
| 二次回环 strict source diff 对源码格式过敏 | 增加结构签名 diff，源码 exact diff 继续保留为辅助信号 |
| 真实人工 ID 可能存在不可安全修复的版式 | 进入 `TEXT_FIT_UNRESOLVED`，不能假成功 |

## Execution Progress

| Task | 状态 | 验收 |
| ---- | ---- | ---- |
| 0. 工作区前置收口 | completed | 当前文本溢出诊断已提交或明确纳入本计划 |
| 1. 内容库存审计 | completed | 单元测试能抓出文字、资源、页面和几何丢失 |
| 2. 作者结构签名审计 | completed | 二次作者包结构漂移可被稳定报告 |
| 3. E2E 审计接入 | completed | 一次回读和二次回环都会写出库存/结构报告 |
| 4. 指令层文本适配策略 | completed | 只有观察回读文本框默认启用安全适配 |
| 5. ExtendScript 文本框安全适配 | completed | 可安全扩框则不再 overset，不安全则失败并定位 |
| 6. 真实人工 InDesign 验证 | completed | 真实 47 页作者包一次回读和二次回环均通过内容/结构无丢失门槛，0 overset |
| 7. 文档和清理 | completed | 规范、AGENTS 入口和执行基线已同步内容/结构硬门槛 |
| 8. 规范母版家具指标 | completed | 真实 47 页作者包固定装饰对象提升率 1，误提率 0，页面残留率 0，二次回环稳定 |
| 9. 二轮结构快照归零 | completed | 规范化一轮生成 ID 与规范化二轮生成 ID 的 reverse snapshot 结构审计 `errors=0`、`warnings=0` |
| 10. 有效 diff 门禁 | completed | 原始人工 ID 对规范化输出按 P0/P1/P2 分级，P0 硬失败、P1 预算、P2 advisory，并接入二轮稳定审计 |

验证证据：

- `npm run e2e:indesign -- -- --html "\\daga-nas5\daga-2025-project\D0474_大兴城建\00_agent\indesign_demo\semantic-object-graph-20260603-023400\reverse-html-text-block\author\deck.html" --reverse-roundtrip --reverse-mode observation`：通过，47 页、595 对象、81 链接、0 overset。
- `npm run e2e:indesign -- -- --html "D:\AI\html-indesign\test\workspace\indesign-e2e-20260604-005034\reverse-html\author\deck.html" --reverse-roundtrip --reverse-mode observation --second-pass-roundtrip --skip-preview`：通过，47 页、595 对象、81 链接、0 overset。
- 二次回环手工对照：`canonical-content-inventory-report.json` 和 `canonical-structure-signature-report.json` 均为 `ok: true`；源码 exact drift 仅为 preview 文件名和 0.0001 级数值漂移。
- `node scripts\indesign-e2e.js --html test\workspace\original-vs-roundtrip-20260604\current-original-reverse-html-composer\author\deck.html --reverse-roundtrip --reverse-mode observation --skip-preview --run-dir test\workspace\indesign-e2e-parent-furniture-20260604-181615`：通过，47 页、81 链接、585 个页面对象、0 overset。
- `node scripts\indesign-e2e.js --html test\workspace\indesign-e2e-parent-furniture-20260604-181615\reverse-html\author\deck.html --reverse-roundtrip --reverse-mode observation --skip-preview --run-dir test\workspace\indesign-e2e-parent-furniture-second-20260604-182450`：通过，47 页、81 链接、585 个页面对象、0 overset。
- `npm run audit:parent-furniture -- -- --source test\workspace\original-vs-roundtrip-20260604\original-reverse-snapshot-composer.json --actual test\workspace\indesign-e2e-parent-furniture-20260604-181615\reverse-snapshot.json --second-pass test\workspace\indesign-e2e-parent-furniture-second-20260604-182450\reverse-snapshot.json --out test\workspace\indesign-e2e-parent-furniture-20260604-181615\parent-furniture-audit-second-pass.json`：通过，`sourceCandidateCount=3`，`promotedCount=3`，`missedCount=0`，`falsePromotionCount=0`，`promotionRate=1`，`falsePromotionRate=0`，`pageFurnitureResidueRate=0`，`stable=true`。
- `node --test test\indesign-executor\executor-script-static.test.js test\paged-html\style-compiler.test.js test\indesign-reverse\author-package-writer.test.js test\semantic-model\from-snapshot.test.js test\semantic-model\to-instructions.test.js test\indesign-reverse\author-html-tree.test.js test\indesign-reverse\reverse-model.test.js`：通过，`164 pass`，`0 fail`。
- `node scripts\indesign-e2e.js --html test\workspace\human-indesign-second-current-20260604-193505\reverse-html-fixed-src2\author\deck.html --reverse-roundtrip --reverse-mode observation --skip-preview --run-dir test\workspace\human-indesign-third-final-20260604-205104`：通过，47 页、81 链接、585 个页面对象、0 overset。
- `npm run audit:reverse-snapshot -- -- --expected test\workspace\human-indesign-second-current-20260604-193505\reverse-snapshot.json --actual test\workspace\human-indesign-third-final-20260604-205104\reverse-snapshot.json --out test\workspace\human-indesign-third-final-20260604-205104\reverse-snapshot-structure-second-pass-audit.json`：通过，`errors=0`，`warnings=0`。该指标只衡量“规范化一轮生成 ID -> 规范化二轮生成 ID”的结构稳定；原始人工 INDD 与规范化生成 ID 的差异仍是独立基线。
- `node scripts\indesign-e2e.js --html test\workspace\human-indesign-third-final-20260604-205104\reverse-html\author\deck.html --reverse-roundtrip --reverse-mode observation --skip-preview --run-dir test\workspace\human-indesign-fourth-stability-20260604-211029`：通过，47 页、81 链接、585 个页面对象、0 overset。
- `npm run audit:reverse-snapshot -- -- --expected test\workspace\human-indesign-third-final-20260604-205104\reverse-snapshot.json --actual test\workspace\human-indesign-fourth-stability-20260604-211029\reverse-snapshot.json --out test\workspace\human-indesign-fourth-stability-20260604-211029\reverse-snapshot-structure-repeat-audit.json`：通过，`errors=0`，`warnings=0`，说明再次回环仍保持结构稳定。
- `npm run audit:effective-diff -- -- --expected test\workspace\original-vs-roundtrip-20260604\original-reverse-snapshot-composer.json --actual test\workspace\human-indesign-third-final-20260604-205104\reverse-snapshot.json --stability-audit test\workspace\human-indesign-third-final-20260604-205104\reverse-snapshot-structure-second-pass-audit.json --stability-audit test\workspace\human-indesign-fourth-stability-20260604-211029\reverse-snapshot-structure-repeat-audit.json --require-stability-audits --out test\workspace\human-indesign-third-final-20260604-205104\effective-diff-baseline.json`：门禁按设计失败，当前基线 `P0=8`（`TEXT_CHANGED=6`、`ASSET_CHANGED=2`），`P1=999`，`P2=675`，二轮稳定审计 `ok=true`；下一阶段优先清 P0。

## File Structure

新增：

| 文件 | 责任 |
| ---- | ---- |
| `src/writers/html/audit/content-inventory.js` | 从作者包或 `DocumentModel` 抽取内容库存，并比较库存差异 |
| `src/writers/html/audit/structure-signature.js` | 从作者包抽取稳定结构签名，并比较父子结构、顺序、标签和资源结构 |
| `_indesign_scripts/lib/hi_text_fit.jsxinc` | InDesign 执行端文本框安全适配和 text-fit 报告 |
| `test/indesign-reverse/content-inventory.test.js` | 内容库存审计单元测试 |
| `test/indesign-reverse/structure-signature.test.js` | 作者结构签名审计单元测试 |

修改：

| 文件 | 责任 |
| ---- | ---- |
| `scripts/indesign-e2e.js` | 接入内容库存、结构签名、text-fit 报告和真实回环门槛 |
| `src/writers/indesign/text-instructions.js` | 生成文本框适配策略字段 |
| `src/writers/indesign/instruction-writer.js` | 把文本框适配策略写入 `TEXT` instructions |
| `src/writers/indesign/instructions-validator.js` | 校验 `item.textFit` 字段 |
| `_indesign_scripts/build_from_instructions.jsx` | include `hi_text_fit.jsxinc` |
| `_indesign_scripts/lib/hi_items.jsxinc` | 创建文本框后调用 `HI.resolveTextFrameOverflow` |
| `test/semantic-model/to-instructions.test.js` | 覆盖观察文本框的 `textFit` instruction |
| `test/paged-html/instructions-validator.test.js` | 覆盖 `textFit` schema |
| `test/indesign-executor/executor-script-static.test.js` | 覆盖新 JSX helper、include 顺序和报告字段 |
| `test/indesign-e2e-runner.test.js` | 覆盖 E2E 审计接入 |
| `docs/规范/SEMANTIC_RECONSTRUCTION.md` | 增加无丢失回环和结构稳定验收 |
| `AGENTS.md` | 同步当前架构入口和执行基线摘要 |

## Task 0: 工作区前置收口

**Files:**
- Read: `git status --short --branch`
- Modify: none unless current text overset diagnostic is still uncommitted

- [ ] **Step 1: 检查工作区**

Run:

```powershell
git status --short --branch
```

Expected if previous diagnostic is still uncommitted:

```text
## main...origin/main
 M _indesign_scripts/lib/hi_core.jsxinc
 M _indesign_scripts/lib/hi_items.jsxinc
 M scripts/indesign-e2e.js
 M test/indesign-e2e-runner.test.js
 M test/indesign-executor/executor-script-static.test.js
```

- [ ] **Step 2: 如果上述 5 个文件仍未提交，先做窄提交**

Run:

```powershell
git diff --check
git add _indesign_scripts/lib/hi_core.jsxinc _indesign_scripts/lib/hi_items.jsxinc scripts/indesign-e2e.js test/indesign-e2e-runner.test.js test/indesign-executor/executor-script-static.test.js
git diff --cached --check
git commit -m "fix(e2e): fail fast on overset text frames"
```

Expected:

```text
[main <hash>] fix(e2e): fail fast on overset text frames
```

- [ ] **Step 3: 确认计划实施起点**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## main...origin/main [ahead 1]
```

or clean if the diagnostic was already committed and pushed.

## Task 1: 内容库存审计

**Files:**
- Create: `src/writers/html/audit/content-inventory.js`
- Create: `test/indesign-reverse/content-inventory.test.js`

- [ ] **Step 1: 写失败测试**

Add `test/indesign-reverse/content-inventory.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  authorPackageContentInventory,
  documentModelContentInventory,
  compareContentInventories,
} = require('../../src/writers/html/audit/content-inventory');

test('compareContentInventories reports text resource page and geometry losses', () => {
  const root = path.resolve('test/workspace/content-inventory-loss');
  const sourceRoot = path.join(root, 'source');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page" style="width:1000px;height:600px"><p id="title">完整标题</p><img src="assets/site.png"></section>');
  writeFile(path.join(sourceRoot, 'assets/site.png'), 'image-bytes');

  const expected = authorPackageContentInventory(sourceRoot);
  const actual = {
    kind: 'AuthorContentInventory',
    pages: [{
      id: 'page-1',
      size: { width: 1000, height: 600 },
      textDigest: ['完整'],
      resources: [],
      itemRoles: [{ role: 'text', count: 1 }],
      geometry: [{ id: 'title', role: 'text', x: 0, y: 0, width: 0, height: 0 }],
    }],
    summary: { pages: 1, texts: 1, resources: 0, geometryItems: 1 },
  };

  const diff = compareContentInventories(expected, actual, { strictGeometry: true });

  assert.equal(diff.ok, false);
  assert.deepEqual(diff.errors.map((issue) => issue.code).sort(), [
    'CONTENT_GEOMETRY_CHANGED',
    'CONTENT_RESOURCE_MISSING',
    'CONTENT_TEXT_CHANGED',
  ].sort());
});

test('documentModelContentInventory preserves visible text and source resource identity', () => {
  const model = {
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [
        { id: 't1', role: 'text', bounds: { x: 10, y: 20, width: 300, height: 40 }, content: { text: '会议室屏幕尺寸 3x6.5m' } },
        { id: 'g1', role: 'graphic', bounds: { x: 20, y: 80, width: 500, height: 300 }, asset: { kind: 'pdf', path: '\\\\nas\\share\\drawing.pdf' } },
      ],
    }],
  };

  const inventory = documentModelContentInventory(model);

  assert.equal(inventory.summary.pages, 1);
  assert.equal(inventory.summary.texts, 1);
  assert.equal(inventory.summary.resources, 1);
  assert.deepEqual(inventory.pages[0].textDigest, ['会议室屏幕尺寸 3x6.5m']);
  assert.equal(inventory.pages[0].resources[0].identity, '\\\\nas\\share\\drawing.pdf');
});

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'inventory-fixture',
    title: 'Inventory Fixture',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
node --test test\indesign-reverse\content-inventory.test.js
```

Expected:

```text
not ok
Cannot find module '../../src/writers/html/audit/content-inventory'
```

- [ ] **Step 3: 实现库存审计模块**

Create `src/writers/html/audit/content-inventory.js`:

```js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function authorPackageContentInventory(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const pages = (config.pages || []).map((page) => {
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    return {
      id: page.id || page.file,
      size: pageSize($),
      textDigest: textDigest($),
      resources: resourceDigest($, packageRoot),
      itemRoles: roleDigest($),
      geometry: geometryDigest($),
    };
  });
  return inventoryResult(pages);
}

function documentModelContentInventory(model) {
  const pages = (model.pages || []).map((page) => {
    const items = Array.isArray(page.items) ? page.items : [];
    return {
      id: page.id || null,
      size: { width: round(page.width || page.bounds && page.bounds.width), height: round(page.height || page.bounds && page.bounds.height) },
      textDigest: items.filter((item) => item && item.role === 'text').map(modelText).filter(Boolean),
      resources: items.map(modelResource).filter(Boolean),
      itemRoles: modelRoleDigest(items),
      geometry: items.filter((item) => item && item.bounds).map((item) => geometryEntry(item.id, item.role, item.bounds)),
    };
  });
  return inventoryResult(pages);
}

function compareContentInventories(expected, actual, options = {}) {
  const errors = [];
  const warnings = [];
  comparePageCounts(expected, actual, errors);
  const actualPages = new Map((actual.pages || []).map((page) => [page.id, page]));
  for (const expectedPage of expected.pages || []) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'CONTENT_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    if (!sameArray(expectedPage.textDigest, actualPage.textDigest)) {
      errors.push({ code: 'CONTENT_TEXT_CHANGED', pageId: expectedPage.id, expected: expectedPage.textDigest, actual: actualPage.textDigest });
    }
    const missingResources = missingByIdentity(expectedPage.resources, actualPage.resources);
    if (missingResources.length) {
      errors.push({ code: 'CONTENT_RESOURCE_MISSING', pageId: expectedPage.id, missing: missingResources });
    }
    if (options.strictGeometry && geometryChanged(expectedPage.geometry, actualPage.geometry)) {
      errors.push({ code: 'CONTENT_GEOMETRY_CHANGED', pageId: expectedPage.id });
    }
  }
  return { ok: errors.length === 0, errors, warnings, expected: expected.summary, actual: actual.summary };
}

function pageSize($) {
  const style = $('section.page').first().attr('style') || '';
  return { width: cssNumber(style, 'width'), height: cssNumber(style, 'height') };
}

function textDigest($) {
  const out = [];
  $('section.page').first().find('h1,h2,h3,h4,h5,h6,p,figcaption,li,td,th,span').each((_, element) => {
    const text = normalizeText($(element).text());
    if (text) out.push(text);
  });
  return out;
}

function resourceDigest($, root) {
  const out = [];
  $('img[src],object[data]').each((_, element) => {
    const node = $(element);
    const value = node.attr('src') || node.attr('data') || '';
    out.push({ kind: element.tagName === 'object' ? 'object' : 'image', identity: resourceIdentity(root, value) });
  });
  return out;
}

function roleDigest($) {
  const counts = new Map();
  $('[data-id-role],img,object,svg,p,figure,section').each((_, element) => {
    const node = $(element);
    const role = node.attr('data-id-role') || tagRole(element.tagName);
    counts.set(role, (counts.get(role) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([role, count]) => ({ role, count })).sort((a, b) => a.role.localeCompare(b.role));
}

function geometryDigest($) {
  const out = [];
  $('[id]').each((_, element) => {
    const node = $(element);
    const style = node.attr('style') || '';
    out.push(geometryEntry(node.attr('id'), node.attr('data-id-role') || tagRole(element.tagName), {
      x: cssNumber(style, 'left'),
      y: cssNumber(style, 'top'),
      width: cssNumber(style, 'width'),
      height: cssNumber(style, 'height'),
    }));
  });
  return out;
}

function modelText(item) {
  return normalizeText(item.content && item.content.text || item.text || '');
}

function modelResource(item) {
  const asset = item && (item.asset || item.placedAsset);
  if (!asset || !asset.path) return null;
  return { kind: asset.kind || item.role || 'asset', identity: String(asset.path) };
}

function modelRoleDigest(items) {
  const counts = new Map();
  for (const item of items) {
    const role = item && item.role || 'unknown';
    counts.set(role, (counts.get(role) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([role, count]) => ({ role, count })).sort((a, b) => a.role.localeCompare(b.role));
}

function inventoryResult(pages) {
  return {
    kind: 'AuthorContentInventory',
    pages,
    summary: {
      pages: pages.length,
      texts: pages.reduce((sum, page) => sum + page.textDigest.length, 0),
      resources: pages.reduce((sum, page) => sum + page.resources.length, 0),
      geometryItems: pages.reduce((sum, page) => sum + page.geometry.length, 0),
    },
  };
}

function comparePageCounts(expected, actual, errors) {
  if ((expected.pages || []).length !== (actual.pages || []).length) {
    errors.push({ code: 'CONTENT_PAGE_COUNT_CHANGED', expected: (expected.pages || []).length, actual: (actual.pages || []).length });
  }
}

function missingByIdentity(expected, actual) {
  const actualIds = new Set((actual || []).map((entry) => entry.identity));
  return (expected || []).filter((entry) => !actualIds.has(entry.identity));
}

function geometryChanged(expected, actual) {
  if ((expected || []).length !== (actual || []).length) return true;
  const actualById = new Map((actual || []).map((entry) => [entry.id, entry]));
  return (expected || []).some((entry) => {
    const other = actualById.get(entry.id);
    return !other || Math.abs(entry.x - other.x) > 2 || Math.abs(entry.y - other.y) > 2 || Math.abs(entry.width - other.width) > 2 || Math.abs(entry.height - other.height) > 2;
  });
}

function geometryEntry(id, role, bounds) {
  return { id: id || null, role: role || 'unknown', x: round(bounds.x), y: round(bounds.y), width: round(bounds.width), height: round(bounds.height) };
}

function resourceIdentity(root, value) {
  const raw = String(value || '');
  if (/^\\\\|^\/\//.test(raw)) return raw.replace(/\//g, '\\');
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return path.normalize(raw);
  return path.normalize(path.resolve(root, raw));
}

function tagRole(tagName) {
  const tag = String(tagName || '').toLowerCase();
  if (tag === 'img' || tag === 'object') return 'graphic';
  if (tag === 'svg') return 'shape';
  if (['p', 'span', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tag)) return 'text';
  return tag || 'unknown';
}

function cssNumber(style, prop) {
  const match = new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(String(style || ''));
  return match ? round(Number(match[1])) : 0;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sameArray(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

module.exports = {
  authorPackageContentInventory,
  documentModelContentInventory,
  compareContentInventories,
};
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
node --test test\indesign-reverse\content-inventory.test.js
```

Expected:

```text
# pass 2
# fail 0
```

- [ ] **Step 5: 提交**

```powershell
git add src/writers/html/audit/content-inventory.js test/indesign-reverse/content-inventory.test.js
git diff --cached --check
git commit -m "feat(reverse): add author content inventory audit"
```

## Task 2: 作者结构签名审计

**Files:**
- Create: `src/writers/html/audit/structure-signature.js`
- Create: `test/indesign-reverse/structure-signature.test.js`

- [ ] **Step 1: 写失败测试**

Add `test/indesign-reverse/structure-signature.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  authorPackageStructureSignature,
  compareStructureSignatures,
} = require('../../src/writers/html/audit/structure-signature');

test('compareStructureSignatures detects parent order and tag drift without requiring exact source text equality', () => {
  const root = path.resolve('test/workspace/structure-signature-drift');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(first, '<section class="page"><section id="block" class="text-block"><p id="a">第一段</p><p id="b">第二段</p></section></section>');
  writeAuthorPackage(second, '<section class="page">\n  <p id="a">第一段</p>\n  <section id="block" class="text-block"><p id="b">第二段</p></section>\n</section>');

  const diff = compareStructureSignatures(
    authorPackageStructureSignature(first),
    authorPackageStructureSignature(second),
  );

  assert.equal(diff.ok, false);
  assert.deepEqual(diff.errors.map((issue) => issue.code).sort(), [
    'STRUCTURE_NODE_PARENT_CHANGED',
    'STRUCTURE_NODE_ORDER_CHANGED',
  ].sort());
});

test('compareStructureSignatures accepts formatting-only source changes', () => {
  const root = path.resolve('test/workspace/structure-signature-stable');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(first, '<section class="page"><figure id="fig"><img id="img" src="a.png"><figcaption id="cap">图注</figcaption></figure></section>');
  writeAuthorPackage(second, '<section class="page">\n  <figure id="fig">\n    <img id="img" src="a.png">\n    <figcaption id="cap">图注</figcaption>\n  </figure>\n</section>');

  const diff = compareStructureSignatures(
    authorPackageStructureSignature(first),
    authorPackageStructureSignature(second),
  );

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'structure-fixture',
    title: 'Structure Fixture',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
node --test test\indesign-reverse\structure-signature.test.js
```

Expected:

```text
not ok
Cannot find module '../../src/writers/html/audit/structure-signature'
```

- [ ] **Step 3: 实现结构签名模块**

Create `src/writers/html/audit/structure-signature.js`:

```js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const STRUCTURE_TAGS = 'section,figure,figcaption,p,h1,h2,h3,h4,h5,h6,ul,ol,li,table,thead,tbody,tr,td,th,img,object,svg';

function authorPackageStructureSignature(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const pages = (config.pages || []).map((page) => {
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    return {
      id: page.id || page.file,
      nodes: pageStructureNodes($),
    };
  });
  return {
    kind: 'AuthorStructureSignature',
    pages,
    summary: {
      pages: pages.length,
      nodes: pages.reduce((sum, page) => sum + page.nodes.length, 0),
    },
  };
}

function compareStructureSignatures(expected, actual) {
  const errors = [];
  const warnings = [];
  const actualPages = new Map((actual.pages || []).map((page) => [page.id, page]));
  for (const expectedPage of expected.pages || []) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'STRUCTURE_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    comparePageNodes(expectedPage, actualPage, errors);
  }
  return { ok: errors.length === 0, errors, warnings, expected: expected.summary, actual: actual.summary };
}

function comparePageNodes(expectedPage, actualPage, errors) {
  const actualByKey = new Map((actualPage.nodes || []).map((node) => [node.key, node]));
  for (const expectedNode of expectedPage.nodes || []) {
    const actualNode = actualByKey.get(expectedNode.key);
    if (!actualNode) {
      errors.push({ code: 'STRUCTURE_NODE_MISSING', pageId: expectedPage.id, node: expectedNode });
      continue;
    }
    if (expectedNode.tag !== actualNode.tag) {
      errors.push({ code: 'STRUCTURE_NODE_TAG_CHANGED', pageId: expectedPage.id, key: expectedNode.key, expected: expectedNode.tag, actual: actualNode.tag });
    }
    if (expectedNode.parentKey !== actualNode.parentKey) {
      errors.push({ code: 'STRUCTURE_NODE_PARENT_CHANGED', pageId: expectedPage.id, key: expectedNode.key, expected: expectedNode.parentKey, actual: actualNode.parentKey });
    }
    if (expectedNode.order !== actualNode.order) {
      errors.push({ code: 'STRUCTURE_NODE_ORDER_CHANGED', pageId: expectedPage.id, key: expectedNode.key, expected: expectedNode.order, actual: actualNode.order });
    }
  }
}

function pageStructureNodes($) {
  const nodes = [];
  $(STRUCTURE_TAGS).each((_, element) => {
    const node = $(element);
    const key = nodeKey($, element);
    nodes.push({
      key,
      id: node.attr('id') || null,
      tag: String(element.tagName || '').toLowerCase(),
      classList: classList(node.attr('class')),
      parentKey: parentStructureKey($, element),
      order: siblingStructureOrder($, element),
      text: normalizeText(node.children().length ? '' : node.text()),
      resource: node.attr('src') || node.attr('data') || null,
    });
  });
  return nodes;
}

function nodeKey($, element) {
  const node = $(element);
  const id = node.attr('id');
  if (id) return `id:${id}`;
  return `path:${structurePath($, element)}`;
}

function parentStructureKey($, element) {
  const parent = $(element).parents(STRUCTURE_TAGS).first();
  if (!parent.length) return 'page-root';
  return nodeKey($, parent[0]);
}

function siblingStructureOrder($, element) {
  const parent = $(element).parent();
  const siblings = parent.children(STRUCTURE_TAGS).toArray();
  return siblings.indexOf(element) + 1;
}

function structurePath($, element) {
  const parts = [];
  let current = element;
  while (current && current.type === 'tag') {
    const parent = current.parent;
    const siblings = parent && parent.children ? parent.children.filter((child) => child.type === 'tag' && child.name === current.name) : [];
    parts.unshift(`${current.name}:nth-${siblings.indexOf(current) + 1}`);
    current = parent;
  }
  return parts.join('/');
}

function classList(value) {
  return String(value || '').split(/\s+/).map((item) => item.trim()).filter(Boolean).sort();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  authorPackageStructureSignature,
  compareStructureSignatures,
};
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
node --test test\indesign-reverse\structure-signature.test.js
```

Expected:

```text
# pass 2
# fail 0
```

- [ ] **Step 5: 提交**

```powershell
git add src/writers/html/audit/structure-signature.js test/indesign-reverse/structure-signature.test.js
git diff --cached --check
git commit -m "feat(reverse): add author structure signature audit"
```

## Task 3: E2E 审计接入

**Files:**
- Modify: `scripts/indesign-e2e.js`
- Modify: `test/indesign-e2e-runner.test.js`

- [ ] **Step 1: 写失败测试**

Add to `test/indesign-e2e-runner.test.js`:

```js
test('auditReverseAuthorPackage attaches content inventory and structure signature reports', () => {
  const root = path.resolve('test/workspace/e2e-audit-integrity');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writePackage(sourceRoot, '<section class="page"><section id="block" class="text-block"><p id="copy">完整文字</p></section></section>');
  writePackage(reverseRoot, '<section class="page"><section id="block" class="text-block"><p id="copy">完整文字</p></section></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    outDir: reverseRoot,
    sourceRoot,
    strictSourceRoundtrip: true,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.contentInventory.ok, true);
  assert.equal(audit.structureSignature.ok, true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/content-inventory-report.json')), true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/structure-signature-report.json')), true);
});
```

Use the existing local helper pattern in the file. If `writePackage` is not available in `test/indesign-e2e-runner.test.js`, add this helper at the bottom:

```js
function writePackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'e2e-audit-fixture',
    title: 'E2E Audit Fixture',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
node --test test\indesign-e2e-runner.test.js
```

Expected:

```text
not ok
Cannot read properties of undefined (reading 'ok')
```

or equivalent failure showing `contentInventory` / `structureSignature` is not present.

- [ ] **Step 3: 接入审计**

Modify `scripts/indesign-e2e.js` inside `auditReverseAuthorPackage(author)`:

```js
const { authorPackageContentInventory, compareContentInventories } = require('../src/writers/html/audit/content-inventory');
const { authorPackageStructureSignature, compareStructureSignatures } = require('../src/writers/html/audit/structure-signature');
```

After `sourceRoundtrip`:

```js
let contentInventory = null;
let structureSignature = null;
if (author.sourceRoot) {
  const reportDir = path.join(outDir, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  contentInventory = compareContentInventories(
    authorPackageContentInventory(author.sourceRoot),
    authorPackageContentInventory(outDir),
    { strictGeometry: false },
  );
  structureSignature = compareStructureSignatures(
    authorPackageStructureSignature(author.sourceRoot),
    authorPackageStructureSignature(outDir),
  );
  fs.writeFileSync(path.join(reportDir, 'content-inventory-report.json'), JSON.stringify(contentInventory, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportDir, 'structure-signature-report.json'), JSON.stringify(structureSignature, null, 2), 'utf8');
}
```

Update return `ok`:

```js
const contentOk = contentInventory ? contentInventory.ok : true;
const structureOk = structureSignature ? structureSignature.ok : true;
return {
  ok: check.ok && missingPages.length === 0 && editable.ok && sourceOk && contentOk && structureOk,
  config: author.config,
  entry: check.entryPath,
  pages: pageFiles.length,
  missingPages,
  editable,
  sourceRoundtrip,
  contentInventory,
  structureSignature,
  errors: [
    ...(editable.errors || []),
    ...(sourceRoundtrip && !sourceRoundtrip.ok ? sourceRoundtrip.errors : []),
    ...(contentInventory && !contentInventory.ok ? contentInventory.errors : []),
    ...(structureSignature && !structureSignature.ok ? structureSignature.errors : []),
  ],
  warnings: [
    ...(editable.warnings || []),
    ...(sourceRoundtrip ? sourceRoundtrip.warnings : []),
    ...(contentInventory ? contentInventory.warnings : []),
    ...(structureSignature ? structureSignature.warnings : []),
  ],
};
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```powershell
node --test test\indesign-e2e-runner.test.js test\indesign-reverse\content-inventory.test.js test\indesign-reverse\structure-signature.test.js
```

Expected:

```text
# fail 0
```

- [ ] **Step 5: 提交**

```powershell
git add scripts/indesign-e2e.js test/indesign-e2e-runner.test.js
git diff --cached --check
git commit -m "feat(e2e): audit reverse author content integrity"
```

## Task 4: 指令层文本适配策略

**Files:**
- Modify: `src/writers/indesign/text-instructions.js`
- Modify: `src/writers/indesign/instruction-writer.js`
- Modify: `src/writers/indesign/instructions-validator.js`
- Modify: `test/semantic-model/to-instructions.test.js`
- Modify: `test/paged-html/instructions-validator.test.js`

- [ ] **Step 1: 写失败测试**

Add to `test/semantic-model/to-instructions.test.js`:

```js
test('semanticModelToInstructions emits bounded text fit for observed reverse text frames', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'text-1',
        role: 'text',
        semantic: 'unknown',
        bounds: { x: 10, y: 20, width: 80, height: 20 },
        content: { text: '2026年1月26日区委专题会' },
        sourceNode: { attributes: { 'data-id-observed': 'true', 'data-id-reverse-mode': 'observation' } },
        structure: { parentId: 'p1', order: 1 },
      }],
    }],
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'text-1');

  assert.deepEqual(item.textFit, {
    mode: 'expand-frame-to-content',
    maxGrowX: 96,
    maxGrowY: 48,
    preservePosition: true,
  });
});
```

Add to `test/paged-html/instructions-validator.test.js`:

```js
test('validateInstructions rejects invalid text fit modes', () => {
  const instructions = minimalInstructions();
  instructions.pages[0].items.push({
    id: 'bad-text',
    type: 'TEXT',
    bounds: [0, 0, 20, 80],
    text: 'bad',
    runs: [],
    textFit: { mode: 'shrink-font' },
  });

  const result = validateInstructions(instructions);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'INVALID_TEXT_FIT_MODE'));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
node --test test\semantic-model\to-instructions.test.js test\paged-html\instructions-validator.test.js
```

Expected:

```text
not ok
```

with missing `textFit` or missing validator error.

- [ ] **Step 3: 实现 helper**

Add to `src/writers/indesign/text-instructions.js`:

```js
function textFitPolicy(item, options = {}) {
  if (options.textFit === false) return null;
  const attributes = item && item.sourceNode && item.sourceNode.attributes || {};
  const observed = attributes['data-id-observed'] === 'true' || attributes['data-id-reverse-mode'] === 'observation';
  if (!observed) return null;
  return {
    mode: 'expand-frame-to-content',
    maxGrowX: Number(options.textFitMaxGrowX || 96),
    maxGrowY: Number(options.textFitMaxGrowY || 48),
    preservePosition: true,
  };
}

module.exports = {
  effectsForInstruction,
  textFrameBounds,
  textFitPolicy,
};
```

Keep existing exports intact; add `textFitPolicy` without removing `effectsForInstruction` or `textFrameBounds`.

- [ ] **Step 4: 写入 instruction**

Modify `src/writers/indesign/instruction-writer.js` import:

```js
const { effectsForInstruction, textFrameBounds, textFitPolicy } = require('./text-instructions');
```

In the `TEXT` item instruction object, add:

```js
textFit: textFitPolicy(item, options),
```

If the current object builder omits null fields via a helper, keep that behavior and include `textFit` only when non-null.

- [ ] **Step 5: 校验 schema**

Add to `src/writers/indesign/instructions-validator.js` in item validation:

```js
if (item.textFit) {
  const mode = String(item.textFit.mode || '');
  if (mode !== 'expand-frame-to-content') {
    errors.push({
      code: 'INVALID_TEXT_FIT_MODE',
      message: `Unsupported textFit mode '${mode}'.`,
      itemId: item.id,
    });
  }
  for (const field of ['maxGrowX', 'maxGrowY']) {
    if (!Number.isFinite(Number(item.textFit[field])) || Number(item.textFit[field]) < 0) {
      errors.push({
        code: 'INVALID_TEXT_FIT_LIMIT',
        message: `textFit.${field} must be a non-negative number.`,
        itemId: item.id,
        field,
      });
    }
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```powershell
node --test test\semantic-model\to-instructions.test.js test\paged-html\instructions-validator.test.js
```

Expected:

```text
# fail 0
```

- [ ] **Step 7: 提交**

```powershell
git add src/writers/indesign/text-instructions.js src/writers/indesign/instruction-writer.js src/writers/indesign/instructions-validator.js test/semantic-model/to-instructions.test.js test/paged-html/instructions-validator.test.js
git diff --cached --check
git commit -m "feat(indesign): emit bounded text fit policy"
```

## Task 5: ExtendScript 文本框安全适配

**Files:**
- Create: `_indesign_scripts/lib/hi_text_fit.jsxinc`
- Modify: `_indesign_scripts/build_from_instructions.jsx`
- Modify: `scripts/indesign-e2e.js`
- Modify: `_indesign_scripts/lib/hi_items.jsxinc`
- Modify: `test/indesign-executor/executor-script-static.test.js`

- [ ] **Step 1: 写失败测试**

Add to `test/indesign-executor/executor-script-static.test.js`:

```js
test('executor loads dedicated text fit helper before item creation', () => {
  const bootstrap = fs.readFileSync(path.resolve('_indesign_scripts/build_from_instructions.jsx'), 'utf8');
  const e2e = fs.readFileSync(path.resolve('scripts/indesign-e2e.js'), 'utf8');

  assert.match(bootstrap, /includeLib\("hi_text_fit\.jsxinc"\)/);
  assert.match(e2e, /includeLib\("hi_text_fit\.jsxinc"\)/);
});

test('text fit helper expands bounded overset frames and reports unresolved cases', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_text_fit.jsxinc'), 'utf8');
  const items = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_items.jsxinc'), 'utf8');

  assert.match(source, /HI\.resolveTextFrameOverflow\s*=/);
  assert.match(source, /TEXT_FIT_APPLIED/);
  assert.match(source, /TEXT_FIT_UNRESOLVED/);
  assert.match(source, /maxGrowX/);
  assert.match(source, /maxGrowY/);
  assert.match(items, /HI\.resolveTextFrameOverflow\(report,\s*frame,\s*item\)/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
node --test test\indesign-executor\executor-script-static.test.js
```

Expected:

```text
not ok
ENOENT: no such file or directory, open '_indesign_scripts/lib/hi_text_fit.jsxinc'
```

- [ ] **Step 3: 创建文本适配 helper**

Create `_indesign_scripts/lib/hi_text_fit.jsxinc`:

```js
if (typeof HI === "undefined") HI = {};

HI.resolveTextFrameOverflow = function (report, frame, item) {
    if (!frame || !frame.overflows || !item || !item.textFit) return false;
    if (item.textFit.mode !== "expand-frame-to-content") return false;

    var original = null;
    try { original = frame.geometricBounds; } catch (_) {}
    if (!original) return false;

    var maxGrowX = Number(item.textFit.maxGrowX || 0);
    var maxGrowY = Number(item.textFit.maxGrowY || 0);
    try {
        frame.fit(FitOptions.FRAME_TO_CONTENT);
    } catch (fitError) {
        HI.addMessage(report, "warning", "TEXT_FIT_UNRESOLVED", "Text frame fit failed", {
            itemId: item.id || null,
            reason: String(fitError)
        });
        return false;
    }

    var fitted = null;
    try { fitted = frame.geometricBounds; } catch (_) {}
    if (!fitted) return false;

    var growX = Math.max(0, Number(fitted[3]) - Number(original[3]));
    var growY = Math.max(0, Number(fitted[2]) - Number(original[2]));
    if (growX <= maxGrowX && growY <= maxGrowY && !frame.overflows) {
        HI.addMessage(report, "info", "TEXT_FIT_APPLIED", "Text frame expanded to avoid overset", {
            itemId: item.id || null,
            originalBounds: HI.boundsArray(original),
            fittedBounds: HI.boundsArray(fitted),
            growX: growX,
            growY: growY
        });
        return true;
    }

    try { frame.geometricBounds = original; } catch (_) {}
    HI.addMessage(report, "warning", "TEXT_FIT_UNRESOLVED", "Text frame cannot be safely expanded within configured limits", {
        itemId: item.id || null,
        originalBounds: HI.boundsArray(original),
        attemptedBounds: HI.boundsArray(fitted),
        growX: growX,
        growY: growY,
        maxGrowX: maxGrowX,
        maxGrowY: maxGrowY
    });
    return false;
};

HI.boundsArray = function (bounds) {
    return [Number(bounds[0]), Number(bounds[1]), Number(bounds[2]), Number(bounds[3])];
};
```

- [ ] **Step 4: 接入 include**

Modify `_indesign_scripts/build_from_instructions.jsx`:

```js
includeLib("hi_tables.jsxinc");
includeLib("hi_text_fit.jsxinc");
includeLib("hi_items.jsxinc");
```

Modify `scripts/indesign-e2e.js` in `buildBuildJsx`:

```js
includeLib("hi_tables.jsxinc");
includeLib("hi_text_fit.jsxinc");
includeLib("hi_items.jsxinc");
```

- [ ] **Step 5: 在文本框创建后调用 helper**

Modify `_indesign_scripts/lib/hi_items.jsxinc` in `HI.createTextFrame` before final overset recording:

```js
    if (frame.overflows) {
        HI.resolveTextFrameOverflow(report, frame, item);
    }
    if (frame.overflows) {
        HI.recordOversetTextFrame(report, frame, item, "TEXT_OVERSET", "Text frame is overset");
    }
```

Apply the same pattern in table frame creation:

```js
    if (frame.overflows) {
        HI.resolveTextFrameOverflow(report, frame, item);
    }
    if (frame.overflows) {
        HI.recordOversetTextFrame(report, frame, item, "TABLE_FRAME_OVERSET", "Table frame is overset");
    }
```

- [ ] **Step 6: 运行静态测试**

Run:

```powershell
node --test test\indesign-executor\executor-script-static.test.js
```

Expected:

```text
# fail 0
```

- [ ] **Step 7: 提交**

```powershell
git add _indesign_scripts/lib/hi_text_fit.jsxinc _indesign_scripts/build_from_instructions.jsx scripts/indesign-e2e.js _indesign_scripts/lib/hi_items.jsxinc test/indesign-executor/executor-script-static.test.js
git diff --cached --check
git commit -m "feat(indesign): safely fit observed text frames"
```

## Task 6: 真实人工 InDesign 验证

**Files:**
- Modify only if validation reveals a specific failing gate from Tasks 1-5
- Read/write runtime output under: `test/workspace/`

- [ ] **Step 1: 跑默认 E2E，确认标准样例不被误伤**

Run:

```powershell
npm run e2e:indesign
```

Expected:

```text
"ok": true
"oversetTextFrames": 0
```

- [ ] **Step 2: 跑真实人工作者包一次回读**

Run:

```powershell
npm run e2e:indesign -- -- --html "\\daga-nas5\daga-2025-project\D0474_大兴城建\00_agent\indesign_demo\semantic-object-graph-20260603-023400\reverse-html-text-block\author\deck.html" --reverse-roundtrip --reverse-mode observation
```

Expected acceptable result:

```text
"ok": true
```

and the output author reports include:

```text
reverse-html\author\reports\content-inventory-report.json
reverse-html\author\reports\structure-signature-report.json
```

Acceptable failure:

```text
TEXT_FIT_UNRESOLVED
```

with `itemId`, `pageName`, `originalBounds`, `attemptedBounds`, `maxGrowX`, `maxGrowY`.

Unacceptable failure:

```text
TEXT_OVERSET
```

without a preceding `TEXT_FIT_UNRESOLVED`, or any missing text/resource issue without exact page and item evidence.

- [ ] **Step 3: 跑真实人工作者包二次回环**

Run:

```powershell
npm run e2e:indesign -- -- --html "\\daga-nas5\daga-2025-project\D0474_大兴城建\00_agent\indesign_demo\semantic-object-graph-20260603-023400\reverse-html-text-block\author\deck.html" --reverse-roundtrip --reverse-mode observation --second-pass-roundtrip
```

Expected:

```text
"ok": true
```

and:

```text
"canonicalDrift": {
  "ok": true,
  "stable": true
}
```

If `sourceDrift` still reports formatting-only source changes, keep it as warning only when `structureSignature.ok === true` and `contentInventory.ok === true`.

- [ ] **Step 4: 如有 unresolved，缩小修复到对应模块**

For a `TEXT_FIT_UNRESOLVED` on a specific item, update only one of:

```text
src/writers/indesign/text-instructions.js
_indesign_scripts/lib/hi_text_fit.jsxinc
```

Do not patch the fixture HTML, do not add item-id special cases, and do not suppress `assertNoTextOverset`.

- [ ] **Step 5: 提交验证性修复**

Only if Step 4 changed files:

```powershell
git add src/writers/indesign/text-instructions.js _indesign_scripts/lib/hi_text_fit.jsxinc test/semantic-model/to-instructions.test.js test/indesign-executor/executor-script-static.test.js
git diff --cached --check
git commit -m "fix(indesign): resolve observed text frame fit limits"
```

## Task 7: 文档和清理

**Files:**
- Modify: `docs/规范/SEMANTIC_RECONSTRUCTION.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新语义重建规范**

Add to `docs/规范/SEMANTIC_RECONSTRUCTION.md` section 5:

```md
### 无丢失回环验收

人工 InDesign 反向作者包进入二次回环前，必须先通过内容库存和作者结构签名审计。

- 内容库存审计负责页数、页面尺寸、文字、资源引用、对象角色和关键几何的无丢失证明。
- 作者结构签名负责证明 `figure`、`figcaption`、`section.figure-grid`、`section.text-block`、表格和资源节点的父子关系、顺序和标签没有继续漂移。
- 白名单语义候选可以有偏差，进入 `semantic-candidates.json` 或 unresolved 报告，由 Agent 或用户纠正。
- 内容丢失、资源丢失、文本溢出、页面缺失和结构漂移不是语义偏差，必须由程序报错或修复。
```

- [ ] **Step 2: 更新 AGENTS 架构边界**

In `AGENTS.md`, section 5, add this rule after the semantic reconstruction boundary:

```md
- 人工 InDesign 反向作者包的第一验收目标是无丢失回环和结构稳定：`InDesign -> HTML -> InDesign -> HTML` 后，页数、文字、资源、关键几何和可编辑父子结构必须由审计证明没有丢失或继续漂移。语义算法可以输出候选和 unresolved，Agent 主要纠正语义；内容保真和结构稳定不得交给 Agent 兜底。
```

- [ ] **Step 3: 跑文档索引检查**

Run:

```powershell
rg -n "无丢失回环|内容库存|结构签名|TEXT_FIT_UNRESOLVED" AGENTS.md docs/规范
```

Expected:

```text
AGENTS.md:<line>:...
docs/规范/SEMANTIC_RECONSTRUCTION.md:<line>:...
```

- [ ] **Step 4: 提交文档**

```powershell
git add AGENTS.md docs/规范/SEMANTIC_RECONSTRUCTION.md
git diff --cached --check
git commit -m "docs: define lossless human indesign roundtrip gate"
```

## Final Verification

- [ ] **Step 1: 全量测试**

Run:

```powershell
npm test
```

Expected:

```text
# fail 0
```

- [ ] **Step 2: 默认真实 InDesign E2E**

Run:

```powershell
npm run e2e:indesign
```

Expected:

```text
"ok": true
"oversetTextFrames": 0
```

- [ ] **Step 3: 真实人工 InDesign 作者包二次回环**

Run:

```powershell
npm run e2e:indesign -- -- --html "\\daga-nas5\daga-2025-project\D0474_大兴城建\00_agent\indesign_demo\semantic-object-graph-20260603-023400\reverse-html-text-block\author\deck.html" --reverse-roundtrip --reverse-mode observation --second-pass-roundtrip
```

Expected:

```text
"ok": true
"contentInventory": {
  "ok": true
}
"structureSignature": {
  "ok": true
}
```

- [ ] **Step 4: Git 检查**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected:

```text
## main...origin/main [ahead <n>]
```

with no unstaged tracked changes.

## Self-Review

- Spec coverage: 覆盖了用户要求的可验证、不丢东西、结构稳定、语义由 Agent 纠正。
- Placeholder scan: 已检查常见占位词和空泛步骤，未发现需要执行者自行补全的步骤。
- Type consistency: `AuthorContentInventory`、`AuthorStructureSignature`、`textFit`、`TEXT_FIT_UNRESOLVED`、`TEXT_FIT_APPLIED` 在测试、实现和 E2E 接入中命名一致。
- File-size guardrail: 新审计模块和新 JSX helper 独立成文件；`hi_items.jsxinc` 和 `scripts/indesign-e2e.js` 只做接线，不扩成大识别器。
