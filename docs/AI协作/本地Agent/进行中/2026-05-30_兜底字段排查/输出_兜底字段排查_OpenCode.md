# 兜底字段排查报告

> 排查日期：2026-05-30  
> 排查范围：`src/paged-html/`、`src/semantic-model/`、`src/indesign-reverse/`、`_indesign_scripts/`、`docs/规范/`、`test/`  
> 目标：发现多字段名模糊读取、旧字段参与编译、缺失字段静默兜底、文档中长期表达兼容读取旧字段的规则

---

## 结论摘要

本次排查共发现 **14 项风险项**，其中 **5 项必须清理**、**6 项需要确认**、**3 项可保留但需注明边界**。

最高风险集中在两处：

1. `src/semantic-model/from-snapshot.js:128` —— 条目语义（`data-id-semantic`）错误地回退到样式 token（`data-id-object-style` / `data-id-paragraph-style`），导致语义与样式混淆，反向回环必然漂移。
2. `docs/规范/LABEL_PROTOCOL.md` 的"兼容读取"表格 —— 以长期规则形式允许旧标签作为兜底，与 `AGENTS.md` 的"混乱标签降级观察"原则冲突。

次高风险是网格相关字段存在 4～5 个别名并存（`*column-gutter*/*column-gap*/*gutter*/*gap*`），虽然没有造成静默假成功，但增加了协议膨胀和误读风险。

已确认为已清理的事项：`data-id-pdf-page` 与 `data-id-page` 已在资产检测和反向 HTML 写出中收紧为唯一字段，旧的 `data-id-page` 不再参与页码读取（仅被检测并报错/忽略）。

---

## 必须清理（5 项）

### 1. 条目语义回退到样式 token —— 语义与样式混淆

- **文件**: `src/semantic-model/from-snapshot.js:128`
- **代码**:
  ```js
  const semantic = attrs['data-id-semantic'] || attrs['data-id-object-style'] || attrs['data-id-paragraph-style'] || null;
  ```
- **风险**: `data-id-semantic` 是语义角色（如 `"title"`, `"body-copy"`, `"drawing-pdf"`），而 `data-id-object-style` 和 `data-id-paragraph-style` 是样式 token（如 `"primary-card"`, `"heading-1"`）。三者是完全不同的概念。当前代码在缺少 `data-id-semantic` 时静默用样式 token 填充 semantic 字段，导致语义模型中将样式误判为语义角色。这会传播到：
  - Instructions 编译（写入错误的 InDesign 标签）
  - 反向导出（用样式名反推语义，产生无效或错误的语义恢复）
- **建议**: 删除后两个回退项。`semantic` 只能来自 `data-id-semantic`。没有该字段时应为 `null`，不应借用样式 token。

---

### 2. 页面语义回退到页面 ID 属性

- **文件**: `src/semantic-model/from-snapshot.js:68`
- **代码**:
  ```js
  const semantic = attrs['data-id-semantic'] || attrs['data-page'] || null;
  ```
- **风险**: `data-page` 是页面标识符/ID（如 `"cover"`, `"agenda"`），在协议中用作页面 token（`from-snapshot.js:79` 也读取它为 `pageToken`）。当页面缺少 `data-id-semantic` 时，代码静默用页面 ID 填充语义字段。虽然在实际 HTML fixture 中 `data-page` 值恰与语义同名（如 `data-page="cover"`），但这只是命名惯例，不是协议保证。在反向导出场景中，如果页面 ID 与语义不一致，将产生错误的语义恢复。
- **建议**: `semantic` 只能来自 `data-id-semantic`。`data-page` 只作为 `pageToken`（页面标识符）使用。如果两者在设计上确实等价，应写文档明确说明 `${data-page}` 同时是页面语义 token，而非在代码中做隐式回退。

---

### 3. PDF 页码在反向作者 HTML 构建时静默回退到 `"1"`

- **文件**: `src/indesign-reverse/author-html-tree.js:252`
- **代码**:
  ```js
  const page = attrs['data-id-pdf-page'] || assetPdfPageNumber(item.asset) || '1';
  ```
