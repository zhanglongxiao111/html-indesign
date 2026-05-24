# HTML -> InDesign 翻译层审计（2026-05-24）

## 1. 审计结论

### 1.1 当前比较可靠的类别

- 资源发现与路径解析：`src/paged-html/asset-detector.js` 对 `raster/svg/pdf` 的识别、相对路径解析、中文和空格路径解析目前比较可靠；`assetForItem` 已按精确 `src` 优先绑定，能避免同类 `img.large-media` 误绑。
- 基本文本样式：普通 `h1/h2/p/li/figcaption` 的段落样式、内联 `span/strong/em` 字符样式、显式 `pt` 写入已经比较稳定。近期字体尺寸单位修复已生效。
- 简单线性透明渐变遮罩：`background: linear-gradient(...)` 且本质是“同色到透明”的遮罩时，当前 `gradientFeather.scope = 'fill'` 的链路比之前可靠很多。
- 简单层级：`applyNestedPaintOrder()` 能把子文本抬到父容器背景之上，`instructions.layers` 的层顺序也已经固定下来。
- 不对称左侧装饰条：`compileInstructions()` 已能为 `border-left` 明显不同于其他边的卡片生成单独装饰条对象，先前“卡片左红条丢失”的问题在这一类矩形卡片上已有明确修复。

### 1.2 当前仍不可靠的类别

- “图框”和“置入内容”分离的图形：尤其是 `PDF/object` 包裹在外层 `div.drawing-frame` 的情况，外层边框、底色、圆角、裁切语义会直接丢。
- CSS 边框线宽与 InDesign 描边：当前是系统性失真，不是个别样式问题；细线最明显。
- 对象样式 / 框架样式：编译层已经产出 `objectStyles` / `frameStyles`，但执行层只真正消费了极少数字段，导致圆角、描边样式、overflow、inset、非居中裁切等大面积失效。
- 表格：当前只算“能生成一个表”，还远不到“浏览器 HTML 与 InDesign 对齐”。列宽、合并单元格、表头样式、表格外框样式都不可靠。
- 独立 `span` 文本、legend、小装饰元素：当前快照候选选择器过窄，导致一部分真实语义根本没进 IR。
- 旋转线条 / transform：当前只能采到浏览器渲染后的包围盒，不能生成原生旋转对象。
- 圆角、圆形、阴影、页面底色、复杂渐变 / mask：要么完全未落地，要么只支持很窄的一支情况。

### 1.3 本次审计方式

- 读取 fixture：`test/fixtures/e2e/architecture-report/deck.html` 及其资源。
- 审核核心代码：
  - `src/paged-html/browser-snapshot.js`
  - `src/paged-html/style-compiler.js`
  - `src/paged-html/instructions-compiler.js`
  - `_indesign_scripts/lib/hi_styles.jsxinc`
  - `_indesign_scripts/lib/hi_items.jsxinc`
  - `_indesign_scripts/lib/hi_assets.jsxinc`
  - 相关测试与 fixture
- 只做非破坏性检查：运行了本地 snapshot / compile / validation 脚本和少量浏览器测量；**没有打开、关闭或改动任何 InDesign 文档**。

## 2. 丢失的语义 / 样式

### 2.1 PDF 图框边框、底色、圆角与裁切容器直接丢失

**浏览器 HTML 预期**

- `test/fixtures/e2e/architecture-report/deck.html:436-438` 中，真实视觉图框是外层 `div.drawing-frame`：
  - `border: 1pt solid #aeb8b8`
  - `border-radius: 4px`
  - `overflow: hidden`
  - 内层 `<object class="pdf-source">` 只是置入 PDF 资源源。

**当前 InDesign 结果 / 风险**

- snapshot 只抓到了内层 `object.pdf-source`，外层 `div.drawing-frame` 被 `data-id-ignore` 排除。
- 实测编译结果里，PDF 对象 `p5-el4` 的 bounds 是 `{ x: 145.26, y: 22.26, width: 237.47, height: 167.47 }`，比 HTML 图框 `{145, 22, 238, 168}` 内缩约 `1px` 四边，说明拿到的是边框内侧内容框而不是视觉图框。
- 最终 InDesign 会得到“能 place PDF 的矩形”，但缺少 HTML 图框本身的边框、底色、圆角和真实裁切容器语义。

**疑似代码位置**

