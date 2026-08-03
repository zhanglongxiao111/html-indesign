# Common HTML Vector Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让常用 CSS 圆形和内联 SVG 基础图元可靠生成可编辑 InDesign 对象，并让所有尚未支持的可见 HTML 图形在 CLI 和统一 Skill 中得到明确反馈。

**Architecture:** 浏览器 reader 采集标准 SVG 子元素和危险视觉事实，HTML normalizer 只写入现有 canonical `vectorGeometry`，InDesign writer 根据 geometry kind 选择 Oval、Rectangle、GraphicLine 或 Polygon。兼容审计统一生成 lint/compile/build 消息；复杂视觉不进入静默 fallback。

**Tech Stack:** Node.js >=20.18.1、Playwright/Edge browser snapshot、CommonJS、node:test、InDesign JSX、`indesign-cli`。

## Global Constraints

- 浏览器预览和自然 HTML 写法不能为转换让路。
- 新矢量事实只使用 `src/protocol/` 已登记的 `items[].vectorGeometry.kind` 与 `items[].vectorGeometry.paths`。
- HTML adapter 负责 DOM/CSS/SVG 兼容；writer 和 executor 不解析 HTML。
- 退役 browser snapshot 字段在同一轮清掉全部读写和测试，不保留双路径。
- 不修改作者源 HTML，不用栅格图或无样式矩形掩盖丢失。
- 统一 Skill 唯一发布源为 `D:/AI/mcp-indesign/skills/indesign-cli/`。

---

### Task 1: 修复 paint-only 色彩误判与 CSS Oval 判型

**Files:**
- Modify: `src/adapters/html/reader/browser-element-capture.js`
- Modify: `src/writers/indesign/instruction-writer.js`
- Test: `test/html-to-indesign/browser-snapshot.test.js`
- Test: `test/html-to-indesign/instructions-compiler.test.js`

**Interfaces:**
- Consumes: browser computed `backgroundColor`、`borderRadius`、`boundsMm`。
- Produces: `isTransparentCssColor(value) -> boolean` 的正确候选判断；`shapeKindFor(item) -> "oval" | "rectangle" | "polygon"`。

- [ ] **Step 1: 写 paint-only RED 测试**

在 `browser-snapshot.test.js` 新增临时作者页，放置 `#red`、`#orange`、`#transparent-legacy` 和 `#transparent-modern` 四个无文字 div：

```js
test('renderSnapshot keeps RGB colors ending in zero and ignores alpha-zero paint', async () => {
  const htmlPath = writeWorkspaceDeck('browser-paint-alpha', `
    <style>
      .page { position:relative; width:800px; height:450px; }
      .paint { position:absolute; width:40px; height:40px; }
      #red { left:10px; background:rgb(192, 0, 0); }
      #orange { left:60px; background:rgb(238, 153, 0); }
      #transparent-legacy { left:110px; background:rgba(12, 34, 56, 0); }
      #transparent-modern { left:160px; background:rgb(12 34 56 / 0); }
    </style>
    <section class="page"><div id="red" class="paint"></div><div id="orange" class="paint"></div><div id="transparent-legacy" class="paint"></div><div id="transparent-modern" class="paint"></div></section>
  `);
  const snapshot = await renderSnapshot({ htmlPath });
  const ids = snapshot.pages[0].items.map((item) => item.id);
  assert.equal(ids.includes('red'), true);
  assert.equal(ids.includes('orange'), true);
  assert.equal(ids.includes('transparent-legacy'), false);
  assert.equal(ids.includes('transparent-modern'), false);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test --test-name-pattern="RGB colors ending in zero" test/html-to-indesign/browser-snapshot.test.js`

Expected: `red` 或 `orange` 缺失，测试按预期失败。

- [ ] **Step 3: 最小修复透明色判断**

把宽泛的“最后一个数为 0”正则替换为只解析 alpha 的函数：

```js
function isTransparentCssColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'transparent') return true;
  const slashAlpha = raw.match(/^rgba?\([^/]+\/\s*([+-]?(?:\d+|\d*\.\d+))%?\s*\)$/i);
  if (slashAlpha) return Number(slashAlpha[1]) === 0;
  const legacyAlpha = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([+-]?(?:\d+|\d*\.\d+))\s*\)$/i);
  return Boolean(legacyAlpha && Number(legacyAlpha[1]) === 0);
}
```

- [ ] **Step 4: 写 CSS Oval RED 测试**