- **风险**: 当来源 HTML 缺少 `data-id-pdf-page` 且资产模型也没有 `pageNumber` 时，静默回退到第 1 页。多页 PDF 会显示错误的预览图，且不会产生任何警告。这与 `AGENTS.md` 的"兜底默认有害"原则冲突。虽然 `assetPdfPageNumber` 函数的回退（`placement.pageNumber || asset.pageNumber || asset.page || null`，同文件 line 511）在 `null` 时已有本函数处理，但硬编码的 `'1'` 兜底值会因为假成功而隐藏数据缺失。
- **建议**: 移除 `|| '1'` 兜底。当无法确定页码时：
  - 预览图不生成（或标红缺失）
  - 记录 warning 级别消息
  - 不得静默使用第 1 页

---

### 4. 文档规范中的"兼容读取"表格以长期规则存在

- **文件**: `docs/规范/LABEL_PROTOCOL.md:25-31`
- **内容**:
  ```
  | 来源 | 处理 |
  | ---- | ---- |
  | `pageItem.label` 中的 `html-indesign:id=...` | 旧调试标签，作为对象 ID、role、type 的兜底 |
  | `html_indesign_guide`          | 旧参考线标签，继续读取为 guide 标签 |
  | 母版对象 `label`               | 旧 blueprint 槽位标签，读取为 `legacySlotLabel` |
  | `build_last_result`            | 构建报告，不作为语义标签 |
  ```
- **风险**: AGENTS.md 明确规定"混乱标签降级观察"，旧标签不能作为协议事实。但这份规范以固定文档形式将多个旧标签路径列为"兼容读取"的长期策略，与硬规则冲突。尤其第一条（`pageItem.label` 的 `html-indesign:id=...`），如果代码确实将其作为兜底，意味着未迁移旧标签的 InDesign 文档仍能假成功通过反向导出。
- **建议**: 
  1. 将该表格从"兼容读取"改为"迁移问题来源"，明确旧标签只能进入 `observed` 或 `rejectedFields`，不得写入 `effective`
  2. 确认代码是否已遵循此原则（`label-whitelist.js` 的设计符合白名单原则，但需确认旧 label 路径是否已切到观察模式）
  3. 删除第 362 行 `紧凑 pageItem.label 只用于人类面板和旧调试兼容` 中的"和旧调试兼容"——应改为"作为观察信息"或直接废弃

---

### 5. `reverse-model.js` 中的 legacy style 字段进入结构化输出

- **文件**: `src/indesign-reverse/reverse-model.js:289, 296-301`
- **代码**:
  ```js
  legacy: reverseStyleLegacy(item),
  ```
  ```js
  function reverseStyleLegacy(item) {
    const legacy = {};
    for (const key of ['compositeFont', 'dropCap', 'list', 'grepStyles', 'nestedStyles']) {
      if (item[key] != null) legacy[key] = item[key];
    }
    return Object.keys(legacy).length ? legacy : null;
  }
  ```
- **风险**: `compositeFont`、`dropCap`、`list`、`grepStyles`、`nestedStyles` 是 InDesign 高级排版特性，它们在反向语义模型中被打包为 `style.legacy` 字段，并通过 `html-writer.js:243-245, 517-522` 写入 HTML（`has-dropcap`、`has-bullet-list`、`has-numbered-list` CSS class）。这些字段虽然冠以 `legacy` 之名，但实际上：
  - 进入了正向编译路径（样式模型的合法部分）
  - 进入了反向 HTML 的结构化 class 输出
  - 不是无效观察字段，而是被积极使用的功能字段
  - 字段名 `legacy` 会误导开发者认为它们随时可以删除
- **建议**: 
  1. 将这些字段提升为合法的样式模型字段（`style.compositeFont`、`style.dropCap`、`style.list`、`style.grepStyles`、`style.nestedStyles`），不再包装在 `legacy` 下
  2. 或明确文档说明 `legacy` 在这里的语义是"InDesign-only 高级特性"而非"废弃字段"
  3. 在 `html-writer.js` 中这些字段的使用行为（生成 class）是正确的功能行为，不需要删除，但要规范命名

---

## 需要确认（6 项）

### 6. 网格规范字段: `data-id-grid` vs `data-id-guides`

- **文件**: `src/paged-html/layout.js:172`、`src/paged-html/authoring-validator.js:132`
- **代码**:
  ```js
  const raw = attrs['data-id-grid'] || attrs['data-id-guides'];
  ```