- `test/fixtures/e2e/architecture-report/deck.html:436-438`
- `src/paged-html/browser-snapshot.js:154-156`
- `src/paged-html/browser-snapshot.js:182-206`
- `src/paged-html/instructions-compiler.js:76-93`
- `_indesign_scripts/lib/hi_items.jsxinc:57-75`

**根因判断**

- 当前模型把“图框”与“置入资源”绑定在同一个 DOM 元素上。
- 但 PDF fixture 里，带边框/圆角/overflow 的是外层 wrapper，带 `data` 资源地址的是内层 `object`。快照层没有合成这两个层次。
- `data-id-ignore` 把 wrapper 完全排除后，编译器只能把 inner object 当成最终 GraphicFrame。

**建议修复方向**

- 第一优先级不是微调 executor，而是修正 IR：把 “frame geometry/style” 与 “placed asset source” 明确拆成两段。
- 对 `object/embed/img` 这类占满父容器的资源节点，优先识别其最近的“视觉 frame 容器”；用父容器生成 `GraphicFrame`，用子节点提供 `src/data`、`pageNumber`、`crop`、`fit`。
- 对固定语义 HTML，建议约定显式语义：例如 wrapper 带 `data-id-object` / `data-id-frame-style`，资源子节点只带 `data-id-asset-*`。

**优先级**

- `P0`

### 2.2 独立 `span` 文本与 legend 子项没有进入 snapshot

**浏览器 HTML 预期**

- `span.page-number`（`deck.html:360`, `388`, `407`, `429`, `450`, `461`, `518`）是每页页码。
- `legend` 中 3 个标签文本（`deck.html:402-405`）和 3 个色块 `span.swatch` 共同构成图例。

**当前 InDesign 结果 / 风险**

- 这些元素没有生成对应 `TEXT` / `SHAPE` 指令。
- 直接后果：
  - 7 个页码全部丢失。
  - site-analysis 页的 legend 标签文本丢失。
  - legend 色块也丢失。
- 当前 site-analysis 页只剩一个空的 `div.legend` 背景容器，没有图例内容。

**疑似代码位置**

- `src/paged-html/browser-snapshot.js:94-117`
- `src/paged-html/browser-snapshot.js:154-155`
- `src/paged-html/browser-snapshot.js:279-283`

**根因判断**

- 候选选择器只包含 `h1...figcaption,img,object,embed,svg,canvas,table,[data-id-object]`。
- 独立 `span` 不在白名单内；`roleFromTag()` 也不把 `span` / `div` 判成文本。
- `legend` 子标签虽然带 `data-id-paragraph-style="legend-label"`，但因为不是 `p/li/h*`，也没有 `data-id-object`，所以被完全跳过。

**建议修复方向**

- 候选选择器应从“标签白名单”改成“语义标记优先”，至少补上：
  - `[data-id-paragraph-style]`
  - `[data-id-character-style]`（仅当它是独立对象，不是 inline run）
  - 某些明确的装饰对象标记，例如 `[data-id-object-style]`
- `roleFromTag()` 需要允许 `span` / `div` 在具备明确文本语义时落成 `text`。
- 同时要避免和父级 `p/h*` 的 inline run 重复采集，建议以 `data-id-paragraph-style` 作为“独立文本对象”的主开关。

**优先级**

- `P0`

### 2.3 表格语义只保留了“文本矩阵”，没有保留完整表格样式资源

**浏览器 HTML 预期**

- `deck.html:468-509` 的 `table.data-table` 有表头、表体、单元格 padding、边框、背景、段落样式、自动列宽。
- `th/td` 上显式写了 `data-id-paragraph-style="table-heading"` / `table-body`。

**当前 InDesign 结果 / 风险**

- 单元格内容能进 `rows`，但：
  - `table-heading` / `table-body` 段落样式没有被创建。
  - `table-frame` 对象样式没有被消费。
  - `cellStyles` 全链路未启用。
  - `rowSpan` / `colSpan` 虽然被采集，但从未应用。
- 当前 validator 仍会返回 `valid: true`，存在“语义已经丢了但没人报警”的问题。

**疑似代码位置**

- `src/paged-html/browser-snapshot.js:119-138`
- `src/paged-html/style-compiler.js:83-90`
- `src/paged-html/style-compiler.js:328-352`
- `src/paged-html/style-compiler.js:13-24`
- `src/paged-html/instructions-validator.js:86-121`
- `_indesign_scripts/lib/hi_styles.jsxinc:3-11`
- `_indesign_scripts/lib/hi_items.jsxinc:89-187`

**根因判断**

