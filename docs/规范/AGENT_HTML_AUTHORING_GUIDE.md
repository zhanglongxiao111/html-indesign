# Agent HTML 编写说明书

## 1. 目的

本文说明 Agent 编写固定分页 HTML 作者包时必须满足的要求。

这些要求的目标不是限制排版自由，而是保证 HTML 导出到 InDesign 后，再反向导回 HTML 时，系统能把原作者结构判定为可信结构，并让语义重建算法只观察、不改写。

当前代码保护的是这类结构：

```text
Agent 作者包 HTML
-> HTML Adapter
-> 统一语义模型
-> InDesign Writer / Executor
-> 带 html_indesign 标签的 InDesign
-> InDesign Adapter 反向读取
-> labelStatus: "accepted" + sourceNode
-> trustedSourcePreservation 门禁保护
```

如果 Agent 写出的 HTML 不能被协议识别，反向读取时对象会变成 `partial`、`observed` 或 `rejected`。这类对象不属于可信作者结构，语义重建算法可以介入重建。

### 1.1 规则级别和动态创作边界

本文规则分为硬要求、条件硬要求和建议：

- **硬要求**：最终交付给转换链路的是静态作者包；协议、资源、页面结构和 `lint:authoring --strict` 必须合规。
- **条件硬要求**：普通单次转换只证明当前静态页面可编译；作出无损回环声明时，才必须完成真实 InDesign 双回环和零漂移门禁。
- **建议**：Agent 可以按页面复杂度选择组件体系和 CSS 组织方式，不要求固定前端框架。

React、Vue 和图表库可以用于创作阶段，但在转换前必须生成确定的静态 HTML/CSS/SVG：

- Canvas 必须转换为 SVG 或原生可回读结构。
- 动画必须固定到明确帧或最终状态。
- 异步数据必须固定到作者包，转换时不得依赖接口请求。
- 最终作者包不得依赖可执行脚本、远程运行时脚本或远程 stylesheet；`application/json` 协议载荷允许保留。

`lint:authoring --strict` 对上述静态化边界给出稳定错误码。它证明输入符合静态转换前提，不等同于证明浏览器与 InDesign 无损；无损结论仍以真实双回环报告为准。

## 2. 最小合格标准

Agent 编写的 HTML 作者包必须满足以下条件：

- 使用作者源码包，不直接手写或手改生成后的 `deck.html`。
- 每个页面片段只有一个 `<section class="page">`。
- 每页有稳定页面 ID、布局 token、边距和主网格。
- 每个需要长期编辑、回读或追踪的页面对象都有稳定 `id`。
- 每个可见版面对象都有明确布局归属：主网格对象、母版/页面家具、封面/背景对象、标注对象或明确自由定位对象。
- 页面结构用自然 HTML 表达，不为了转换写反常 DOM。
- 样式主要放在 CSS 类和语义 token 中，少用一次性内联样式。
- 资源使用真实元素和可追踪路径，不用截图假装 PDF、图片或 SVG。
- 新增协议字段必须来自 `src/protocol/` 注册表，不自造同义字段。
- 修改后必须重新组装并跑作者侧严格检查。

Agent 初始编写的 HTML 必须主动声明这些事实。语义重建算法只用于人类 InDesign、混乱标签或无语义来源的补救；不能依赖算法替 Agent 猜回本来应该写清楚的对象归类。

## 3. 作者包结构

推荐目录：

```text
deck.config.json
pages/*.html
styles/tokens.css
styles/layout.css
styles/components.css
styles/pages.css
assets/
deck.html
```

Agent 默认只编辑：

- `pages/*.html`
- `styles/*.css`
- 项目需要时编辑 `semantic-preset.json`

Agent 不应手改：

- `deck.html`
- 反向导出的临时报告
- `test/workspace/` 里的真实 E2E 产物

`deck.html` 是组装结果。修改源码包后必须运行：

```powershell
npm run assemble:authoring -- -- --package <deck.config.json>
```

## 4. 页面必须声明的事实

每个页面片段应类似：

```html
<section class="page"
         data-page="facade-analysis"
         data-id-layout="image-analysis"
         data-id-margin="36 48 36 48"
         data-id-grid="12x8"
         data-id-column-gutter="12"
         data-id-row-gutter="12"
         data-id-parent-page="report-parent">
  ...
</section>
```

必需字段：

| 字段 | 要求 |
| ---- | ---- |
| `class="page"` | 页面根。每个页面片段只能有一个 |
| `data-page` | 稳定页面 ID，不使用临时序号或含义不清的名字 |
| `data-id-layout` | 页面布局意图 token，例如 `image-analysis`、`figure-grid-page` |
| `data-id-margin` | 页面边距。不能靠空白对象表达边距 |
| `data-id-grid` | 主网格，例如 `12`、`12x8`、`16x9` |

