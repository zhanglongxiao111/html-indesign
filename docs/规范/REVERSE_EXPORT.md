# InDesign 反向导出规范

## 1. 目标

反向导出把 InDesign 文档转换为固定语义 HTML。

当前目标不是任意 InDesign 文件无损还原，而是建立可验证的双向闭环：

```text
带标签 InDesign
-> reverse snapshot
-> semantic model
-> semantic reconstruction
-> 固定语义 HTML
-> HTML-to-InDesign
-> 带标签 InDesign
```

反向导出的最高质量语义来源是 `docs/规范/LABEL_PROTOCOL.md`。无标签或弱标签输入不能恢复原始 authoring HTML，但仍必须能通过 InDesign 原生信息、旧 blueprint 和样式/几何事实生成可观察 HTML 与补标线索。

反向导出每次都必须按当前项目语义库复核 `html_indesign` 标签。符合白名单的字段进入有效标签；不符合白名单的字段只能作为观察标签保留，不参与后续 HTML-to-InDesign 编译。

反向模型字段必须与统一语义模型和协议字段注册表保持一致。当前字段事实源是 `PROTOCOL_FIELD_REGISTRY.md` 及其生成来源 `src/protocol/` registry；反向导出新增字段必须先在注册表登记能力、生命周期和写回策略，不能只在 writer 或 JSX 快照里临时增加。

## 2. 导出模式

### 2.1 `structured`

结构化模式。

要求：

- 文档、页面、核心对象有 `html_indesign` 标签。
- 缺少关键标签时报告 error。
- 不通过视觉猜测补语义。

用途：

- 本项目生成的 InDesign 回读。
- 人工按标签协议标注的 InDesign 回读。

输出：

- `deck.html`
- `reverse-model.json`
- `reconstruction-report.json`
- `report.json`
- `assets/`

### 2.2 `observation`

观察模式。

要求：

- 不要求标签。
- 尽量保留视觉、坐标、样式、资源和可见性事实；InDesign 文档图层名只作为观察事实。
- 未识别或缺失的语义保持为 `null` 或省略，并进入 unresolved / 观察信息；不得写成 `unknown` 哨兵。

用途：

- 旧 InDesign 项目迁移。
- Agent 观察和语义化。

输出示例：

```html
<section class="page observed-page"
         data-page="observed-page-1"
         data-id-observed="true">
  <div class="observed-text"
       data-id-role="text"
       data-id-observed-id="page-1-item-12"
       style="left:20mm;top:30mm;width:100mm;height:20mm">
    项目标题
  </div>
</section>
```

### 2.3 `inferred`

推断模式。

要求：

- 不要求完整 `html_indesign` 标签。
- 可以读取旧 blueprint、旧槽位标签、母版、参考线、样式、分组和几何关系；InDesign 文档图层名只作为观察事实，不能作为语义评分依据。
- 每个推断出的槽位、语义、class 或容器关系必须有置信度和证据。
- 不得把推断结果冒充原始 authoring HTML。

用途：

- 迁移旧模板槽位。
- 把弱标签 InDesign 或旧 blueprint 接入新的 reverse model。
- 生成比 observation 更利于 Agent 补标的 HTML。

输出：

- `deck.html`
- `deck.inferred.html`
- `reverse-model.json`
- `reconstruction-report.json`
- `report.json`
- `inferred-report.json`

## 3. 来源等级

| 来源 | 输入特征 | 反向质量 | 处理策略 |
| ---- | -------- | -------- | -------- |
| 本项目生成的 InDesign | 有完整 `html_indesign` 标签 | 最高 | 必须完整读回 |
| 人工 InDesign，按协议打标签 | 有规范脚本标签 | 高 | 正式支持 |
| 人工 InDesign，只使用模板但无标签 | 有母版和样式，语义不完整 | 中 | 输出观察 HTML 和模板线索 |
| 普通未标注 InDesign | 只有视觉对象 | 低 | 输出观察 HTML，等待 Agent 语义化 |
| 历史 blueprint 模板 | 由 `extract_blueprint.jsx` 抽出 | 中 | 通过 `blueprintMigrationToSemanticModel` 进入 `src/adapters/indesign` 归一化为统一语义模型，再由 `src/writers/html` 输出 inferred/observation HTML |

首次来自人类用户的 InDesign 文档通常语义混乱，可能混入旧模板、复制来的脚本标签或不符合本项目协议的自定义标签。反向导出不得信任这些标签的存在本身，只能信任通过当前语义库白名单复核的字段。Agent 拿到观察 HTML 后，应根据页面视觉、样式、资源、对象关系和用户意图重建符合白名单的语义，再导回结构化 InDesign。

## 4. 产物目录

反向导出输出目录：