- `compileTableCell()` 只把 `paragraphStyle` 名字记下来，没有调用 `ensureParagraphStyle()` 去创建资源。
- `validateInstructions()` 只校验顶层 `TEXT` item 的 `paragraphStyle`，不校验 table cell 的 `paragraphStyle`。
- 执行层 `HI.applyTableCell()` 只做直接格式设置，不处理 `fontWeight/fontStyle/appliedFont/tracking`，因此一旦 `table-heading` style 不存在，表头加粗等语义会悄悄丢失。
- `cellStyles` 在 style model 中存在，但编译和 executor 都没真正使用。

**建议修复方向**

- 让 `compileTableCell()` 调用 `ensureParagraphStyle()`，至少把 `table-heading` / `table-body` 生成出来。
- 在 `validateInstructions()` 中补 table cell style ref 检查。
- 明确决定第一版表格策略：
  - 要么“native table but limited”：
    - 补 paragraph style、cell style、merge、column widths、row heights
  - 要么“fidelity-first fallback”：
    - 复杂表格栅格化，简单表格走 native

**优先级**

- `P1`

### 2.4 页面底色没有进入 InDesign 页面模型

**浏览器 HTML 预期**

- `.page` 在 `deck.html:37-44` 使用了 `background: var(--paper)`，不是纯白页。

**当前 InDesign 结果 / 风险**

- 当前快照只记录 page `widthCss` / `heightCss`，不记录 page background。
- 除被其它对象完全覆盖的区域外，InDesign 页面会回退到默认白纸，和 HTML 的暖白底色不一致。

**疑似代码位置**

- `src/paged-html/browser-snapshot.js:151-176`
- `src/paged-html/browser-snapshot.js:208-217`

**根因判断**

- 页面容器目前只被当成“坐标系”，没有被当成可翻译对象。

**建议修复方向**

- 在 page model 中增加 page background 描述；若背景非透明，则在每页最底层生成一个 page-sized shape。

**优先级**

- `P2`

## 3. 翻译不准确的问题

### 3.1 CSS 边框线宽系统性偏细，`1pt` 会落成 `0.75pt`

**浏览器 HTML 预期**

- `metric-card`, `map-frame`, `chapter`, `annotation`, `table cell` 等大量对象使用 `1pt` 边框。
- `dot` 使用 `1mm` 白色边框。
- `chapter` 左边装饰条使用 `3mm`。

**当前 InDesign 结果 / 风险**

- 非破坏性 snapshot 实测：
  - `metric-card` 的 `borderTopWidth` 已变成 `"1px"`
  - `dot` 的 `borderTopWidth` 变成 `"3px"`
  - `chapter` 的 `borderLeftWidth` 变成 `"11px"`
- 编译器随后把这些“已被浏览器像素化”的宽度再换算成 pt：
  - `1px -> 0.75pt`
  - `3px -> 2.25pt`
  - `11px -> 8.25pt`
- 这会导致：
  - 所有原本 `1pt` 的线在 InDesign 中偏细 25%
  - `1mm` 白边也会偏细
  - 细边框和表格线最明显

**疑似代码位置**

- `src/paged-html/style-compiler.js:235-243`
- `src/paged-html/style-compiler.js:311-317`
- `src/paged-html/style-utils.js:141-148`

**根因判断**

- 当前直接信任 `getComputedStyle()` 的 border width。
- 但 Chromium 会把很多 border 宽度算成像素值，并发生像素对齐；`1pt` 最终常变成 `1px`。
- 编译层把“像素化结果”当成设计真值再换算为 pt，误差被固定下来。

**建议修复方向**

- 不要仅依赖 `computedStyle.border*Width` 作为设计宽度来源。
- 对固定语义 HTML，建议引入“样式真值”通道：
  - 优先读取显式语义 token / data attribute
  - 或从 CSSOM 中读取 cascade 后但未像素对齐的声明值
- 如果短期只能继续走 `computedStyle`，至少要对常见 thin border 做规则修正，并把误差写入 warning。

**优先级**

- `P0`

### 3.2 边框不仅“数值偏细”，映射模型本身也不等价

**浏览器 HTML 预期**

- HTML 中 `box-sizing: border-box`，边框吃进盒子内部。

**当前 InDesign 结果 / 风险**

- executor 只设置了 `strokeWeight`，没有设置 `strokeAlignment`。
- 即使把数值修正正确，InDesign 默认居中描边仍可能让视觉外框比 HTML 更“胀”。

**疑似代码位置**