- **风险**: 两个不同的字段名读取同一个网格规格值（`"12x8"` 格式）。实际 fixture 全部使用 `data-id-grid`。`data-id-guides` 可能是旧名称，也可能用于不同的语义（参考线 vs 网格）。如果两者确实等价，应废弃 `data-id-guides` 并在 validator 中报 warning；如果不等价，不应作为回退读取。
- **建议**: 确认 `data-id-guides` 是否在代码历史或任何 fixture 中有独立语义。若没有，删除回退并纳入 validator 的无效字段检查。

---

### 7. 网格间距字段: `data-id-column-gutter` / `data-id-column-gap` / `data-id-gutter` / `data-id-gap` 四路回退

- **文件**: `src/paged-html/layout.js:184-196`、`src/paged-html/authoring-validator.js:150-168`
- **代码**:
  ```js
  attrs['data-id-column-gutter']
    || attrs['data-id-column-gap']
    || attrs['data-id-gutter']
    || attrs['data-id-gap']
    || style.columnGap
  // row 同理
  attrs['data-id-row-gutter']
    || attrs['data-id-row-gap']
    || attrs['data-id-gutter']
    || attrs['data-id-gap']
    || style.rowGap
  ```
- **风险**: 同一个语义事实（列间距/行间距）存在 5 种可能的字段名。实际 fixture 全部使用 `data-id-column-gutter` 和 `data-id-row-gutter`。`data-id-column-gap`/`data-id-row-gap` 是 CSS 命名习惯的别名，`data-id-gutter`/`data-id-gap` 是简写别名。回退链末端的 `style.columnGap`/`style.rowGap` 已被 CSS 推算，存在重复表达风险。
- **建议**: 废弃 `data-id-column-gap`、`data-id-row-gap`、`data-id-gutter`、`data-id-gap` 作为 gutter 别名。如果这些字段有独立语义（如 `data-id-gap` 表示统一间距），应文档化。CSS style 回退（`style.columnGap`）可作为布局推算保留，但不应与显式属性字段竞争。

---

### 8. 基线字段: `data-id-baseline` vs `data-id-baseline-grid`

- **文件**: `src/paged-html/layout.js:199`、`src/paged-html/authoring-validator.js:171`
- **代码**:
  ```js
  const baseline = pageStyleLength(attrs['data-id-baseline'] || attrs['data-id-baseline-grid'], layout);
  ```
- **风险**: 同一值两个字段名。实际 fixture 全部使用 `data-id-baseline`。`data-id-baseline-grid` 可能是旧名。
- **建议**: 废弃 `data-id-baseline-grid`。

---

### 9. 参考线模式字段: `data-id-guide-mode` vs `data-id-guides-mode`

- **文件**: `src/paged-html/layout.js:123`
- **代码**:
  ```js
  const mode = String(attrs['data-id-guide-mode'] || attrs['data-id-guides-mode'] || '').trim().toLowerCase();
  ```
- **风险**: 两个字段名仅相差一个 `s`。实际测试 fixture 使用 `data-id-guide-mode`。`data-id-guides-mode` 很可能是早期命名错误。
- **建议**: 废弃 `data-id-guides-mode`。

---

### 10. 图层显隐字段: `data-id-visible-layers` vs `data-id-pdf-visible-layers`

- **文件**: `src/paged-html/asset-detector.js:96-97`
- **代码**:
  ```js
  visibleLayers: layerListFromAttribute(attributes['data-id-visible-layers'] || attributes['data-id-pdf-visible-layers']),
  hiddenLayers: layerListFromAttribute(attributes['data-id-hidden-layers'] || attributes['data-id-pdf-hidden-layers']),
  ```
- **风险**: 带 `pdf-` 前缀的旧字段名仍然参与编译。正向编译器（`asset-detector.js`）读取 `data-id-pdf-visible-layers` 作为回退；反向写出器（`author-html-tree.js:486-488`）只写 `data-id-visible-layers`。这意味着旧的 `data-id-pdf-*` 字段仅在读取侧兼容，不会被重新写出。但它的存在仍然允许旧 HTML 不经迁移就通过编译，可能隐藏迁移问题。
- **建议**: 
  1. 在 `authoring-validator.js` 中添加对 `data-id-pdf-visible-layers` 和 `data-id-pdf-hidden-layers` 的废弃检测
  2. 一定时间后将 `asset-detector.js` 中的回退移除