在 `instructions-compiler.test.js` 构造三种自然 CSS shape，断言：非方形 `50%` 为 oval、方形 `9999px` 为 oval、非方形 `9999px` 保持 rectangle。

```js
assert.equal(byId.get('ellipse-50-percent').shapeKind, 'oval');
assert.equal(byId.get('circle-large-radius').shapeKind, 'oval');
assert.equal(byId.get('pill-large-radius').shapeKind, 'rectangle');
```

- [ ] **Step 5: 运行测试确认 RED**

Run: `node --test --test-name-pattern="natural CSS oval" test/html-to-indesign/instructions-compiler.test.js`

Expected: 前两个断言至少一个得到 `rectangle`。

- [ ] **Step 6: 实现 CSS Oval 判型并跑 GREEN**

新增 `isCssOval(item, radius)`：`50%` 不要求宽高相等；绝对圆角先换算为 mm，仅在近似方形且圆角不小于半边长时返回 true。运行：

`node --test test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/instructions-compiler.test.js`

Expected: PASS。

- [ ] **Step 7: 提交**

```powershell
git add src/adapters/html/reader/browser-element-capture.js src/writers/indesign/instruction-writer.js test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/instructions-compiler.test.js
git commit -m "fix: preserve natural HTML paint shapes"
```

### Task 2: 把 SVG 基础图元归一化为 canonical vector geometry

**Files:**
- Modify: `src/adapters/html/reader/browser-element-capture.js`
- Modify: `src/adapters/html/reader/browser-snapshot-capture.js`
- Modify: `src/adapters/html/reader/browser-snapshot.js`
- Modify: `src/adapters/html/normalizer/svg-vector-geometry.js`
- Modify: `src/writers/indesign/instruction-writer.js`
- Test: `test/html-to-indesign/browser-snapshot.test.js`
- Test: `test/html-to-indesign/instructions-compiler.test.js`

**Interfaces:**
- Produces: `vectorElementsFor(svg) -> Array<{tagName, attributes, computedStyle}>`。
- Consumes: snapshot `item.vectorElements`。
- Produces: `vectorFactsFromSvgItem(item, bounds) -> {vectorGeometry, visualStyle} | null`，kind 为 `oval`、`rectangle`、`line`、`polygon` 或 `path`。

- [ ] **Step 1: 写 SVG primitives RED 浏览器测试**

同一页放置 `circle`、`ellipse`、`rect rx`、`line`、`polyline`、`polygon` 和现有 `path`，不加 `data-id-role`。断言每个 item 均有 geometry、画笔颜色正确、defs 中图元未重复输出：

```js
assert.deepEqual(items.get('svg-circle').vectorGeometry.kind, 'oval');
assert.deepEqual(items.get('svg-ellipse').vectorGeometry.kind, 'oval');
assert.deepEqual(items.get('svg-rect').vectorGeometry.kind, 'rectangle');
assert.deepEqual(items.get('svg-line').vectorGeometry.kind, 'line');
assert.equal(items.get('svg-polyline').vectorGeometry.paths[0].closed, false);
assert.equal(items.get('svg-polygon').vectorGeometry.paths[0].closed, true);
assert.equal(items.get('svg-circle').visualStyle.fillColor, '#c00000');
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test --test-name-pattern="SVG primitives" test/html-to-indesign/browser-snapshot.test.js`

Expected: 除 `path` 外的 `vectorGeometry` 为 null。

- [ ] **Step 3: 退役 `vectorPaths` 并采集 `vectorElements`**

在 browser context 中只采集页面可见基础图元：

```js
const SVG_VECTOR_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];
function vectorElementsFor(el) {
  if (!el || String(el.tagName || '').toLowerCase() !== 'svg') return [];
  return Array.from(el.querySelectorAll(SVG_VECTOR_TAGS.join(',')))
    .filter((node) => !node.closest('defs,marker,clipPath,mask,pattern,linearGradient,radialGradient'))
    .map((node) => ({
      tagName: String(node.tagName || '').toLowerCase(),
      attributes: attrs(node),
      computedStyle: vectorPathComputedStyle(node),
    }));
}
```

同步把 capture payload、reader model 和 normalizer 的 `vectorPaths` 全部替换为 `vectorElements`；运行 `rg -n "vectorPaths" src/adapters/html test/html-to-indesign`，只允许 instruction metrics 或 canonical `vectorGeometry.paths` 语境存在。

- [ ] **Step 4: 实现基础图元 geometry**

在 `svg-vector-geometry.js` 增加按 tag 分派：