```text
reverse-export-<timestamp>/
  deck.visual.html
  deck.<mode>.html
  deck.html                  # compatibility alias of visual output
  reverse-model.json
  reconstruction-report.json
  report.json
  <mode>-report.json
  content-manifest.json      # 每页文字块、表格、图片链接与像素尺寸（4.4.1）
  author/
    deck.config.json
    deck.html                # generated from author source package
    templates/               # parent-page templates when repeatable parent content exists
      parent-page.html
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

反向导出不得只生成单个超大 HTML。无论 `structured`、`inferred` 还是 `observation` 模式，都必须至少按页面拆出 `author/pages/*.html`，并生成可由组装器重建的 `author/deck.html`。

### 4.1 视觉 HTML 与作者入口

`deck.visual.html` 是视觉对照入口。`deck.<mode>.html` 是同一视觉 HTML 的模式命名入口。顶层 `deck.html` 只作为旧调用方的兼容别名，语义上仍是视觉输出。

`author/deck.html` 是可编辑作者源码包的组装结果。Agent 和人类后续维护应优先修改 `author/pages/*.html` 与 `author/styles/*.css`，再由组装器重建 `author/deck.html`。

作者源码包的目标不是像素对照，而是可继续编辑。`author/pages/*.html` 必须优先恢复原始作者标签、class、稳定属性、资源引用和可表达的父子结构。图片、PDF、SVG、AI/PSD 预览等资源元素不得退化为带 `src` 或 `data` 属性的 `div`。有网格信息的对象应保留为 CSS Grid 约束；绝对定位只用于缺少网格或无法映射的观察对象。

`observation` 模式把带源码节点的矢量对象写成 `<svg>` 时，InDesign 读回的路径点已经是页面坐标下的最终几何（CSS 旋转、平移都已烘焙进 `path`），`viewBox` 取自读回 bounds。此时源码 style 里描述「旋转前盒子 + CSS 变换」的声明不得搬到 `<svg>` 上：`transform`、`transform-origin`、`transform-box`、`rotate`、`translate`、`scale` 一律剥掉；非网格对象的 `position`、`left/top/right/bottom/inset*`、`width/height`（含 min/max 与逻辑尺寸）和 `margin*` 也剥掉，外框改由 `reverse-overrides.css` 按读回 bounds 写出，并附 `margin:0; transform:none; rotate:none; translate:none; scale:none`，防止带 `sourceRoot` 拷回的源码组件样式再次变换。网格对象保留网格变量，只剥变换。文本框、图片/PDF 框等非矢量写出路径仍沿用源码几何与变换，不会叠加读回 bounds，不存在二次变换。

`<svg>` 里只能放路径。读回带矢量路径、同时挂着作者内容（子对象、折回的伴生文字 `<id>-text` 或自身文字）的对象不得写成 `<svg>`，改写成普通 HTML 容器（源码标签，`svg`/空元素退回 `div`）：id、class、`data-id-object` 等观察态标记和对象样式属性落在容器上，不带 `data-id-vector`；外框沿用上段已烘焙矢量的剥离与兜底规则；填充、描边、圆角、透明度按读回 `visualStyle` 内联成 CSS 盒子，正向构建读的也是它。容器的直接子对象一律按读回 bounds 写兜底几何并附 `margin:0`，源码 style 里的定位、尺寸和外边距剥掉：非网格容器相对容器内边距盒定位（扣掉描边写成的 border 宽），网格容器不是定位参照，子对象按页面坐标定位。折回的伴生文字相对容器的偏移写成 `padding`，字号、行距等按伴生文字读回写出。路径不是贴合读回 bounds 的直角矩形时（椭圆、多边形、烘焙了旋转的矩形等），CSS 盒子只能近似，记 `REVERSE_VECTOR_CONTAINER_SHAPE_APPROXIMATED`。

作者 HTML 写出时，作者树里的每个对象（含折回的伴生文字）都必须被某条写出路径写出；写出路径接不住的对象（例如父对象是空元素）不得静默丢弃，逐个记 `REVERSE_AUTHOR_ITEM_DROPPED`。这两类写出 warning 带 `source: "author-writer"` 与 `details.pageId`，和快照 warning 一起进入 `report.json` 的 `warnings`、`author/reports/authoring-report.json` 以及 `html.reverse_export` 返回体的 `warningsByCode`。

写成 `<svg>` 的矢量对象只由 `path` 的 `fill`、`stroke`、`stroke-width` 等表达填充和描边，`<svg>` 盒子本身不得再画边框、底色、内边距或投影：合成样式 `synth-*`、对象样式 class 和源码 class 里的 `border`、`background`、`padding`、`box-shadow` 落到 svg 上会在外围多画一个矩形框或底色，`border`/`padding` 还会把 `viewBox` 内容区往里缩，斜线端点和角度随之偏移。写出侧因此在源码 inline style 里剥掉这些属性（`border-radius` 不画东西，保留作对象样式圆角），作者包 `reverse-overrides.css` 与视觉参照页 `deck.visual.html` 都固定写一条 `svg.id-object[data-id-vector] { border:0; background:none; padding:0; box-shadow:none; }`，已烘焙的源码矢量在自身兜底几何里再附同样的归零声明。`synth-*` 和对象样式规则本身保持完整，因为同一 token 可能还被非 svg 对象共用。正向回编时，描边仍由 svg 上的 `data-id-stroke-*` 协议属性和 `path` 的描边读回；带同一标记（`id-object` class + `data-id-vector`）的 svg 盒子没有底色时，对象样式填充取 `path` 的填充（多个 path 填充不一致时不归纳，只保留逐 path 的局部填充）。作者手写、不带该标记的 svg 不走这条路，对象样式只看盒子本身。上述归零只针对写成 `<svg>` 的对象；前面所述的矢量容器画的正是读回的填充和描边，不做归零。属性判定、归零规则和标记判定集中在 `src/shared/vector-svg-box-paint.js`。

作者包的 synth 样式去重必须按属性计算残差，不能看到 `synth-*` class 就整段删除 inline：声明式 paragraph/character/object 规则先输出，synth 规则后输出；只有 token 对应规则真实存在、属性存在且规范化后的值等价时，才删除该 item 的对应生成属性。source style、grid 变量、不同值 override、文本框属性、z-index 和未覆盖属性必须保留。accepted source node、rich-text run、table cell、vector 和 PDF wrapper 不参与本轮 item 级去重；缺失 synth rule 必须保留 inline 并写入作者报告。

需要把对象图证据直接落实到作者 HTML 时，反向导出可启用：

```powershell
node scripts/indesign-reverse-export.js --snapshot <reverse-snapshot.json> --out <dir> --mode observation --reconstruct page-object-graph,caption-structure,figure-grid,text-block
```

其中 `page-object-graph` 只写证据报告；`caption-structure` 只把高置信图片/置入资源说明文字写成 `figure + figcaption` 父子结构；`figure-grid` 再把明确同组的 captioned figure 包成 `section.figure-grid`；`text-block` 把同列、同样式、垂直连续的页级文字框包成 `section.text-block`。这些 pass 都不把未知语义伪装成白名单语义。

### 4.1.1 母版、页面模板和占位框

反向作者包必须区分三类信息：

| 信息类型 | 写出位置 | 规则 |
| -------- | -------- | ---- |
| 跨页稳定重复内容 | `author/templates/*.html`，并由页面通过 `data-id-parent-page` 引用 | 包括页码、页眉页脚、章节标识、固定装饰线、重复背景和参考线 |
| 页面结构模板 | `deck.config.json`、页面 `data-id-layout`、样式和可选区域元数据 | 包括左文右图、四图矩阵、指标卡片区、右侧主图区域等布局约束，不作为可见母版对象 |
| InDesign 模板空框 | 报告或观察元数据 | 没有实际置入内容、没有白名单语义标签的空图片框、空 PDF 框、空版式框不得写成可见 HTML 元素 |

如果当前写出器尚不能生成 `templates/*.html`，允许把稳定可见母版对象展开到页面作为兼容输出，但必须视为降级路径；后续导回 InDesign 时不能把页面结构模板误判为母版内容。

实际置入了图片、PDF、PSD、AI、SVG 的图框属于页面内容，默认写入对应 `author/pages/*.html`。只有当同一资源、同一位置和同一显示参数跨页稳定重复，且符合母版语义时，才应提升为 HTML 模板内容。

### 4.1.2 PDF/AI/PSD 预览和置入参数

PDF、AI、PSD 这类浏览器无法直接干净显示或无法反映 InDesign 图层显隐的资源，作者包应使用 InDesign 当前图框导出的 PNG 作为预览，同时保留原始 linked asset 路径。预览图是浏览器显示辅助，不替代原始资源。

PDF 反向导出必须保留：

- 原始 PDF 链接路径。
- InDesign 当前指定的 PDF 页码，写入 `data-id-pdf-page`。
- crop box，写入 `data-id-crop`。
- PDF/AI 图层显隐，写入 `data-id-visible-layers` / `data-id-hidden-layers`。值是 JSON 字符串数组，数组元素是 InDesign 回读到的图层名原文（不 trim、不拆分），因为图层名本身可以含 `|`、逗号（例如 `合并底图|PM-隔断`）；不得再用 `|` 拼接。
- 图框 bounds、内容 bounds、缩放和偏移，写入 `data-id-fit="manual"` 及内容几何字段。

反向生成预览图时，应导出 InDesign 图框当前可见结果，因此预览图必须对应实际页码、crop box、图层显隐和裁切状态。若只能按文件名旁路寻找 `*-pageN.png` 之类缓存，必须先拿到 `data-id-pdf-page` / 模型 `placement.pageNumber`；没有页码事实时不得静默回退第一页。

再次 HTML -> InDesign 时，编译层必须读取 `data-id-pdf-page`，并把值传入 InDesign 执行器的 PDF 置入页码设置。旧 `data-id-page` 只能进入观察报告或迁移清单，不能作为页码读取兜底。

### 4.1.3 矢量外观字段

反向导出的矢量对象分为两组字段：

| 字段组 | 位置 | 含义 |
| ------ | ---- | ---- |
| `vectorGeometry` | item 顶层 | 路径类型、闭合状态、锚点、左右控制点，只描述几何 |
| `visualStyle` | item 顶层 | 填充、描边、透明度、线端、线连接和混合外观 |

`visualStyle` 中的矢量扩展字段、标准枚举值、当前路径和格式能力以 `PROTOCOL_FIELD_REGISTRY.md` 为准。InDesign 原始枚举名只能作为追溯信息保留；新增标准类型必须先扩展 registry 和测试，不能直接把 InDesign 原始枚举名写成协议主字段。

如果路径点无法提取，导出器只能在确认对象确实是线条时根据几何边界生成开放线段；其他对象不得静默伪装成矢量路径，必须进入观察报告或降级规则。

结构化模式输出固定语义 HTML：

```html
<main class="deck"
      data-id-document="architecture-report"
      data-id-profile="architecture-report">
  <section class="page"
           id="agenda-page"
           data-page="agenda"
           data-id-semantic="agenda"
           data-id-parent-page="report-parent"
           data-id-parent-page-name="汇报母版"
           data-id-layout="contents-grid"
           data-id-margin="14mm 16mm 10mm 18mm"
           data-id-grid="12x8"
           data-id-column-gutter="6mm"
           data-id-row-gutter="5mm"
           data-id-baseline="4mm">
    ...
  </section>
</main>
```

观察模式输出坐标保真 HTML：

```html
<main class="deck observed-deck" data-id-reverse-mode="observation">
  ...
</main>
```

观察作者 HTML 与统一模型使用不同坐标语境：`reverse-model.json` 和 InDesign instructions 中的 `bounds` 始终是页面绝对坐标；当实体子对象嵌入一个会建立 CSS 定位上下文的实体父对象时，作者 HTML 的 `left/top` 必须写成父级局部坐标。HTML adapter 回读该作者包时必须沿已捕获的实体祖先恢复页面绝对坐标。虚拟容器不建立新的坐标原点，也不得导致重复平移。

### 4.2 `reverse-model.json`

完整中间模型。

`reverse-model.json` 必须是统一语义模型的序列化结果，而不是独立的第三套结构。反向导出可以在语义模型外附加 snapshot、诊断和 unresolved 信息，但 `document`、`parentPages`、`pages`、`styles`、`layers`、`assets`、`items` 的字段含义必须和 `HTML_INDESIGN_LIBRARY_SPEC.md` 中的 Canonical Mapping Model 保持一致；具体字段事实以 `PROTOCOL_FIELD_REGISTRY.md` 为准。

旧 blueprint 输入也必须先转换成 `reverse-model.json`，不得直接绕过模型恢复已退役的旧模板 HTML 生成器或旧槽位 builder。

用途：

- 保留 HTML 不方便表达的 InDesign 信息。
- 支持 round-trip 验证。
- 支持后续工具做差异比较。

核心结构：

```json
{
  "metadata": {
    "sourceDocument": "report.indd",
    "exportedAt": "2026-05-25T00:00:00Z",
    "mode": "structured|inferred|observation",
    "semanticModelVersion": 1
  },
  "document": {
    "id": "architecture-report",
    "unitMode": "presentation",
    "coordinateUnit": "pt",
    "labels": []
  },
  "parentPages": [],
  "styles": {},
  "layers": [],
  "assets": [],
  "pages": [],
  "snapshot": {},
  "unresolved": []
}
```

### 4.3 `reconstruction-report.json`

语义重建报告。

`reconstruction-report.json` 由 `src/semantic-reconstruction/` 生成，记录语义重建层实际执行了什么算法、识别了什么、哪些对象仍然 unresolved。

当前脚手架状态为 `observed-only`：表示没有执行语义算法，只统计语义缺失或被拒绝标签的对象。这个状态不得被解释为作者包已经语义化。

规则：

- 语义算法只能处理 `reverse-model.json` 代表的中间模型。
- 不以 `deck.visual.html`、`deck.html` 或 `reverse-overrides.css` 为事实源。
- 每个推断必须有证据、置信度和来源。
- 低置信度对象必须进入 unresolved，不能伪造白名单语义。

### 4.4 `report.json`

诊断报告。

必须记录：

- 标签缺失。
- 标签 JSON 无效。
- 协议版本不匹配。
- 未识别对象类型。
- 资源链接丢失。
- 样式无法映射。
- 模板信息只能部分恢复。
- observation 模式中的 unresolved / 语义缺失对象数量。
- inferred 模式中的推断来源、置信度和证据。
- 标签复核摘要：接受、局部接受、降级观察的数量和原因。
- 内容清单引用：`contentManifest: { path: "content-manifest.json", summary }`，`summary` 与清单顶层同一份计数。

### 4.4.1 `content-manifest.json`

内容清单，给「从 INDD 取内容重做」这类场景直接使用：Agent 只读这一个文件就能拿到每页文字、表格、图片链接和像素尺寸，不必逐页读观察态 HTML（08-06 事故里为取内容读回 21 个观察 HTML，约 423KB，大部分是坐标和 z-index）。

规则：

- 由 `src/reverse-pipeline/content-manifest.js` 从与 `reverse-model.json` 同一份语义模型聚合，纯 Node，不读 HTML；写在反向导出 outDir 根目录，经 `src/shared/atomic-write.js` 原子写入。
- 只带内容与位置：不带坐标以外的样式细节，不带 z-index、图层、颜色、字体。
- 顶层 `runId` 与 `report.json` 相同；读之前核对，对不上就是别的运行留下的。
- 字段登记在 `src/protocol/fields/content-manifest.js`（owner `content-manifest`，observation，不参与结构化编译），生成结果见 `PROTOCOL_FIELD_REGISTRY.md`。
- `html.reverse_export` 成功返回体带 `data.contentManifestPath`（绝对路径），`artifacts` 里有一条 `Content manifest`；`report.json` 带 `contentManifest` 引用。
- 读不到图片文件（链接缺失、NAS 不可达、格式不认识、文件损坏）只让该图的像素字段为 null 并写原因，不让导出失败。

顶层字段：

| 字段 | 含义 |
| ---- | ---- |
| `schema` / `schemaVersion` | `html-indesign.content-manifest` / `1` |
| `runId` / `generatedAt` / `tool` | 运行标识，与 `report.json` 一致 |
| `source` | `{ indd, documentId, title, mode }` |
| `unit` | 所有 `bounds` / 尺寸的单位，固定 `mm`（InDesign 物理尺寸，pt × 25.4 / 72）。presentation 模式下 1pt 对应作者 HTML 的 1px，需要 px 时按 mm × 72 / 25.4 换回 |
| `pageCount` / `pageSize` | 页数；首页尺寸 `{ width, height }`，尺寸不同的页自带 `size` |
| `readingOrder` | 阅读顺序依据，当前为 `xy-cut` |
| `files` | 相对清单所在目录的路径：`report`、`reverseModel`、`authorEntry`、`authorConfig` |
| `summary` | `textBlocks`、`tables`、`images`、`rasterImages`、`vectorImages`、`imagesWithPixels`、`imagesWithPixelError` |
| `parentPages[]` | 带文字或图片的母版：`{ id, name, textBlocks, images }`，页面通过 `parentPageId` 引用；母版内容不重复写进每页 |
| `pages[]` | `{ id, index, name?, semantic?, parentPageId?, size?, textBlocks, images }`；`name` 是 InDesign 页面名 |

文字块 `textBlocks[]`（跳过空文本框和语义重建生成的虚拟容器）：

| 字段 | 含义 |
| ---- | ---- |
| `id` | 反向模型对象 id |
| `order` | 本页阅读顺序，与 `images[].order` 共用一套编号，从 1 起 |
| `kind` | `text` 或 `table` |
| `role` / `semantic` | 对象角色与白名单语义（有才写） |
| `paragraphStyle` | 段落样式显示名（没有显示名时用 token，有才写） |
| `tableStyle` / `headerRows` | 表格样式名与表头行数（表格、有才写） |
| `bounds` | 回读外框 `{ x, y, width, height }`，mm |
| `text` | 纯文本；段落与强制换行统一为 `\n`，去掉首尾空白 |
| `rows` | 表格：`rowCount × columnCount` 的文字二维数组，合并单元格只在左上角写文字，被覆盖的位置为 `null` |

图片 `images[]`（带置入资源的对象）：

| 字段 | 含义 |
| ---- | ---- |
| `id` / `order` / `role` / `semantic` / `bounds` | 同文字块；`bounds` 是图框 |
| `name` / `linkPath` | 链接名与 InDesign 报告的原始链接路径（NAS 素材为 UNC） |
| `packagePath` | 作者包内拷贝的相对路径（`assetPolicy: copy` 时才有） |
| `format` / `kind` | `jpeg`/`png`/`gif`/`webp`/`bmp`/`tiff`/`psd`/`psb`/`pdf`/`ai`/`eps`/`svg`…；`raster`/`vector`/`unknown`。读到文件头时以文件头为准 |
| `linkStatus` | `normal`/`missing`/`modified`/`embedded`/`inaccessible`（InDesign 链接状态） |
| `pdfPage` / `cropped` | 置入的 PDF/AI 页码；图框裁切了图像时为 `true`（有才写） |
| `pixelWidth` / `pixelHeight` / `aspectRatio` | 栅格图像素尺寸（已按 EXIF 方向摆正）与宽高比；矢量素材和读不到时为 `null` |
| `exifOrientation` | EXIF 方向不是 1 时写出；5–8 表示宽高已对调 |
| `effectivePpi` / `ppiBasis` | `{ horizontal, vertical }`；`placed-image-bounds` 表示按图像本身在版面上的外框（含缩放、裁切偏移）计算，与 InDesign 链接面板「有效 PPI」同口径；`frame-bounds` 表示快照没有图像外框，按图框近似 |
| `pixelSource` | `package-copy` 或 `link-path`：优先读作者包内拷贝，没有再读原始链接 |
| `pixelError` | 非矢量素材读不到像素时的原因 `{ reason, message }`，`reason` 为 `no-link-path`、`file-not-found`、`file-unreadable`、`share-unreachable`、`unsupported-format`、`truncated`、`invalid-header` |

像素尺寸由 `src/shared/image-header.js` 读取：只读文件头部必要的字节（PNG IHDR、JPEG SOF 段与 APP1 EXIF 方向、GIF、WebP VP8/VP8L/VP8X、BMP、TIFF IFD0、PSD/PSB 文件头），不解码像素、不加依赖。同一 UNC 共享第一次读失败且共享根不可达时，后续同共享的图片直接记 `share-unreachable`，不再逐个等超时。

阅读顺序：递归 XY-cut。覆盖页面 80% 以上面积的块（满版底图、整页文本框）排最前；其余块每层同时看横向与纵向投影空白，只在最宽的空白处一分为二（等宽先横切），递归到切不开时按行带从上到下、行内从左到右排。不使用 z-index 或图层顺序——人做的 INDD 里那是堆叠顺序，与阅读无关。它是几何启发式：文字压在图片上、不规则穿插的版面仍可能与人读的顺序不同。

### 4.5 structured 标签矩阵

结构化模式按对象重要性决定缺失标签的处理方式：

| 对象 | 标签要求 | 缺失处理 |
| ---- | -------- | -------- |
| Document | 必须有 `kind=document` | error |
| Page | 必须有 `kind=page` | error |
| ParentPage / 母版页 | 本项目生成或被页面引用时必须有 | error；未被引用的手工母版可 warning |
| Layer | 推荐有 `kind=layer` | warning；可用图层名观察导出 |
| Style | 推荐有 `kind=style` 和稳定 token | warning；无法恢复 token 时生成 observed style |
| Guide | 网格/边距参考线必须有标签或可由页面 grid 重建 | warning；未知参考线作为 observed guide |
| Core PageItem | 文本、图框、表格、形状、线、组必须有 `kind=item` | error |
| Decorative PageItem | 纯背景、装饰线、非核心视觉元素 | warning；保留视觉并标记为 observed / unresolved |

核心对象缺标签时，`structured` 模式不得用视觉猜测补语义；应失败或要求改用 `observation` 模式。

### 4.6 标签白名单与观察标签

`html_indesign` 标签不是通行证。反向导出必须把标签拆成两类事实：

| 类型 | 字段 | 用途 |
| ---- | ---- | ---- |
| 有效标签 | `effectiveLabel` | 通过当前语义库复核，可参与结构化 HTML 和后续正向编译 |
| 观察标签 | `observedLabel` | 未通过复核，只供 Agent、人类和报告观察，不参与编译 |

字段级规则：

- 合规字段局部有效；同一标签里不合规字段不得拖垮已经合规的语义字段。
- 不合规语义、未知布局、未知样式 token、来源不明的结构关系必须进入 `observedLabel`。
- 反向 HTML 可写出 `data-id-observed-label-status` 和 `data-id-observed-reasons`，但这些属性不等于有效语义。
- 每次从 InDesign 回读都要重新复核标签，不能因为某个标签来自上一次导出就跳过校验。
- 缺少标签的对象也必须导出视觉事实、样式事实和资源事实，不能因为没有语义而空白。

报告必须记录每个观察标签的降级原因，帮助 Agent 判断是保留、重建还是删除。

### 4.7 原位资源引用

事务所内部项目默认使用主机名 UNC 路径引用公共素材，例如：

```text
\\<文件服务器主机名>\project\assets\plan.pdf
```

反向作者 HTML 默认不打包这些原始素材。资源策略为 `reference` 时：

- `data-id-asset-path` 保留原始 UNC 或原始 InDesign 链接路径。
- 浏览器可访问路径写成发布网关约定的 `/nas/...`。
- 可访问的本机原位文件可以写成指向同一文件的 `file:///...` 浏览器地址；不得为了改变相对路径基准而复制原件。
- 不把 NAS 上的图片、PDF、PSD、AI、SVG 原件复制到导出目录。
- 本机图片、PDF、PSD、AI、SVG、CSV、XML 等原件同样不得复制到导出目录。
- 只有本轮导出的 PDF 预览图、格式转换预览图、缺少浏览器可直接显示能力的派生物，才写入导出目录缓存；来源作者包已经提供的预览引用仍按原位文件处理。

只有显式选择 `assetPolicy=copy` 时，才复制可复制素材到作者包；复制行为必须写入资源报告。

## 5. 流程

### 5.1 InDesign 侧快照脚本

当前脚本：

```text
_indesign_scripts/export_to_html_snapshot.jsx
```

职责：

- 读取当前打开的 InDesign 文档。
- 读取文档、页面、母版、样式、图层、参考线、页面对象的 `html_indesign` 标签。
- 对未标注对象抽取视觉信息。
- 输出 `reverse-snapshot.json`。

不做：

- 不生成最终 HTML。
- 不推断复杂语义。
- 不读取浏览器。

### 5.2 Node 侧反向编译器

当前模块：

```text
src/adapters/indesign/
  reader/snapshot-reader.js
  normalizer/label-whitelist.js
  normalizer/snapshot-to-model.js
  normalizer/blueprint-migration.js
src/semantic-reconstruction/
  index.js
  reconstruct.js
src/writers/html/
  visual-html-writer.js
  author-package-writer.js
  audit/author-audit.js
  audit/reverse-roundtrip.js
  audit/content-inventory.js
  audit/structure-signature.js
  audit/reverse-visual-evidence.js
```

职责：

- 校验 InDesign 侧 snapshot。
- 把脚本标签恢复为 semantic model。
- 把无标签对象转换为 observed item。
- 调用语义重建层，把 observed model 转换为 reconstructed author model。
- 生成 `deck.html`。
- 生成 `reverse-model.json`。
- 生成 `reconstruction-report.json`。
- 生成 `report.json`。

反向作者包审核门禁必须在 `src/writers/html/audit/` 统一实现和复用。独立 reverse export、`src/indesign-cli-plugin/` 暴露的 plugin reverse export，以及 `scripts/indesign-e2e.js` 的 reverse roundtrip 都调用同一组 source roundtrip、content inventory、structure signature、visual evidence 和二次稳定性审核模块；脚本层只能编排输入输出和退出码，不能保留另一套强弱不同的判定。

反向证据补全也属于 `src` 级审核能力。会影响 accepted/missing/mismatched/errors 结论的 reverse model 证据、visual geometry 证据和 author package 证据，必须在 `src/writers/html/audit/` 或同级库模块中生成，不能只存在于一次性脚本。

### 5.3 CLI 封装

当前脚本：

```text
scripts/indesign-reverse-export.js
```

建议命令：

```powershell
node scripts/indesign-reverse-export.js --mode structured --out test/workspace/reverse-export
node scripts/indesign-reverse-export.js --mode observation --out test/workspace/reverse-observed
node scripts/indesign-reverse-export.js --blueprint test/artifacts/blueprint.json --mode inferred --out test/workspace/reverse-blueprint
node scripts/indesign-reverse-export.js --mode observation --out test/workspace/reverse-observed --reconstruct page-object-graph,caption-structure,figure-grid,text-block
```

`--reconstruct page-object-graph` 会启用页面对象图证据层，只把对象图 pass 写入 `reconstruction-report.json`。继续追加 `caption-structure,figure-grid,text-block` 时，会把高置信图注、图片矩阵结构和连续文本块落实到作者 HTML，但仍不改写白名单语义。

内部流程：

```text
indesign-cli script run _indesign_scripts/export_to_html_snapshot.jsx
-> read reverse-snapshot.json
-> reverseSnapshotToSemanticModel
-> reconstructSemanticModel
-> write deck.html / reverse-model.json / reconstruction-report.json / report.json / content-manifest.json
```

旧 blueprint 输入流程：

```text
read blueprint.json
-> blueprintMigrationToSemanticModel
-> reconstructSemanticModel
-> semanticModelToHtml
-> write deck.html / deck.inferred.html / reverse-model.json / reconstruction-report.json / report.json / inferred-report.json
```

## 6. 模板和母版

模板分为两类：

| 类型 | 归属 | 作用 | 是否导出为 InDesign 母版 |
| ---- | ---- | ---- | ------------------------ |
| 跨页重复模板 | InDesign 母版页 | 页码、页眉页脚、章节标识、固定装饰线、永远重复的背景元素、页面参考线 | 是 |
| 页面结构模板 | HTML/Agent 侧布局约束 | 左文右图、主图图片区、多图矩阵、指标卡片区、图纸页区域等页面组织方式 | 默认否 |

规则：

- InDesign 母版只承载跨页重复结构。
- 页面结构模板属于 HTML/Agent 侧布局约束。
- `data-id-parent-page` 对应 InDesign 母版。
- `data-id-layout` 对应页面结构模板。
- 不因为 `data-id-layout="左文右图"`、`data-id-layout="四图矩阵"` 等页面结构模板自动创建同名 InDesign 母版。
- 页面结构模板应记录到页面标签和 `reverse-model.json`。
- 反向导出不根据视觉自动创建 `data-id-layout`，除非 Agent 语义化阶段明确补写。

## 7. Agent 语义化流程

未标注 InDesign 的推荐迁移流程：

```text
1. observation 模式反向导出。
2. 打开 deck.html 供 Agent 视觉检查。
3. Agent 给对象补 data-id 语义标签、class、grid、group。
4. 运行 HTML authoring validator。
5. HTML-to-InDesign 导回结构化 InDesign。
6. 新 InDesign 写入脚本标签。
7. 以后走 structured 模式双向维护。
```

如果输入是旧 blueprint，可先使用 `inferred` 模式获得槽位名、样式和资源线索，再进入补标流程。

另一条可选路径是 Agent 直接观察 InDesign 文档，根据页面结构、样式、资源和对象关系推断合规语义，并通过脚本或工具给对象写入白名单标签，再导出 HTML。该路径适合人类已经在 InDesign 中完成大量整理、但没有稳定 HTML 作者包的场景。

默认仍推荐 Agent 修改 HTML，因为 HTML 更适合审阅、diff、测试和版本管理。无论选择哪条路径，最终写回 InDesign 的都只能是通过当前语义库复核的标签。

## 8. 校验

### 8.1 标签校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `LABEL_PROTOCOL_MISSING` | warning/error | structured 模式为 error，observation 模式为 warning |
| `LABEL_JSON_INVALID` | error | 标签不是合法 JSON |
| `LABEL_VERSION_UNSUPPORTED` | error | 协议版本不支持 |
| `LABEL_KIND_MISMATCH` | error | 标签 kind 与宿主对象类型不符 |
| `LABEL_ID_DUPLICATED` | error | 同一作用域 ID 重复 |
| `STYLE_TOKEN_MISSING` | warning | 样式没有稳定 token |

### 8.2 反向对象校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `ITEM_SEMANTIC_MISSING` | warning | 对象缺少语义 |
| `ITEM_TYPE_UNSUPPORTED` | warning/error | 对象类型无法映射 |
| `ASSET_LINK_MISSING` | warning/error | 链接资源丢失 |
| `TEXT_RUN_LOSSY` | warning | 局部字符样式无法完整表达 |
| `TABLE_EXPORT_LOSSY` | warning | 表格结构无法完整还原 |
| `GROUP_RELATIONSHIP_MISSING` | warning | 组关系缺失或无法恢复 |

## 9. 回环验证

反向导出完成后，应支持：

```text
HTML -> InDesign -> HTML
```

比较：

- 页面数量。
- 页面尺寸。
- 页面标签。
- 主网格和页边距。
- 对象数量。
- 对象 ID。
- 样式 token。
- 资源引用。
- 文本内容。
- 表格结构。

视觉比较已进入反向作者包审核链路。交付前或作为规范样例时，应运行 `npm run audit:reverse-visual`；允许的 accepted 差异必须有结构化证据和报告说明，missing、mismatched 和 errors 必须为 0。

回环验证的门禁口径以 `src/writers/html/audit/` 为准。CLI、plugin 和 E2E 可以选择不同输入、输出目录或严格度参数，但不能绕过内容库存、结构签名和反向视觉证据这些共享审核语义；否则同一作者包会在不同入口产生相互矛盾的通过/失败结论。

## 10. 实施顺序

推荐阶段：

1. 前向导出写完整标签。
2. 结构化反向导出本项目生成的 InDesign。
3. observation 模式支持未标注 InDesign。
4. Agent 语义化回写。
5. 母版和页面结构模板增强。

高级 InDesign 原生能力应后移。先建立标签协议和反向骨架，再逐项补齐高级能力。