- `_indesign_scripts/lib/hi_styles.jsxinc:112-130`

**根因判断**

- 当前对象样式只设置 `fillColor` / `strokeColor` / `strokeWeight` / `opacity`，没有把 CSS box model 翻成 InDesign stroke alignment 语义。

**建议修复方向**

- 对矩形边框优先尝试 inside stroke alignment；如果某类对象不支持 inside alignment，则用 bounds shrink / expand 做补偿。

**优先级**

- `P1`

### 3.3 `objectStyles` / `frameStyles` 只编译，不执行

**浏览器 HTML 预期**

- 编译器已经在 style model 里保留了：
  - `strokeStyle`
  - `cornerRadius`
  - `overflow`
  - `frameStyles.fit/position/inset/overflow`

**当前 InDesign 结果 / 风险**

- `HI.ensureStyles()` 根本不处理 `frameStyles` 和 `cellStyles`。
- `HI.ensureObjectStyles()` 也没有消费 `strokeStyle`、`cornerRadius`、`overflow`。
- `instructions-validator` 会校验 `frameStyle` 是否存在，但 executor 并不应用它，给出一种“看起来支持 frame style”的假象。

**疑似代码位置**

- `src/paged-html/style-compiler.js:230-260`
- `src/paged-html/style-compiler.js:355-378`
- `src/paged-html/instructions-validator.js:113-120`
- `_indesign_scripts/lib/hi_styles.jsxinc:3-11`
- `_indesign_scripts/lib/hi_styles.jsxinc:112-130`
- `_indesign_scripts/lib/hi_items.jsxinc:57-87`

**根因判断**

- 当前 style model 和 executor 能力边界不一致：宿主侧 IR 已经长出来了，JSX 侧还停在最小集。

**建议修复方向**

- 先决定 object/frame style 的边界：
  - `objectStyle`：fill/stroke/corner/opacity/stroke alignment
  - `frameStyle`：fit/object-position/inset/clipping
- 然后按这个边界把 JSX 补齐；不要继续让 `frameStyle` 只停留在 JSON 里。

**优先级**

- `P0`

### 3.4 圆角、圆形和圆角裁切没有落到 InDesign

**浏览器 HTML 预期**

- `metric-card` / `chapter` / `map-frame` / `annotation` / `drawing-frame` 都有圆角。
- `dot` 是 `5mm x 5mm` 的正圆，且有白色圆环。

**当前 InDesign 结果 / 风险**

- `createShapeFrame()` 永远调用 `page.rectangles.add()`。
- `cornerRadius` 虽然被编译到 `objectStyles`，但 executor 完全没应用。
- `dot` 最终会变成一个带白描边的正方形，而不是圆点。
- 图形框的圆角裁切也不会成立，因此 placed SVG/PDF 仍是直角裁切。

**疑似代码位置**

- `src/paged-html/style-compiler.js:240`
- `_indesign_scripts/lib/hi_styles.jsxinc:112-130`
- `_indesign_scripts/lib/hi_items.jsxinc:77-87`

**根因判断**

- 形状层没有“矩形 / 圆角矩形 / 椭圆 / 线”的区分。
- `cornerRadius` 只是被当成元数据保存。

**建议修复方向**

- 先支持最常见的两类：
  - `border-radius: 50%` 且宽高相等 -> `ovals.add()`
  - 普通圆角矩形 -> 在 rectangle 上应用 4 corner options / radius
- 图形框也要同步支持圆角路径，保证 placed asset 被同一路径裁切。

**优先级**

- `P1`

### 3.5 旋转标注线被翻成了“轴对齐矩形”

**浏览器 HTML 预期**

- `deck.html:397` 和 `400` 的标注线分别是 `rotate(-22deg)` 和 `rotate(28deg)`。

**当前 InDesign 结果 / 风险**

- snapshot 能看见 `transform`，但 compiler 只发 warning，不做原生变换。
- 最终指令里这两个对象的 bounds 已经变成旋转后包围盒，例如：
  - `{ x: 268.95, y: 84.78, width: 42.75, height: 17.48 }`
  - `{ x: 222.94, y: 130.01, width: 38.09, height: 20.42 }`
- executor 再拿这个包围盒创建普通 rectangle，视觉上会得到红色斜线的“矩形块”，不是线。

**疑似代码位置**

- `src/paged-html/style-compiler.js:253-258`
- `_indesign_scripts/lib/hi_items.jsxinc:77-87`

**根因判断**