```js
function pathsFromVectorElement(element, bounds, viewBox, sourceHtml) {
  const attrs = element.attributes || {};
  const style = visualStyleFromPath(attrs, sourceHtml, element.computedStyle || {});
  const builders = {
    path: () => pathsFromPathTag(attrs, bounds, viewBox, element, sourceHtml),
    circle: () => [ellipsePath(attrs.cx, attrs.cy, attrs.r, attrs.r, bounds, viewBox, style)],
    ellipse: () => [ellipsePath(attrs.cx, attrs.cy, attrs.rx, attrs.ry, bounds, viewBox, style)],
    rect: () => [rectPath(attrs, bounds, viewBox, style)],
    line: () => [linePath(attrs, bounds, viewBox, style)],
    polyline: () => [pointsPath(attrs.points, false, bounds, viewBox, style)],
    polygon: () => [pointsPath(attrs.points, true, bounds, viewBox, style)],
  };
  return builders[element.tagName] ? builders[element.tagName]().filter(Boolean) : [];
}
```

ellipse 使用 kappa `0.5522847498307936` 的四段 Bézier；rounded rect 对 `rx/ry` 做非负、半边长 clamp；points 接受逗号与空格组合。所有点经现有 `mapPoint` 进入页面坐标。

- [ ] **Step 5: 写 instructions RED 测试并实现判型**

断言：circle/ellipse 为 `SHAPE + oval`，rect 为 `SHAPE + rectangle`，line 为 `LINE`，polyline/polygon/path 有 native geometry。修改 `shapeKindFor`：

```js
if (kind === 'oval') return 'oval';
if (kind === 'rectangle') return 'rectangle';
if ((vectorGeometry.paths || []).length || kind === 'polygon' || kind === 'path') return 'polygon';
```

- [ ] **Step 6: 运行针对性 GREEN**

Run: `node --test test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/instructions-compiler.test.js test/indesign-executor/executor-script-static.test.js`

Expected: PASS；支持的 SVG 不再生成无画笔 Rectangle。

- [ ] **Step 7: 提交**

```powershell
git add src/adapters/html/reader/browser-element-capture.js src/adapters/html/reader/browser-snapshot-capture.js src/adapters/html/reader/browser-snapshot.js src/adapters/html/normalizer/svg-vector-geometry.js src/writers/indesign/instruction-writer.js test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/instructions-compiler.test.js
git commit -m "feat: compile common inline SVG primitives"
```

### Task 3: 让不支持的可见图形在 CLI 中阻断

**Files:**
- Modify: `src/adapters/html/reader/browser-style-capture.js`
- Modify: `src/adapters/html/reader/browser-element-capture.js`
- Modify: `src/adapters/html/reader/unsupported-css.js`
- Modify: `src/adapters/html/compatibility/audit.js`
- Modify: `test/fixtures/fixed-html/unsupported-deck.html`
- Test: `test/html-to-indesign/browser-snapshot.test.js`
- Test: `test/html-to-indesign/html-compatibility-audit.test.js`
- Test: `test/html-to-indesign/authoring-lint-cli.test.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`

**Interfaces:**
- Produces: item `unsupported` 中的 `beforePaint`、`afterPaint`、`clipPath` 和 `svgUnsupportedElements`。
- Produces: compatibility messages `{level, code, action, pageId, itemId, message, suggestedFix, ruleRef}`。

- [ ] **Step 1: 写 CLI RED 测试**

构造合规 margins/grid 的作者页，包含 `<svg><use>`、空元素 `::before` 圆点、`clip-path: polygon(...)`、多色渐变和 border triangle。断言 strict lint 失败并返回：