---

### 11. 样式 token 与名称的双路径读取

- **文件**: `src/paged-html/style-compiler.js:681-701`
- **代码**:
  ```js
  // display name 属性
  paragraphStyles: ['data-id-paragraph-style-name', 'data-id-style-name']
  // token 属性
  paragraphStyles: ['data-id-paragraph-style', 'data-id-style']
  ```
- **说明**: `styleDisplayAttributes` 和 `styleTokenAttributes` 各返回一个数组，`explicitName` 函数按顺序尝试第一个有值的属性。`data-id-style` 作为上下文感知的简写（在 paragraph 上下文 = paragraph style，在 character 上下文 = character style），`data-id-style-name` 同理。
- **风险与评估**: 
  - `data-id-style` 和 `data-id-style-name` 本身不是冗余字段——它们是有意设计的上下文感知简写
  - 但 `styleDisplayAttributes` 中 `data-id-style-name` 作为全部 kind 的回退（line 689: `return byKind[kind] || ['data-id-style-name']`）存在语义模糊——如果在非标准 kind 上下文中读取，可能会读到错误的值
  - `styleTokenAttributes` 同理
- **建议**: 此处的多数组读取是协议设计特性，但需要对未知 kind 的回退做更严格的限制。建议未知 kind 返回空数组而非 `['data-id-style-name']` / `['data-id-style']`。

---

## 可保留的兼容边界（3 项）

### 12. 资产路径别名（`author-asset-packager.js`、`asset-reference-policy.js` 中的 `fallback` / `aliases`）

- **路径**: `src/indesign-reverse/author-asset-packager.js:64-65, 75`、`src/indesign-reverse/asset-reference-policy.js:68, 126, 146, 253, 267-285`
- **说明**: 资产引用可能通过多个路径可达（`src`、`data`、`preview.src`、`asset.path`），且资产在 NAS 中可能有别名。`fallback` 和 `aliases` 字段用于资产解析，不是语义协议字段。这是合理的兼容边界。
- **保留条件**: 确保 `fallback`/`aliases` 不参与语义模型的结构化字段（`semantic`、`styleRefs`、`layout`），仅用于文件路径解析。

---

### 13. 字体回退 (`style-compiler.js:893-899`)

- **路径**: `src/paged-html/style-compiler.js:893-899`
- **代码**:
  ```js
  const family = selectFontFamily(fontFamily, text, options) || options.fontFallback || 'Arial';
  ```
- **说明**: 字体回退是排版渲染的基本需求——当 HTML 中声明的字体不可用时，必须有合理的替代。`Arial` 作为默认是行业惯例。这不是语义协议字段问题，而是排版存活性的必要边界。
- **保留条件**: 确保缺失字体至少有 warning 级别日志记录（当前代码 `line 304` 已有 `FONT_MISSING` warning）。

---

### 14. `data-id-fit` 静默回退到 CSS 推算

- **路径**: `src/paged-html/asset-detector.js:88`
- **代码**:
  ```js
  fit: attributes['data-id-fit'] || (contentBox ? 'manual' : null) || (hasBackgroundSource ? fitFromBackgroundSize(...) : computedStyle.objectFit) || 'fill'
  ```
- **说明**: `data-id-fit` 是资产适配方式（`fill`/`contain`/`cover`/`manual`）。当 HTML 未声明此属性时，代码从 CSS 推算默认值。CSS 推算（`objectFit`、`backgroundSize`）与 InDesign 的 `fill`/`contain` 约定有天然映射关系。`|| 'fill'` 作为终极回退来自 `object-fit: fill` 的 CSS 默认值，是规范行为。
- **保留条件**: 这是 CSS 标准行为的翻译，不是静默兜底。但终端的 `'fill'` 值缺少任何日志记录——如果是因为所有条件都不满足走到这里（理论上不会，因为 `objectFit` 在浏览器中几乎总有值），应产生 warning。

---

## 文档侧补充发现

### D1. `LABEL_PROTOCOL.md:295` 关于 PDF 页码的规定