- 当前 IR 没有旋转角度 / 原始未旋转长度 / transform origin。
- 也没有 line / path 类型，只有 rectangle shape。

**建议修复方向**

- 对 `height:0` + `border-top` 的线类对象，单独建模成 `LINE`。
- 在 snapshot 中保留原始 `left/top/width/transform-origin/angle`，不要只保留旋转后的 bounding box。

**优先级**

- `P1`

### 3.6 图片 / PDF 裁切锚点只支持居中，不支持真实 `object-position`

**浏览器 HTML 预期**

- 编译层和测试已经承认 `object-position` 是一等语义；例如 `test/paged-html/style-compiler.test.js:35-37` 断言 `hero-image-frame.position === '0% 0%'`。

**当前 InDesign 结果 / 风险**

- `HI.applyFitting()` 只处理：
  - `contain`
  - `cover`
  - `fill`
  - 以及 `position === '50% 50%' || 'center'`
- 所有非居中裁切锚点都会被静默忽略。

**疑似代码位置**

- `src/paged-html/style-compiler.js:355-378`
- `_indesign_scripts/lib/hi_assets.jsxinc:66-77`

**根因判断**

- `frameStyle.position` 已编译，但 executor 没有把 CSS 百分比锚点映射到 InDesign 内容对齐 / move 策略。

**建议修复方向**

- 先支持 9 宫格锚点：`0/50/100% x 0/50/100%`。
- 如果要继续支持任意百分比，再在 `fit()` 后追加内容偏移修正。

**优先级**

- `P1`

### 3.7 表格列宽、行高和合并单元格没有按浏览器布局翻译

**浏览器 HTML 预期**

- 浏览器会根据内容自动分配列宽。
- 本次实测该 fixture 表头 4 列宽度分别约为：
  - `315.89px`
  - `170.78px`
  - `120.88px`
  - `290.97px`

**当前 InDesign 结果 / 风险**

- `browser-snapshot.js` 没有记录 cell rect。
- `HI.fitTableToFrame()` 直接把总宽均分给每一列：
  - `table.columns.everyItem().width = item.bounds.width / columnCount`
- 所以当前表格必然变成四列等宽，和 HTML auto table layout 明显不一致。
- `rowSpan` / `colSpan` 只被记录，没有 merge 逻辑。

**疑似代码位置**

- `src/paged-html/browser-snapshot.js:119-138`
- `_indesign_scripts/lib/hi_items.jsxinc:146-156`
- `src/paged-html/style-compiler.js:335-336`

**根因判断**

- 表格 IR 缺少 cell geometry，executor 只能走“平均列宽”简化版。

**建议修复方向**

- 在 snapshot 阶段记录每个 `th/td` 的 rect。
- 编译时转成列宽数组、行高数组、merge 指令。
- executor 再按数组设置列宽 / 行高，并处理 merge。

**优先级**

- `P1`

### 3.8 表格表头的字重等文本语义会丢

**浏览器 HTML 预期**

- `deck.html:333-336` 的 `th` 具有深色底、白字、`font-weight: 700`。

**当前 InDesign 结果 / 风险**

- `compileTableCell()` 只保留：
  - `fillColor`
  - `textColor`
  - `pointSize`
  - `leading`
  - `textAlign`
  - `border*`
  - `padding`
- 没有保留 `fontWeight` / `fontStyle` / `appliedFont`。
- 而 `table-heading` paragraph style 又没有被创建，所以表头 bold 很可能会丢。

**疑似代码位置**

- `src/paged-html/style-compiler.js:328-352`
- `_indesign_scripts/lib/hi_items.jsxinc:173-187`

**根因判断**

- 表格文本走了一条独立于普通文本的简化路径，字段明显不完整。

**建议修复方向**

- 表格单元格文本应尽量复用普通 paragraph style / character style 模型，而不是单独保留一套阉割字段。

**优先级**

- `P1`

### 3.9 半透明背景被翻成“对象整体透明”，描边也会一起变淡

**浏览器 HTML 预期**

- `metric-card` 使用 `background: rgba(251, 250, 247, .92)`，但边框 `border: 1pt solid var(--line)` 是不透明描边。

**当前 InDesign 结果 / 风险**

- 编译层把背景 alpha 乘进了 object opacity。
- executor 再把 opacity 直接应用到整个对象。
- 结果是：卡片边框也会变成 92% 透明，不等于浏览器效果。

**疑似代码位置**