```js
for (const code of [
  'HTML_INLINE_SVG_UNSUPPORTED',
  'HTML_PSEUDO_ELEMENT_UNSUPPORTED',
  'HTML_CLIP_PATH_UNSUPPORTED',
  'HTML_GRADIENT_UNSUPPORTED',
  'HTML_CSS_BORDER_SHAPE_UNSUPPORTED',
]) {
  const message = result.compatibility.messages.find((entry) => entry.code === code);
  assert.equal(message.level, 'error');
  assert.equal(message.action, 'blocked');
  assert.ok(message.suggestedFix);
  assert.ok(message.ruleRef);
}
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `node --test test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-lint-cli.test.js`

Expected: compatibility 中没有这些消息，或 pseudo-only 元素完全未捕获。

- [ ] **Step 3: 采集危险视觉事实**

把 `clipPath`、`backgroundSize`、`backgroundPosition` 加入 snapshot style props。给 pseudo 读取 computed background/border/尺寸：

```js
function pseudoPaint(el, pseudo) {
  const style = getComputedStyle(el, pseudo);
  return Boolean(style && style.display !== 'none' && (
    !isTransparentCssColor(style.backgroundColor)
      || (style.backgroundImage && style.backgroundImage !== 'none')
      || hasVisibleCssBorder(style)
  ));
}
```

`isPaintOnlyCandidate` 在 before/after 有可见 paint 时也返回 true，使 CLI 能定位只有伪元素的图形。SVG 根记录非定义区内的 `<use>`、`text`、`image`、`foreignObject`，以及带 transform/clip/mask/filter/paint server 的基础图元。

- [ ] **Step 4: 统一 compatibility blocked 消息**

在 audit 中增加：

```js
function blockedMessage(code, context, message, suggestedFix, ruleRef) {
  return { level: 'error', code, action: 'blocked', ...context, message, suggestedFix, ruleRef };
}
```

支持的 inline SVG 返回 `HTML_INLINE_SVG_NORMALIZED`；仅当存在 unsupported facts 时返回 `HTML_INLINE_SVG_UNSUPPORTED`。多色 gradient 使用 `parseCssLinearGradient` 与 `gradientHasSingleColor` 判断；border triangle 只在 computed content width/height 为 0 且透明侧边框配合可见第三边时阻断，避免误伤普通 border。

- [ ] **Step 5: 更新旧 reader warning 测试**

`unsupported-deck.html` 中简单 `<rect>` 改为正常支持，另增 `<use>` 作为 unsupported。断言支持的 `<path>/<rect>` 不再收到笼统 warning，危险项仍有具体 code。

- [ ] **Step 6: 运行 CLI 与插件 GREEN**

Run: `node --test test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js`

Expected: PASS；lint、compile、build 对同一输入返回相同 compatibility codes 和位置。

- [ ] **Step 7: 提交**

```powershell
git add src/adapters/html/reader/browser-style-capture.js src/adapters/html/reader/browser-element-capture.js src/adapters/html/reader/unsupported-css.js src/adapters/html/compatibility/audit.js test/fixtures/fixed-html/unsupported-deck.html test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js
git commit -m "feat: block lossy HTML visual constructs"
```

### Task 4: 同步作者规范与统一 Skill

**Files:**
- Modify: `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md`
- Modify: `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`
- Modify: `D:/AI/mcp-indesign/skills/indesign-cli/references/html-authoring.md`

**Interfaces:**
- Consumes: Task 3 的稳定 compatibility codes。
- Produces: Agent 创作前的支持范围和 lint 后处理顺序。

- [ ] **Step 1: 更新项目规范**

明确基础 SVG 图元可以直接写、CSS `50%` 圆/椭圆与方形大圆角可直接写；删除“所有 inline SVG fallback 未实现”的旧表述。列出复杂 SVG、pseudo shape、clip-path、border triangle 的 blocked codes 和两类 suggested fix。

- [ ] **Step 2: 更新统一 Skill**

在“先写正常 HTML，再看兼容反馈”增加最小示例：

```html
<svg viewBox="0 0 100 100" aria-label="位置标记">
  <circle cx="50" cy="50" r="23" fill="#c00000" stroke="#ffffff" stroke-width="8"></circle>