可选但推荐：

| 字段 | 用途 |
| ---- | ---- |
| `data-id-column-gutter` | 主网格列间距 |
| `data-id-row-gutter` | 主网格行间距 |
| `data-id-baseline` | 垂直节奏 |
| `data-id-parent-page` | 稳定母版页 ID，只用于页码、页眉、固定装饰线等页面家具 |

页面网格是作者契约。Agent 可以选择不同网格，但不能完全不声明网格，也不能让转换层从对象边缘猜默认网格。

网格回环是硬门槛：

- 页面级 `data-id-grid`、`data-id-column-gutter`、`data-id-row-gutter`、`data-id-baseline` 和 `data-id-margin` 必须可回读。
- 原始作者包中的 `.grid-item` 必须在回读作者包中仍是 `.grid-item`。
- `.grid-item` 的 `--grid-col`、`--grid-span`、`--grid-row`、`--grid-row-span` 是对象与网格的关系，回环后必须 0 漂移。
- 网格对象不得被回读成只靠 `left/top/width/height` 的自由定位对象。
- 不能把对象边缘、参考线或 InDesign 观察坐标反推成新的作者网格来掩盖原始网格关系丢失。

## 5. 对象 ID 和结构规则

需要被回读保护的对象必须有稳定 `id`。

推荐：

```html
<section id="materials-grid" class="figure-grid">
  <figure id="material-warm-concrete" class="material-card">
    <img id="material-warm-concrete-image"
         src="assets/warm-concrete.jpg"
         alt="暖色清水混凝土"
         data-id-asset-kind="image"
         data-id-fit="cover">
    <figcaption id="material-warm-concrete-caption">暖色清水混凝土</figcaption>
  </figure>
</section>
```

规则：

- `id` 要稳定、可读、可复用。
- 不用 `item1`、`box2`、`tmp-a` 这类临时命名。
- 顶层大结构用 `section`、`article`、`figure`、`table`、`ul/ol` 等自然 HTML。
- 图片说明使用 `figure + figcaption`。
- 多图矩阵使用容器类，例如 `figure-grid`、`image-grid`、`material-grid`。
- 多段连续正文使用容器类，例如 `text-block`。
- 表格用真实 `table`，不要用一堆绝对定位 div 假装表格。

回读保护依赖原始结构能被保存为 `sourceNode`。如果对象没有稳定 `id` 或结构只是视觉碎片，系统只能把它当观察对象。

### 5.1 非网格对象必须显式归类

不是所有对象都必须进主网格，但所有可见对象都必须说清楚自己为什么不进主网格。非 `.grid-item` 的可见对象至少需要：

- 稳定 `id`。
- `data-id-object`，除非它只是父对象内部的普通文本节点。
- `data-id-role`，使用已登记字段表达基础角色，例如 `text`、`graphic`、`shape`、`line`、`annotation`、`decoration`、`background`。
- `data-id-placement`，表达作者布局契约，例如封面主图、固定页码、页面背景、自由标注、页面家具等。具体 token 必须进入当前项目语义库或标准语义库。
- 如果来自母版或页面家具，还要有 `data-id-parent-page-item` 或 `data-id-parent-page-source-id`，不能只靠 `.page-number`、`.footer-line` 这类 CSS 类让回读算法猜。

示例：

```html
<img id="cover-hero-image"
     class="hero-media"
     src="../smoke-assets/photos/cover.jpg"
     alt="封面主效果图"
     data-id-object
     data-id-role="graphic"
     data-id-placement="cover-hero"
     data-id-asset-kind="image"
     data-id-fit="cover">

<span id="report-folio-00"
      class="page-number"
      data-id-object
      data-id-role="text"
      data-id-placement="parent-page-furniture"
      data-id-parent-page-item="report-folio"
      data-id-paragraph-style="folio">00</span>
```

这类声明是作者责任，不是算法责任。回读后系统可以追加 `data-id-content-*`、样式名和资源绝对路径等观察字段，但这些追踪字段只能帮助保留 InDesign 现场信息，不能替代作者源码里的稳定 `id`、`data-id-role` 和 `data-id-placement`。

## 6. 语义 token 和样式规则

字段名是协议，token 值是项目语义。

常用字段：

| 对象 | 推荐字段 |
| ---- | ---- |
| 文字 | `data-id-paragraph-style`、`data-id-character-style` |
| 对象 | `data-id-object`、`data-id-role`、`data-id-placement`、`data-id-object-style`、`data-id-frame-style` |
| 图层 | `data-id-layer` |
| 表格 | `data-id-table-style`、`data-id-cell-style` |
| 资源 | `data-id-asset-kind`、`data-id-fit`、`data-id-pdf-page`、`data-id-crop` |