- `src/paged-html/style-utils.js:4-21`
- `src/paged-html/style-compiler.js:411-420`
- `_indesign_scripts/lib/hi_styles.jsxinc:250-257`

**根因判断**

- 当前模型没有“fill alpha”和“object alpha”的分离。

**建议修复方向**

- 对背景色 alpha 优先使用 fill-level transparency，而不是 object-level opacity。
- object opacity 只在 CSS 的 `opacity` 明确作用于整个元素时再使用。

**优先级**

- `P2`

### 3.10 渐变遮罩这条链路修过了，但支持面仍然很窄

**浏览器 HTML 预期**

- `veil` 的 `linear-gradient(90deg, rgba(...), rgba(...), rgba(...))` 是“同色白色到透明”的遮罩。

**当前 InDesign 结果 / 风险**

- 这一条链路当前基本正确，是本次审计里相对稳定的一项。
- 但代码仍然只支持：
  - `linear-gradient(...)`
  - 只保留 stop 的 opacity
  - fill 色取第一站颜色
  - `gradientStartForBounds()` 只对 `0/90/180/270` 四个角度有专门处理
- 也就是说：
  - 多色渐变会被错误翻成“第一种颜色 + 透明羽化”
  - 非正交角度会退化
  - `mask-image` / `radial-gradient` / 多背景都不支持

**疑似代码位置**

- `src/paged-html/style-utils.js:23-54`
- `src/paged-html/style-utils.js:74-131`
- `src/paged-html/style-compiler.js:262-297`

**根因判断**

- 当前实现其实是“把特定 CSS 渐变拟合成 InDesign gradient feather”，不是完整 background / mask 翻译器。

**建议修复方向**

- 继续保留现有“同色透明罩” fast path。
- 对多色或复杂 mask 明确走 fallback，不要静默近似。

**优先级**

- `P2`

## 4. 目前未覆盖但代码层已明显不支持的类别

### 4.1 阴影

- `browser-snapshot.js:27-74` 的 `snapshotStyleProps` 里没有 `boxShadow`。
- `_indesign_scripts/lib/hi_styles.jsxinc` 也没有 drop shadow 相关应用逻辑。
- 结论：当前任何 `box-shadow` 都不会进入 IR，更不会进入 InDesign。

### 4.2 `clip-path` / `mask-image` / `filter`

- 当前 snapshot 不采这些属性，compiler / executor 也没有对应字段。
- 这意味着除“线性透明渐变 -> gradient feather”这条特例之外，复杂遮罩和滤镜类视觉效果仍然不在支持面内。

### 4.3 伪元素

- 当前快照完全不处理 `::before` / `::after`。
- 如果后续固定语义 HTML 用伪元素承载装饰线、角标、编号，这些语义会直接消失。

## 5. 测试与校验缺口

- `test/paged-html/instructions-compiler.test.js:23-36` 只校验 PDF 的 `assetId/pageNumber/crop/frameStyle`，没有校验图框边框、背景、圆角是否保留。
- `test/paged-html/style-compiler.test.js:21-38` 只证明 `frameStyles` 被编出来了，没有证明 executor 真正应用了它。
- `test/indesign-executor/executor-script-static.test.js:62-120` 基本都是“源码里是否出现某个 token”的静态断言，不覆盖视觉语义。
- 当前没有测试覆盖：
  - `span.page-number` / `legend-label` 这类独立 span 文本是否进入 snapshot
  - PDF wrapper frame 是否被保留
  - `object-position != center` 是否落地
  - `cornerRadius` / circle 是否落地
  - 旋转 line 是否落地
  - table cell paragraph style 是否被创建
  - table column widths 是否跟浏览器一致
  - fill alpha 与 stroke alpha 是否被正确分离

## 6. 建议的下一步整理 / 修复顺序

1. 先修 IR 边界：把 `GraphicFrame` 与 inner asset source 分开，解决 PDF / image wrapper frame 丢失。
2. 同时修 snapshot 选择器：以语义标记为主，补进 `page-number`、legend label、必要的小装饰对象。
3. 补 executor 对 `objectStyle` / `frameStyle` 的真实消费，优先落地：
   - `cornerRadius`
   - stroke alignment
   - `object-position`
   - clipping / overflow
4. 单独收敛表格策略，不要继续让 table 走“半支持”状态：
   - paragraph style / cell style
   - column widths / row heights
   - merge
5. 最后再扩展复杂视觉效果：
   - non-center crop 精细对齐
   - 多色渐变 / mask fallback
   - 阴影 / filter 的支持边界