</svg>
```

说明基础图元无需改写为协议专用 DOM；复杂 SVG 使用外部 `.svg`，`blocked > 0` 时必须修改作者源后重新 lint。

- [ ] **Step 3: 校验 Skill 与文档一致性**

Run: 项目现有 Skill quick validator；再用 `rg -n "INLINE_SVG_UNSUPPORTED|circle|pseudo|clip-path" docs/规范 D:/AI/mcp-indesign/skills/indesign-cli` 核对没有互相矛盾的当前说明。

Expected: quick validator 通过，或只报告已记录且与本轮内容无关的 frontmatter 元数据问题；所有当前文档都使用新边界。

- [ ] **Step 4: 分仓提交**

```powershell
git add docs/规范/AGENT_HTML_AUTHORING_GUIDE.md docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md
git commit -m "docs: document common HTML vector support"
git -C D:/AI/mcp-indesign add skills/indesign-cli/references/html-authoring.md
git -C D:/AI/mcp-indesign commit -m "docs: teach inline SVG compatibility rules"
```

### Task 5: 全量、打包与真实 InDesign 验证

**Files:**
- Verify: `test/`
- Verify: package/plugin artifact
- Create ignored fixture/output: `test/workspace/common-html-vector-e2e/`
- Modify: `docs/superpowers/plans/2026-08-03-common-html-vector-compatibility-plan.md`

**Interfaces:**
- Consumes: Luna 原始 `<svg><circle>` 形态的安全测试页。
- Produces: INDD/PDF/IDML、build result、fidelity report 和 PDF preview evidence。

- [ ] **Step 1: 运行针对性测试**

Run:

```powershell
node --test test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/instructions-compiler.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js test/indesign-executor/executor-script-static.test.js
```

Expected: 0 failures。

- [ ] **Step 2: 运行全量与包校验**

Run: `npm test`

Run: `npm run pack:dry-run`

Run: `indesign-cli plugin validate D:/AI/html-indesign`

Expected: 全量 0 failures；tgz 白名单不含 `test/workspace` 或客户产物；插件 0 errors/warnings。

- [ ] **Step 3: 真实 InDesign E2E**

在 ignored workspace 创建一页安全作者包，包含 Luna 同构的 `<svg><circle>`、`<ellipse>`、`<line>`、`<polygon>` 与 CSS 圆。运行：

```powershell
npm run e2e:indesign -- -- --html test/workspace/common-html-vector-e2e/deck.html --run-dir test/workspace/common-html-vector-e2e/output
```

Expected: INDD/PDF/IDML 均存在；forward fidelity 0 errors；圆点有红色 fill、白色 stroke 和非矩形矢量几何；PDF 预览可见。

- [ ] **Step 4: 记录验证并收口**

在本计划末尾写入实际测试数、包文件数、插件校验结果、InDesign 对象和 PDF 证据。运行 `git diff --check`、`git status --short --branch`，只提交本轮文件，不加入既有 `.tgz`。

- [ ] **Step 5: 提交验证记录**

```powershell
git add docs/superpowers/plans/2026-08-03-common-html-vector-compatibility-plan.md
git commit -m "docs: record vector compatibility verification"
```

## Plan Self-Review

- Spec coverage: paint-only 误判、CSS oval、七种 SVG 基础图元、CLI blocked、Skill 和真实 InDesign 均有独立任务。
- Placeholder scan: 无 TBD、TODO、模糊“适当处理”或未定义接口。
- Type consistency: browser snapshot 使用唯一 `vectorElements`；canonical 和 instructions 始终使用已登记的 `vectorGeometry.paths`；compatibility message contract 与现有 CLI 一致。

## Verification Record (2026-08-04)

- 回归和全量：最终 `npm test` 为 1178/1178 pass、0 fail；合并前相关 browser snapshot、compatibility、instructions、authoring lint 与 plugin tools 组合测试为 105/105 pass。
- 补充兼容审查：支持 `border-radius: 100%`；SVG 百分比/带单位长度读取浏览器 DOM 已解析用户坐标；基础图元无效几何返回 `HTML_INLINE_SVG_UNSUPPORTED`；隐藏 SVG 辅助文字既不阻断，也不进入作者内容或 InDesign 文字框。
- 包白名单：`npm pack --dry-run --json` 得到 228 个文件，package size 389493 bytes、unpacked size 1690164 bytes；`test/`、`test/workspace`、`_debug` 命中均为 0。
- 安装态插件：从实际 tgz 安装到 `test/workspace/package-validation-final-20260804-010820/install/` 后执行 `plugin validate`，结果 4 tools、0 errors、0 warnings。
- 真实 InDesign：`test/workspace/common-html-vector-e2e/output-percent-hidden-fix/` 生成 INDD/PDF/IDML 和 preview，forward fidelity 为 1 page、9 items、0 errors、0 warnings；实际对象包括 Luna 同构红白圆、百分比圆、无 viewBox 圆、CSS `9999px` 圆、CSS `100%` 椭圆、SVG ellipse/line/polygon。
- 回读对象：`luna-circle` 为 Oval、fill `#c00000`、stroke `#ffffff`、8 pt、4 points；`percent-circle` 为 Oval、fill `#cc3388`、4 points；页面只含 1 个预期说明文字框，隐藏元数据未泄漏。PDF preview 已人工查看，九个预期对象均可见。
- 统一 Skill：`D:/AI/mcp-indesign/skills/indesign-cli/references/html-authoring.md` 已同步基础图元、百分比长度、CSS 圆和 blocked 处理。quick validator 仅报告统一 Skill 既有 frontmatter `tags` 不在通用校验器 allowlist；本轮正文无新增校验问题，未擅自移除公司发布元数据。