要求：

- 字段名必须来自协议字段注册表。
- token 值必须来自当前标准语义库或项目语义库。
- 面向人看的 InDesign 样式名可以是中文，但协议 token 要稳定。
- 不为一次性视觉效果临时发明大量 token。
- 相同用途的文字、线条、填充、图框应复用同一 CSS 类和语义 token。

如果项目需要新 token，先初始化或更新项目语义库：

```powershell
npm run preset:init -- -- --package <deck.config.json>
```

然后维护作者包内的 `semantic-preset.json`。不要把新 token 只写在单个页面里。

## 7. CSS 编写要求

HTML 必须能自然浏览器预览。CSS 负责视觉表现，协议字段负责转换事实。

推荐：

- 页面尺寸、网格、边距写在页面或共享 layout CSS 中。
- 重复组件写成类，例如 `.metric-card`、`.figure-grid`、`.analysis-callout`。
- 颜色、字号、描边、填充等重复样式用 CSS 变量或共享类。
- 局部网格定位可用 CSS 变量，例如 `--grid-col`、`--grid-span`。

避免：

- 大量对象都写完整内联 `style`。
- 用白色矩形遮挡来制造裁切或留白。
- 用重复图片覆盖样式缺口。
- 用浏览器专用视觉补丁绕过转换层。
- 为了 InDesign 转换牺牲浏览器可读性。

`.grid-item` 必须声明完整网格坐标：

```html
<section id="analysis-copy"
         class="grid-item text-block"
         style="--grid-col:1;--grid-span:4;--grid-row:2;--grid-row-span:3">
  ...
</section>
```

非网格对象的 CSS 也是布局契约：

- 封面主图、遮罩、页码、固定装饰线、自由标注等可以使用绝对定位，但必须按 5.1 声明 `id`、`data-id-role` 和 `data-id-placement`。
- `data-id-grid-ignore` 只能用于明确不参与主网格的对象，并且必须同时说明对象角色和定位契约。
- CSS 类不能单独承担协议事实。只有 `.page-number`、`.hero-media`、`.veil` 这类类名，没有协议归类时，回读只能把对象当观察信息。
- InDesign 回读追加的 `data-id-content-x/y/width/height/scale-*` 是观察字段；Agent 后续整理作者包时可以保留或归并，但不能把它们当作初始作者 HTML 的主要布局表达。

## 8. 资源规则

图片、PDF、PSD、AI、SVG 等资源必须保留真实来源。

推荐：

```html
<object id="plan-pdf"
        data="../drawings/site-plan.pdf"
        type="application/pdf"
        data-id-asset-kind="pdf"
        data-id-pdf-page="1"
        data-id-fit="contain">
</object>
```

或：

```html
<img id="hero-rendering"
     src="assets/rendering.jpg"
     alt="主效果图"
     data-id-asset-kind="image"
     data-id-fit="cover">
```

要求：

- 内部 NAS 素材优先保留 UNC 原位路径或作者包相对路径。
- PDF/PSD/AI 可以有预览图，但不能丢掉原始资源路径。
- 不能把 PDF 页面截图当成唯一事实。
- 不能把 InDesign 矢量对象全部退化成不可编辑图片。

## 9. 母版和页面家具

母版只承载低编辑频率、跨页稳定的页面家具：

- 页码。
- 页眉页脚。
- 章节标识。
- 固定装饰线。
- 稳定重复背景。
- 规范参考线。

这类对象如果在页面源码中出现用于浏览器预览，也必须显式标为母版/页面家具，使用稳定 `id`、`data-id-role`、`data-id-placement` 和 `data-id-parent-page-item` / `data-id-parent-page-source-id`。页码、页眉线和固定装饰线不能只靠 CSS 位置存在。

不要把具体页面版式做成母版：

- 左文右图。
- 四图矩阵。
- 主图加说明。
- PDF 图纸版式。
- 材料页槽位。

这类内容应写在普通页面结构中，通过 `data-id-layout` 和组件类表达。

## 10. 回读保护如何生效

当前系统判断一个对象是否受保护，核心条件是：

```text
labelStatus: "accepted"
+ sourceNode 存在
```

满足这个条件后，语义重建算法不得改写：

- `tagName`
- `sourceNode`
- `sourceAncestorNodes`
- `structure`
- 既有 `semantic`

因此 Agent 要保证：