规定明确："旧字段 `data-id-page` 只能作为无效观察字段或迁移问题记录，不能作为新写出的协议字段，也不能作为读取兜底。" 代码已遵循此原则（见 `asset-detector.js:92` 只读取 `data-id-pdf-page`，`to-instructions.test.js:177` 有显式测试确保旧字段不编译）。**此处文档正确，无需修改。**

### D2. `HTML_INDESIGN_LIBRARY_SPEC.md:749` 关于 PDF 页码的说明

与 D1 一致，明确规定历史 `data-id-page` 不作为读取兜底。**文档正确。**

### D3. `HTML_INDESIGN_LIBRARY_SPEC.md:1048` 关于紧凑 label

"紧凑 `pageItem.label` 只能作为人类面板和旧调试兜底，不能替代 `html_indesign` JSON 标签。" — 此规定与 `LABEL_PROTOCOL.md:25` 的"兼容读取"表格存在矛盾：一个说只能作为调试兜底，另一个说"作为对象 ID、role、type 的兜底"。需统一表述。

### D4. `REVERSE_EXPORT.md:150` 关于顶层 `deck.html` 兼容别名

"顶层 `deck.html` 只作为旧调用方的兼容别名，语义上仍是视觉输出。" — 这是文件组织层面的兼容，不涉及语义字段兜底。可保留，但建议标注废弃时间线。

---

## 代码侧非字段兜底的类似模式（不纳入本次但值得后续关注）

以下模式与本次"字段兜底"不同，但同样是"没有明确值就默认填值"的设计：

| 位置 | 模式 | 说明 |
| ---- | ---- | ---- |
| `src/semantic-model/to-instructions.js:224-225` | `labelsFor(labels, fallback)` — 标签缺失时创建默认协议标签 | 会导致非协议对象被标记为协议对象 |
| `src/semantic-model/to-instructions.js:464-468` | `styleLengthMm(item, prop, fallback)` — CSS 长度解析失败时用 `fallback` 值 `0` | 可能导致几何值错误平移 |
| `src/semantic-model/to-instructions.js:471-475` | `styleLengthTarget(item, prop, fallback, layout)` — 同上 | 同上 |
| `src/paged-html/browser-snapshot.js:353` | `itemIdFor` 回退到 `p${pageIndex + 1}-el${itemIndex + 1}` | 无 ID 时生成不稳定 ID，在反向回环中可能无法匹对 |
| `src/paged-html/browser-snapshot.js:517` | page ID 回退 `data-page \|\| data-page-id \|\| auto-generated` | 同上，两个 `data-*` 页面 ID 属性并存 |

---

## 与已完成的 PDF 页码收紧的对照

已完成的 `data-id-pdf-page` 收紧（只读 `data-id-pdf-page`，忽略 `data-id-page`）是一个正确的清理模式，可作为其余字段清理的模板：

| 已完成的清理 | 待清理的同类问题 |
| ------------ | ---------------- |
| `data-id-pdf-page` 唯一字段 | `data-id-grid` / `data-id-guides` 双字段 |
| `data-id-page` 降级为无效观察 | `data-id-pdf-visible-layers` / `data-id-pdf-hidden-layers` 旧前缀 |
| `to-instructions.js:177` 的拒绝测试 | 其他旧字段也应有等效拒绝测试 |
| validator 不认 `data-id-page` | validator 应不认 `data-id-guides`、`data-id-gap` 等别名 |

---

## 排查完整性说明

以下范围已搜查但未发现同类问题：
- `_indesign_scripts/` 下的 JSX 文件：`build_from_instructions.jsx` 中只有 bootstrap 错误处理的 `fallback` 变量（错误响应，非语义字段），其余 debug 脚本无字段兜底
- `test/` 下的测试文件：测试覆盖了已清理的 `data-id-page` 拒绝行为，无测试依赖旧字段兜底（`asset-detector.test.js:61`、`to-instructions.test.js:177`）
- `test/fixtures/` 下的 HTML：全部使用 `data-id-pdf-page`、`data-id-grid`、`data-id-column-gutter` 等当前规范字段，未发现旧字段残留

未覆盖但建议后续补充的排查：
- `src/paged-html/` 中 CSS 属性到构建指令的映射表（是否存在多 CSS 属性映射到同一 InDesign 样式字段的兜底）
- `_indesign_scripts/` 中 InDesign 端的 JSX 库（`lib/` 目录当前为空，未来添加脚本时应注意字段唯一性）