- HTML 使用协议字段，而不是私有字段。
- token 在语义库中可识别。
- 页面和对象有稳定 ID。
- DOM 结构表达真实编辑意图。
- 转换链路能把这些事实写入 `html_indesign` 标签。

如果反向导出报告中对象不是 `accepted`，说明它没有进入可信保护范围，应先修协议、标签或语义库，而不是让重建算法猜。

对于 Agent 作者包，以下情况应视为作者输入缺陷，不应让语义重建算法兜底：

- 主网格对象缺少完整 `--grid-*` 坐标。
- 非网格对象只有 CSS 定位，没有 `data-id-role` 和 `data-id-placement`。
- 页码、页眉、固定装饰线没有母版/页面家具来源。
- 关键对象没有稳定 `id`，导致回读只能生成 `p1-el1` 这类机器 ID。

## 11. 必跑检查

修改作者包后：

```powershell
npm run assemble:authoring -- -- --package <deck.config.json>
npm run lint:authoring -- -- --package <deck.config.json> --strict
```

需要验证真实 InDesign 输出：

```powershell
npm run e2e:indesign -- -- --html <deck.html>
```

需要验证一次回读：

```powershell
npm run e2e:indesign -- -- --html <deck.html> --reverse-roundtrip
```

需要验证二次回环稳定：

```powershell
npm run e2e:indesign -- -- --html <deck.html> --reverse-roundtrip --second-pass-roundtrip
```

算法升级或回读保护相关变更必须接入：

```powershell
npm run audit:trusted-source-preservation -- -- --expected <before-model.json> --actual <after-model.json> --out <report.json>
npm run audit:conversion-gate -- -- --case <conversion-gate.case.json> --out <report.json>
```

判断一次回读是否存在信息损失时，先看硬事实：

- 页数、文本、资源、对象数量不能减少。
- 页面网格声明必须保留。
- 原始 `.grid-item` 的对象与网格关系必须 0 漂移。
- 母版/页面家具来源必须可追踪。
- `reference` 模式不得复制原始资源；相对路径可以规范化为指向同一原位文件的 `file:///...` 或 `/nas/...` 浏览器地址，并必须保留原始来源记录。只有显式 `copy` 模式或本轮新生成的派生预览可以写入作者包；无论路径表达是否变化，审计都必须按真实文件身份确认是同一个资源。

回读后新增 `data-id-content-*`、机器生成样式名、资源绝对路径等追踪字段，属于可整理的信息噪音；它们不等同于内容损失，但不能掩盖上述硬事实缺失。

## 12. 常见错误

| 错误 | 后果 |
| ---- | ---- |
| 手改 `deck.html` | 下次组装会覆盖，源码回环不稳定 |
| 页面缺 `data-id-grid` | 参考线和版面契约丢失 |
| `.grid-item` 缺完整 `--grid-*` 坐标 | 对象与网格关系无法无损回读 |
| 网格对象回读后变成自由定位 | 布局关系发生真实损失 |
| 对象缺稳定 `id` | 回读难以对应原作者结构 |
| 非网格对象只有 CSS 类和绝对定位 | 系统只能观察，无法确认作者归类 |
| 页码、页眉线等固定家具没有 `data-id-placement` / 母版来源 | 回读后会混入普通页面对象 |
| 用私有 `data-*` 表达协议事实 | 标签白名单无法接受 |
| token 不在语义库 | 反向标签可能变成 partial/rejected |
| 用 div 假表格 | InDesign 无法生成原生表格语义 |
| PDF 只放截图 | 原始 PDF 置入事实丢失 |
| 过度内联 style | 作者包可编辑性下降 |
| 用白块遮罩 | InDesign 输出变成补丁堆叠 |
| 把版式槽位做成母版 | 人类后续编辑会被固定模板干扰 |

## 13. 交付判断

一个 Agent 作者包可以认为达到当前保护要求，至少应满足：

- 严格作者检查通过。
- 页面、对象、资源和样式 token 可解释。
- 浏览器预览和 InDesign 输出没有明显视觉偏差。
- 反向导出后关键对象为 `labelStatus: "accepted"` 且带 `sourceNode`。
- `trustedSourcePreservation.ok` 为 `true`。
- 页面网格字段和 `.grid-item` 的 `--grid-*` 关系 0 漂移。
- 非网格对象都有稳定 `id`、`data-id-role` 和 `data-id-placement`。
- 母版/页面家具对象来源可追踪，不混入普通内容对象。
- 二次回环内容库存和结构签名稳定。

如果这些条件不满足，优先修作者 HTML、协议字段、语义库或转换链路。不要把责任推给人类手动修 InDesign，也不要用语义重建算法覆盖本来应该可信的作者结构。
