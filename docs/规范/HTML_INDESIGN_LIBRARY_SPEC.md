# html-indesign 库设计规范

## 1. 项目目标

`html-indesign` 当前是一个分页 HTML 与 Adobe InDesign 双向转换库；架构目标是固定分页文档的多格式翻译库。HTML 与 InDesign 是当前产品化主线，PPTX 等后续格式必须通过统一语义模型和格式适配器接入，不能另起一套两两互转链路。

长期目标：

```text
Paged HTML <-> InDesign Document
```

第一阶段目标：

```text
Paged HTML
-> Browser Layout Snapshot
-> InDesign Build Instructions
-> InDesign Document
```

第一阶段不做任意长网页自动分页，也不做模板选择或母版推理。HTML 必须已经分页，每个 HTML 页面对应一个 InDesign 页面。浏览器负责计算每页内部布局，InDesign 页面使用相同物理尺寸承接布局结果。

## 2. 核心原则

### 2.1 页面一对一

HTML 中的每个页面容器对应一个 InDesign 页面。

推荐页面结构：

```html
<main class="deck">
  <section class="page" data-page="cover">
    ...
  </section>
  <section class="page" data-page="agenda">
    ...
  </section>
</main>
```

页面必须声明物理尺寸：

```css
.page {
  width: 528mm;
  height: 297mm;
  position: relative;
  overflow: hidden;
}
```

转换时不做任意 fit-to-page 视觉适配。页面尺寸由明确模式决定：

| 模式 | InDesign 坐标单位 | 页面尺寸来源 | 用途 |
| ---- | ----------------- | ------------ | ---- |
| `print` | `mm` | HTML 声明的物理尺寸 | 需要保留纸张、打印或毫米制尺寸的文档 |
| `presentation` | `pt` | 浏览器捕获像素，或显式 `targetSize` | 屏幕演示、PDF 放映、希望 CSS 视觉 px 直接对齐 ID 坐标的文档 |

`presentation` 模式下，浏览器视觉 CSS px 映射为 InDesign point。默认目标尺寸等于捕获到的 HTML 页面像素；也可以指定等比例目标尺寸，例如 2560x1440。指定目标尺寸时只允许同宽高比缩放，元素坐标、线宽、圆角、字号和间距随同一比例进入 InDesign。

`print` 模式仍按物理尺寸换算：

```text
mmPerPxX = pageWidthMm / pageRect.widthPx
mmPerPxY = pageHeightMm / pageRect.heightPx
```

### 2.2 浏览器布局为页内坐标真相

库不重新实现 flex、grid、flow、absolute、relative、table layout 等浏览器布局算法。Chromium 渲染后的每个可映射元素 bounding box 是页内坐标真相。

### 2.3 样式资源优先

CSS 不应直接编译为散落的 InDesign 局部 override。转换应优先创建或复用 InDesign 样式资源：

- 色板：`swatches`
- 字体和复合字体：`fonts`、`compositeFonts`
- 段落样式：`paragraphStyles`
- 字符样式：`characterStyles`
- 对象样式：`objectStyles`
- 框架样式：`frameStyles`
- 表格样式和单元格样式：`tableStyles`、`cellStyles`

元素应引用样式资源。仅当某些样式不能稳定归并为资源时，才允许生成局部 override，并必须记录 warning。

稳定 token 到 InDesign 面板显示名的映射由语义库负责。未声明项目语义库时使用 `presets/<profile>/semantic-preset.json`；作者包声明 `semanticPreset` 后，只使用项目语义库快照，标准语义库不再参与合并。`src/semantic-preset/` 是该能力的库级 API 边界，未来 `indesign-cli` 插件也必须调用这些 API，而不是通过 shell 调 npm scripts。

### 2.4 尽量 native，必要时 fallback

转换优先生成可编辑 InDesign 对象：

- 文本 -> `TextFrame`
- 图片、PDF、PSD、AI、SVG -> `GraphicFrame` + linked placed asset
- 色块、边框、线条 -> InDesign page item
- 表格 -> InDesign table

当 CSS 效果无法可靠映射为 native InDesign 对象时，允许 fallback。fallback 不得静默发生，必须进入报告。

两种输出偏好：

| 模式 | 目标 | 策略 |
| ---- | ---- | ---- |
| `editable-first` | 最大化 InDesign 可编辑性 | 优先 native 对象，允许视觉近似 |
| `fidelity-first` | 最大化视觉还原 | 复杂效果允许局部栅格化 |

默认模式为 `editable-first`。

## 3. 总体架构

库级架构以统一语义模型为中心，而不是以某一种输入或输出格式为中心。

```text
HTML Adapter
  - browser snapshot
  - CSS/style/resource extraction
  - data-id semantic extraction
  |
  v
Semantic Model
  - document/page/parentPage
  - layers/styles/assets/guides
  - items/labels/layout metadata
  - source package and semantic preset metadata
  ^
  |
InDesign Adapter
  - html_indesign label reader/writer
  - InDesign object snapshot
  - parent page/style/layer extraction

Semantic Model -> HTML Writer -> fixed semantic HTML
Semantic Model -> Instruction Compiler -> InDesign Build Instructions -> InDesign Executor
```

当前已实现主线仍是：

```text
Paged HTML
-> Browser Layout Snapshot
-> Style/Element Compiler
-> InDesign Build Instructions
-> InDesign Executor
```

这条链路会逐步迁移为：

```text
Paged HTML -> Semantic Model -> InDesign
InDesign -> Semantic Model -> Paged HTML
```

`Build Instructions` 只是 InDesign 执行器消费的命令格式，不是长期事实模型。反向导出、回环校验、模板/母版保真都必须以 `Semantic Model` 和标签协议为依据。

### 3.1 多格式演进和字段注册表

未来 PPTX、PDF 页面包或其他分页文档格式只能作为格式适配器接入：

```text
HTML Adapter <-> Semantic Model <-> InDesign Adapter
PPTX Adapter <-> Semantic Model <-> HTML/InDesign Adapter
```

字段边界必须由协议字段注册表统一管理。注册表实现前，本文的 Canonical Mapping Model、`SEMANTIC_PROTOCOL.md`、`LABEL_PROTOCOL.md` 和 `REVERSE_EXPORT.md` 中的静态字段表仍是当前行为事实源；注册表实现后，重复字段表应迁移为注册表集中维护或生成文档。

新增字段必须先确认属于哪一类：

| 字段类别 | 说明 |
| -------- | ---- |
| canonical field | HTML、InDesign、未来 PPTX 都应理解的通用分页文档事实 |
| source metadata | 作者源码包、原始 DOM、InDesign 对象 ID 等来源追踪信息 |
| format extension | 仅某个格式原生拥有的能力，如 InDesign PDF place preference、PPTX placeholder |
| observation field | 反向导出看到但未通过白名单复核的线索 |
| retired field | 已退役字段，只能进入观察、迁移报告或历史文档 |

格式能力差异必须进入能力矩阵表达为 `native`、`lossless`、`approximate`、`fallback`、`observe-only` 或 `unsupported`。不得因为 InDesign 或 PPTX 某个格式缺能力，就把 canonical 字段改名、拆散或静默丢弃。

### 3.2 模块职责

| 层级 | 职责 | 典型模块 |
| ---- | ---- | -------- |
| HTML Adapter | 加载 HTML，等待资源，读取浏览器布局，抽取 `data-id-*`、CSS、资源 | `src/paged-html/*` |
| Semantic Model | 保存双向共享事实：页面、母版、样式、图层、对象、资源、标签、网格 | `src/semantic-model/*` |
| InDesign Adapter | 从 InDesign 标签和对象生成模型；把模型转为执行指令和标签 | `src/indesign-reverse/*`、`src/paged-html/instructions-compiler.js` |
| HTML Writer | 从模型生成固定语义 HTML 或 observation HTML | `src/indesign-reverse/html-writer.js` |
| InDesign Executor | 只执行已验证 instructions，创建 InDesign 原生对象 | `_indesign_scripts/*` |

ExtendScript 不负责 HTML 解析、CSS cascade、浏览器 layout 或语义推理。

## 4. 建筑汇报映射范围

建筑设计汇报的核心内容不只是文字和网页图片。库必须把 InDesign 中实际常见的对象体系作为一等模型处理，尤其是图纸 PDF、PSD、AI、SVG 和高分辨率图片的置入。

| 类别 | 建筑汇报常见内容 | InDesign 目标 | 关键映射字段 |
| ---- | ---------------- | ------------- | ------------ |
| Document | 汇报册、方案文本、展板 | document preferences | 页面尺寸、页数、对页、出血、颜色策略 |
| Page | 封面、目录、章节页、图文页 | page / spread | 尺寸、顺序、页面标签、bleed |
| Layer | 底图、图纸、分析叠加、标注、文字 | InDesign layer 或 z-order group | layer name、zIndex、锁定/可见性 |
| Swatch | 品牌色、分析分区色、线色 | swatch | RGB/CMYK、tint、opacity |
| Typography | 标题、正文、图注、指标数字 | paragraph/character styles | 字体、复合字体、字号、行距、字距、列表 |
| Text Frame | 标题框、正文框、图注框 | TextFrame | bounds、inset、columns、vertical justification、overset |
| Graphic Frame | 图片框、图纸框、PSD/AI/SVG 框 | Rectangle/Oval/Polygon + placed graphic | frame bounds、object style、fitting、crop |
| Placed Asset | JPG、PNG、TIFF、PDF、PSD、AI、SVG | linked/imported graphic | file path、type、page/artboard/layer comp、link status |
| Vector Shape | 线、箭头、分区色块、分析标注 | Line/Rectangle/Oval/Polygon/Path | fill、stroke、arrowhead、path points、opacity |
| Table | 面积表、经济技术指标、对比表 | InDesign table | table/cell styles、row/column strokes、cell inset |
| Group | 案例卡片、指标组、图例组 | group | child items、transform、label |
| Fallback | 复杂阴影、滤镜、mask、canvas | placed raster/vector fallback | reason、source element、output asset |

## 5. Canonical Mapping Model

内部语义模型必须把“文档、页面、母版、样式、资源、框架、置入内容、标签”拆开。HTML -> InDesign 和 InDesign -> HTML 必须使用同一组语义字段。

模型不是 InDesign build instructions。instructions 可以从模型派生，但不能反过来成为唯一事实来源。

本章字段表描述当前模型边界。字段注册表实现后，本章应引用注册表生成结果或只保留模型结构说明，避免字段定义在多个文档里分叉。

### 5.1 DocumentModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 文档 ID |
| `title` | string | 文档标题 |
| `pageSize.widthMm` | number | 页面宽度 |
| `pageSize.heightMm` | number | 页面高度 |
| `facingPages` | boolean | 是否对页 |
| `bleed` | `{top,right,bottom,left}` | 出血，单位 mm |
| `colorIntent` | enum: `rgb`, `cmyk`, `mixed` | 颜色策略 |
| `unitMode` | enum: `print`, `presentation` | 坐标和页面尺寸策略 |
| `coordinateUnit` | enum: `pt`, `mm` | 语义模型和标签中裸数字几何值的统一单位；`presentation` 默认 `pt`，`print` 默认 `mm` |
| `labels` | `LabelModel[]` | 文档级协议标签 |
| `parentPages` | `ParentPageModel[]` | InDesign 母版页 / HTML 跨页重复模板 |
| `pages` | `PageModel[]` | 页面列表 |
| `layers` | `LayerModel[]` | 层列表 |
| `styles` | `StyleModel` | 样式资源 |
| `assets` | `AssetModel[]` | 外部资源 |

### 5.2 PageModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 页面 ID |
| `index` | number | 页面顺序 |
| `label` | string | 页面标签 |
| `semantic` | string | 页面语义 |
| `parentPageId` | string | 应用的 InDesign 母版页稳定 ID |
| `parentPageName` | string | 应用的 InDesign 母版页显示名 |
| `layout` | string | HTML/Agent 侧页面结构模板稳定 token，不自动对应 InDesign 母版 |
| `widthMm` | number | 页面宽度 |
| `heightMm` | number | 页面高度 |
| `rectPx` | `RectPx` | 浏览器页面 box |
| `mmPerPxX` | number | X 方向单位换算 |
| `mmPerPxY` | number | Y 方向单位换算 |
| `margins` | `{top,right,bottom,left}` | 页边距；来自 `.page` padding 或 `data-id-margin` |
| `guides` | `GuideModel[]` | 页面参考线；当前主要来自页面级网格 |
| `items` | `PageItemModel[]` | 页面对象 |

### 5.3 ParentPageModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 母版页 ID |
| `name` | string | InDesign 母版页名称 |
| `semantic` | string | 母版语义 |
| `provides` | string[] | 提供的跨页重复结构，如 `folio`、`header-line` |
| `items` | `PageItemModel[]` | 母版页对象 |
| `labels` | `LabelModel[]` | 母版标签 |

母版页只承载跨页重复结构：页码、页眉页脚、章节标识、固定装饰线、永远重复的背景元素和页面参考线。

“左文右图”“四图矩阵”“指标卡片区”等页面结构模板属于 HTML/Agent 侧布局约束，记录在 PageModel 的 `layout`，不默认导出为 InDesign 母版。

反向导出时不得把 InDesign 母版对象机械等同为 HTML 模板内容。母版对象按用途分层处理：

| 母版对象类型 | HTML/模型处理 |
| ------------ | ------------- |
| 稳定重复且可见的内容，如页码、页眉页脚、章节标识、固定装饰线、重复背景 | 进入 `ParentPageModel.items`，作者包目标结构中应写入 `templates/*.html`，页面通过 `parentPageId` 引用 |
| 页面参考线、边距、主网格 | 进入 `PageModel.guides`、`margins`、`grid` 或母版 guide，不生成可打印对象 |
| 只用于人类套模板的空图片框、空 PDF 框、空版式框 | 不作为可见 HTML 内容输出；可作为观察到的布局候选、区域线索或报告项保留 |
| “右侧大图区域”“卡片区”“双图区”等可重复页面区域 | 作为 HTML/Agent 侧布局约束或 `layout` 语义处理，不默认成为 InDesign 母版可见对象 |
| 实际置入了图片、PDF、PSD、AI、SVG 的图框 | 作为页面内容处理；只有同一资源和同一位置跨页稳定重复时，才可提升为母版内容 |

换言之，模板只承载稳定重复层；页面结构模板负责约束 Agent 可以在何处组织内容；空占位框默认只是线索，不是内容。

### 5.4 StyleModel

| 字段 | InDesign 目标 | 说明 |
| ---- | ------------- | ---- |
| `swatches` | Swatches | 颜色资源 |
| `fonts` | Fonts | 字体引用和 fallback |
| `compositeFonts` | Composite Fonts | 中英混排复合字体 |
| `paragraphStyles` | Paragraph Styles | 块级文本样式 |
| `characterStyles` | Character Styles | 局部文字样式 |
| `objectStyles` | Object Styles | 框、形状、图片框样式 |
| `frameStyles` | TextFrame/Graphic fitting preferences | 语义层框架样式 |
| `tableStyles` | Table Styles | 表格样式 |
| `cellStyles` | Cell Styles | 单元格样式 |

每个样式资源应能携带稳定 token 和 InDesign 显示名。token 用于 HTML/Agent 协议，显示名用于 InDesign 面板。

### 5.5 PageItemModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 稳定对象 ID |
| `role` | enum: `text`, `graphic`, `shape`, `line`, `table`, `group`, `fallback` | 对象角色 |
| `sourceSelector` | string | HTML 来源选择器 |
| `tagName` | string | HTML 标签名 |
| `semantic` | string | 稳定语义 token |
| `htmlClass` | string | HTML class |
| `boundsMm` | `RectMm` | 页面内几何位置 |
| `zIndex` | number | 页面内叠放顺序 |
| `layer` | string | 目标层 |
| `styleRefs` | `StyleRefs` | 样式引用 |
| `transform` | `TransformModel` | transform 信息 |
| `opacity` | number | 透明度 |
| `content` | object | 文本、资源、表格等内容 |
| `labels` | `LabelModel[]` | InDesign/HTML 双向标签 |
| `fallback` | `FallbackModel` | fallback 信息 |

### 5.6 StyleRefs

| 字段 | 含义 |
| ---- | ---- |
| `swatch` | 主色板引用 |
| `paragraphStyle` | 段落样式引用 |
| `characterStyles` | 字符样式引用列表 |
| `objectStyle` | 对象样式引用 |
| `frameStyle` | 框架样式引用 |
| `tableStyle` | 表格样式引用 |
| `cellStyle` | 单元格样式引用 |

样式引用必须能区分稳定 token 和 InDesign 显示名。推荐结构为 `{ "token": "page-title", "displayName": "页面标题" }`；仅写字符串属于历史简写，只能作为迁移输入，不能作为双向协议的唯一表达。

### 5.7 AssetModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 资源 ID |
| `src` | string | 原始路径或 URL |
| `resolvedPath` | string | 本地可置入路径 |
| `kind` | enum: `raster`, `pdf`, `psd`, `ai`, `svg`, `vector`, `fallback`, `unknown` | 资源类型 |
| `mimeType` | string | MIME 类型 |
| `fileName` | string | 文件名 |
| `linked` | boolean | 是否作为 InDesign link 保留 |
| `naturalWidthPx` | number | 浏览器自然宽度 |
| `naturalHeightPx` | number | 浏览器自然高度 |
| `pageCount` | number | PDF/AI 页数或画板数 |
| `colorProfile` | string | 色彩配置 |
| `transparent` | boolean | 是否含透明通道 |
| `warnings` | string[] | 资源级 warning |

### 5.8 GraphicFrameModel 与 PlacedGraphicModel

图形框和置入内容必须分开建模。InDesign 中 frame bounds 和 graphic content transform 是两个不同层级。

| 模型 | 字段 | 含义 |
| ---- | ---- | ---- |
| `GraphicFrameModel` | `boundsMm` | 图片框/图纸框位置和大小 |
| `GraphicFrameModel` | `objectStyle` | 框自身样式 |
| `GraphicFrameModel` | `frameStyle` | fitting、clip、inset 等框架设置 |
| `PlacedGraphicModel` | `assetId` | 被置入资源 |
| `PlacedGraphicModel` | `fit` | `cover`、`contain`、`fill`、`none` |
| `PlacedGraphicModel` | `position` | `center`、`top-left` 等 |
| `PlacedGraphicModel` | `crop` | 裁切框信息 |
| `PlacedGraphicModel` | `scaleX` / `scaleY` | 内容缩放 |
| `PlacedGraphicModel` | `offsetX` / `offsetY` | 内容在框内偏移 |
| `PlacedGraphicModel` | `rotation` | 内容旋转 |
| `PlacedGraphicModel` | `pageNumber` | PDF 页码 |
| `PlacedGraphicModel` | `artboard` | AI/SVG 画板或导入区域 |
| `PlacedGraphicModel` | `layerComp` | PSD layer comp |
| `PlacedGraphicModel` | `preserveVector` | 是否优先保留矢量 |

### 5.9 LabelModel

标签协议详见 `LABEL_PROTOCOL.md`。模型层只要求标签可序列化、可验证、可回写。

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `protocol` | string | 固定为 `html-indesign` |
| `version` | number | 标签协议版本 |
| `kind` | string | `document`、`page`、`parentPage`、`item`、`style`、`layer`、`guide` |
| `id` | string | 稳定 ID |
| `source` | string | `html-to-indesign`、`manual-tagged`、`blueprint-migration`、`agent-semanticized` |
| `payload` | object | kind 特定字段 |

## 6. 输入约束

### 6.1 页面容器

页面容器必须满足：

- 能被选择器识别，默认 `[data-page], .page`。
- 有明确物理宽高，推荐 `mm`。
- 不依赖浏览器滚动区域表达分页。
- 页面内部溢出默认视为错误或 warning。

页面级 `padding` 映射为 InDesign 页边距。若页面使用绝对定位且不能通过 padding 表达边距，可用 `data-id-margin="top right bottom left"` 声明非视觉页边距。页面级主网格必须通过可解析的 CSS Grid 或 `data-id-grid="12"` / `data-id-grid="12x9"` 声明，编译为 InDesign 原生参考线，不生成可打印对象。

边距和主网格也是 Agent 作者侧规则，不只是输出到 InDesign 的辅助信息。新写分页 HTML 时，每个页面必须有可识别页边距和主网格规则；顶层可映射元素应优先贴合页边距、列线、行线、gutter 两侧或 baseline。CSS Grid 的 `gap` 等同于 InDesign 常见的带间距网格，适合表达建筑汇报里的图文列、卡片阵列、图纸区和标注区。嵌套在卡片、图例、表格内部的文字可以服从局部节奏，不强制贴页面主网格。

页面可以同时声明输出参考线和作者侧吸附网格：

| 属性 | 用途 |
| ---- | ---- |
| `data-id-grid="12x6"` | 描述 12 列、6 个粗行模块主网格，适合建筑汇报默认参考线 |
| `data-id-grid="12"` | 只描述 12 列主网格，不生成粗行参考线 |
| `data-id-grid="12x9"` | 描述 12 列、9 行主网格，生成带 gutter 的 InDesign 页面参考线 |
| `data-id-column-gutter` / `data-id-row-gutter` | 声明主网格栏间距和行间距；这是协议字段，`data-id-column-gap` / `data-id-row-gap` 不再作为等价别名读取 |
| `data-id-baseline="4mm"` | 声明作者侧 baseline / 模数行，用于 HTML 排版与校验；默认不全量生成可见参考线 |
| `data-id-baseline-guides="all"` | 显式要求把每条 baseline 也输出为 InDesign 可见参考线，通常只用于调试 |
| `data-id-snap-grid="2mm"` | 描述次级微调模数；不能单独满足页面主网格规则 |
| `data-id-snap-grid-x` / `data-id-snap-grid-y` | 分别声明水平和垂直方向的作者侧模数 |
| `data-id-guide-mode="used-snap"` | 兼容/调试模式：InDesign 参考线来自实际顶层排版对象边缘和页边距，不作为建筑汇报默认规则 |

作者侧检查器 `validateAuthoringRules` 负责在快照层检查这些约束：

| 代码 | 等级 | 含义 |
| ---- | ---- | ---- |
| `PAGE_MARGIN_RULE_MISSING` | error | 页面缺少边距规则 |
| `PAGE_GRID_RULE_MISSING` | error | 页面缺少网格规则 |
| `PAGE_GRID_RULE_INVALID` | error | 网格声明不可解析 |
| `GRID_ALIGNMENT_OFF` | warning | 元素边缘未贴合声明网格 |
| `SEMANTIC_TOKEN_MISSING` | warning | 可映射元素缺少稳定语义 token |

普通模式下，网格偏移和语义 token 缺失先作为 warning；`strict` 模式会把 warning 提升为 error。

### 6.2 可映射元素

不是所有 DOM 节点都生成 InDesign 对象。默认采集以下元素：

| HTML 元素或属性 | 默认映射 |
| --------------- | -------- |
| `h1`-`h6` | 文本框 + 段落样式 |
| `p` | 文本框 + 段落样式 |
| `ul` / `ol` / `li` | 文本框 + 列表段落样式 |
| `img` | linked placed raster asset |
| `figure` | 图片框、说明文本或组合对象 |
| `figcaption` | 文本框 + caption 段落样式 |
| `object[type="application/pdf"]` | placed PDF |
| `embed[type="application/pdf"]` | placed PDF |
| `a[href$=".pdf"]` with `[data-id-object]` | placed PDF |
| `table` | InDesign table |
| `svg` | placed vector / native vector / fallback |
| `canvas` | raster fallback |
| `[data-id-object]` | 强制生成 InDesign 对象 |
| `[data-id-ignore]` | 不生成对象 |

布局容器默认不生成对象，除非它有可见背景、边框、阴影、clip、mask、transform，或显式声明 `[data-id-object]`。

### 6.3 建筑资产输入约定

建筑汇报中图纸和设计资产应显式声明资源语义，避免把 PDF、PSD、AI、SVG 全部退化成普通网页图片。

```html
<object data="drawings/site-plan.pdf"
        type="application/pdf"
        data-id-object
        data-id-asset-kind="pdf"
        data-id-pdf-page="3"
        data-id-crop="trim"
        data-id-fit="contain"></object>

<img src="renders/lobby.psd"
     data-id-object
     data-id-asset-kind="psd"
     data-id-layer-comp="presentation">

<img src="diagrams/axon.ai"
     data-id-object
     data-id-asset-kind="ai"
     data-id-artboard="2">
```

| 属性 | 含义 |
| ---- | ---- |
| `data-id-asset-kind` | 显式资源类型：`raster`、`pdf`、`psd`、`ai`、`svg` |
| `data-id-pdf-page` | PDF 页码 |
| `data-id-crop` | PDF crop box：`media`、`crop`、`bleed`、`trim`、`art` |
| `data-id-artboard` | AI/SVG 画板或导入区域 |
| `data-id-layer-comp` | PSD layer comp |
| `data-id-fit` | `cover`、`contain`、`fill`、`none` |
| `data-id-preserve-vector` | 是否优先保留矢量 |

历史字段 `data-id-page` 曾被用作 PDF 页码。新 HTML 必须使用 `data-id-pdf-page`；读取层不得把 `data-id-page` 当作 PDF 页码参与编译，只能把它记录为无效观察字段或迁移问题，避免和页面容器标记 `data-page` 混淆。

### 6.4 CSS 支持范围

库应尽最大可能支持常见 CSS，但必须区分支持等级：

| 等级 | 含义 |
| ---- | ---- |
| `native` | 可稳定映射到 InDesign native 样式或对象 |
| `approximate` | 可近似映射，可能有视觉偏差 |
| `fallback` | 使用 raster/vector fallback |
| `unsupported` | 记录 warning 或 error |

## 7. Layout Snapshot

浏览器快照是 HTML 到 InDesign 的中间事实层。它只描述浏览器渲染结果，不包含 InDesign 具体操作。

建议结构：

```json
{
  "metadata": {
    "source": "input.html",
    "capturedAt": "ISO-8601",
    "viewport": { "width": 1920, "height": 1080 }
  },
  "pages": [
    {
      "id": "page-1",
      "index": 0,
      "widthMm": 528,
      "heightMm": 297,
      "rectPx": { "x": 0, "y": 0, "width": 1995, "height": 1123 },
      "elements": []
    }
  ],
  "assets": [],
  "warnings": []
}
```

元素快照字段：

```json
{
  "id": "el-42",
  "tagName": "h1",
  "role": "text",
  "pageIndex": 0,
  "rectPx": { "x": 120, "y": 80, "width": 600, "height": 90 },
  "rectMm": { "x": 31.76, "y": 21.14, "width": 158.74, "height": 23.76 },
  "zIndex": 10,
  "text": "标题",
  "computedStyle": {},
  "classList": ["page-title"],
  "data": {}
}
```

快照必须采集：

- 页面 box。
- 可映射元素 box。
- computed style。
- DOM class、id、data attributes。
- 伪元素 `::before` / `::after` 的可见内容和样式。
- list marker / CSS counters 的可见结果。
- 图片、PDF、PSD、AI、SVG 原始路径、自然尺寸、置入选项和 object-fit 结果。
- transform 后的边界和原始 transform。
- clip / overflow 影响。
- 元素层级。

## 8. 样式映射

### 8.1 色板 Swatches

CSS 颜色应映射为 InDesign 色板。

来源：

- CSS custom properties，例如 `--color-primary: #ff7832`
- `color`
- `background-color`
- `border-color`
- `text-decoration-color`
- SVG fill/stroke

命名规则：

| CSS 来源 | InDesign 色板名 |
| -------- | --------------- |
| `--color-primary` | `color-primary` |
| class 内匿名颜色 | `auto-color-<hash>` |
| inline 匿名颜色 | `auto-color-<hash>` |

颜色值第一阶段使用 RGB hex。后续可扩展 CMYK、Spot、Tint。

### 8.2 字体与复合字体

CSS 字体族应映射到 InDesign 字体资源。中文项目必须支持复合字体。

来源：

- `font-family`
- `font-weight`
- `font-style`
- CSS token，例如 `--font-title`
- `@font-face`

映射目标：

- InDesign font family。
- InDesign font style。
- composite font。
- CJK、Latin、数字、标点的相对字号和字重。

当浏览器字体与 InDesign 字体无法精确匹配时，必须记录 warning，并使用配置中的 font fallback。

### 8.3 段落样式 Paragraph Styles

块级文本优先映射为段落样式。

默认产生段落样式的元素：

- `h1`-`h6`
- `p`
- `li`
- `figcaption`
- `blockquote`
- `[data-id-paragraph-style]`

CSS 到段落样式的核心映射：

| CSS | InDesign |
| --- | -------- |
| `font-family` | applied font |
| `font-size` | point size |
| `font-weight` | font style / synthetic mapping |
| `font-style` | font style |
| `line-height` | leading |
| `color` | fill color swatch |
| `text-align` | justification |
| `letter-spacing` | tracking |
| `margin-top` | space before |
| `margin-bottom` | space after |
| `text-indent` | first line indent |
| `padding-left` on text block | left indent if semantically text padding |
| `list-style-*` | bullets and numbering |
| `break-inside` / `orphans` / `widows` | keep options, when feasible |

段落样式命名：

| 来源 | 样式名 |
| ---- | ------ |
| `.page-title` | `page-title` |
| `[data-id-paragraph-style="hero-title"]` | `hero-title` |
| 无 class 但样式重复 | `auto-paragraph-<hash>` |

### 8.4 字符样式 Character Styles

局部文本样式映射为字符样式。

默认产生字符样式的元素：

- `span`
- `strong`
- `b`
- `em`
- `i`
- `mark`
- `sup`
- `sub`
- `[data-id-character-style]`

CSS 到字符样式的核心映射：

| CSS | InDesign |
| --- | -------- |
| `font-family` | applied font |
| `font-size` | point size override |
| `font-weight` | font style |
| `font-style` | font style |
| `color` | fill color swatch |
| `letter-spacing` | tracking |
| `vertical-align: super/sub` | position / baseline shift |
| `text-decoration` | underline / strikethrough |
| `text-transform` | capitalization where feasible |

字符样式必须应用到文本 run，而不是拆成多个独立文本框，除非布局或 fallback 要求。

### 8.5 对象样式 Object Styles

可见容器、图片框、形状和线条优先映射为对象样式。

CSS 到对象样式的核心映射：

| CSS | InDesign |
| --- | -------- |
| `background-color` | fill color |
| `border-color` | stroke color |
| `border-width` | stroke weight |
| `border-style` | stroke type approximation |
| `border-radius` | corner radius |
| `opacity` | blending opacity |
| `box-shadow` | approximate or fallback |
| `mix-blend-mode` | approximate or fallback |
| `overflow: hidden` | clipping frame |
| `clip-path` | vector clip or fallback |

对象样式命名与段落样式相同，优先使用 class 或 `data-id-object-style`。`data-id-style` 只允许在编译层已经确定样式种类的上下文中作为简写，不能作为未知类型样式的通用兜底。

### 8.6 框架样式 Frame Styles

框架样式是语义层概念，编译到 InDesign 时落在对象样式、text frame preferences 或 fitting options 上。

映射：

| CSS | InDesign |
| --- | -------- |
| `padding` on text frame | inset spacing |
| `display:flex; align-items:center` on text frame | vertical justification approximation |
| `column-count` | text column count |
| `column-gap` | text column gutter |
| `object-fit: cover` | fill proportionally / crop |
| `object-fit: contain` | fit proportionally |
| `object-position` | content alignment |

### 8.7 表格和单元格样式

HTML table 应优先映射为 InDesign table。

映射目标：

- table style
- header cell style
- body cell style
- row / column stroke
- cell fill
- cell inset
- cell text paragraph style

复杂 CSS table 无法 native 映射时，可退化为 grouped frames 或 raster fallback。

## 9. 元素映射

### 9.1 文本

文本元素生成 InDesign `TextFrame`。

处理规则：

- 使用浏览器 box 决定 text frame 几何位置。
- 使用段落样式和字符样式表达格式。
- 保留换行和段落结构。
- 支持 `::before` / `::after` 和 list marker 的文本内容。
- 构建后必须检查 overset text。

文本 1:1 风险：

- 浏览器和 InDesign 字体引擎不同。
- 同名字体可能不同。
- line-height、tracking、CJK 标点处理可能不同。

因此文本必须在执行后进入验证报告。

### 9.2 置入资源和图形框

图片、图纸 PDF、PSD、AI、SVG 都生成 `GraphicFrameModel + PlacedGraphicModel`，再由执行器创建 InDesign 图形框并置入资源。

核心规则：

- 浏览器 box 映射到 frame bounds。
- `object-fit` / `data-id-fit` 映射到 placed content fitting。
- `object-position` 映射到 content alignment。
- 资源必须解析为本地可置入路径。
- 默认保留 link，不嵌入资产。
- 缺失资源必须报错。

| 资产类型 | HTML 来源 | InDesign 目标 | 必须支持 | 可后置 |
| -------- | --------- | ------------- | -------- | ------ |
| JPG/PNG/TIFF/WEBP | `img` | linked image | 透明、裁切、cover/contain、link status | ICC profile |
| PDF 图纸 | `object` / `embed` / 显式 data 属性 | placed PDF | page number、crop box、scale、vector preservation | PDF layer visibility |
| AI | `img` / `object` + `data-id-asset-kind="ai"` | placed AI/PDF-compatible asset | artboard/page、scale、crop、vector preservation | AI layer visibility |
| PSD | `img` + `data-id-asset-kind="psd"` | placed PSD | transparency、scale、crop、link status | layer comp、layer visibility |
| SVG | inline `svg` / external SVG | placed vector or fallback | preserve vector when reliable、viewBox、scale | native path decomposition |
| Canvas | `canvas` | raster fallback | rendered bitmap、bounds、warning | editable reconstruction |

PDF 图纸必须作为一等资源处理。它不是“图片截图”，默认应作为 linked PDF 置入，并保留页码、crop box、矢量属性和 link。

InDesign 反向导出 PDF/AI 置入资源时，必须读取实际图形对象的置入页码、crop box、图层显隐和内容裁切几何。生成 HTML 预览图时，优先由 InDesign 导出当前图框的实际可见结果，因此预览必须反映该链接在 InDesign 中指定的页码、crop box、图层显隐、缩放和裁切。作者 HTML 必须写出 `data-id-pdf-page`，反向再导出 InDesign 时必须把该值恢复为 PDF place preference；历史 `data-id-page` 只作无效观察字段或迁移问题，不作为读取兜底。

PSD 和 AI 也应优先保留为 linked placed asset。只有在 InDesign 置入失败、浏览器效果无法表达或用户选择 `fidelity-first` 局部栅格化时，才生成 fallback。

### 9.3 背景和形状

带可见背景、边框或装饰效果的容器生成 shape/object frame。

处理规则：

- 纯背景色 -> rectangle + fill swatch。
- border -> stroke。
- border-radius -> corner radius。
- 多层背景、渐变、复杂 shadow -> approximate 或 fallback。

### 9.4 SVG

SVG 优先保留为矢量置入资源。简单 SVG 后续可以拆解为 native vector shape，但第一优先级是可靠置入和视觉还原。若 InDesign 环境不能可靠置入或效果不兼容，则转换为 PDF/PNG fallback。

### 9.5 矢量标注和分析图形

建筑汇报中的线、箭头、分区色块、图例、圈注、路径标注应尽量映射为 native vector objects，而不是直接 raster。

| HTML/CSS/SVG 来源 | InDesign 目标 | 关键字段 |
| ----------------- | ------------- | -------- |
| CSS border line | Line / Rectangle stroke | stroke swatch、weight、style |
| absolutely positioned line | Line | x1/y1/x2/y2、stroke、arrowhead |
| SVG `line` / `polyline` | Line / Path | points、stroke、dash、arrowhead |
| SVG `rect` / `circle` / `ellipse` | Rectangle / Oval | fill、stroke、opacity |
| SVG `polygon` / `path` | Polygon / Path | path points、fill rule、stroke |
| zoning overlay | Rectangle/Polygon | fill swatch、opacity、blend |
| callout / arrow | Line + text/group | arrowhead、label、group |

复杂 SVG path 可先作为 placed vector/fallback，但需要在报告中标明没有拆为 native path。

### 9.6 Canvas 和复杂视觉

`canvas`、CSS filter、复杂 mask、复杂 blend、复杂 transform 允许 raster fallback。fallback 需要记录：

- fallback 类型。
- 原因。
- 源元素 selector。
- 输出资源路径。

### 9.7 Transform、Layers 和层级

必须采集并处理：

- `z-index`
- DOM paint order
- `opacity`
- `transform`
- stacking context
- `data-id-layer`

InDesign instructions 应明确元素顺序、zIndex 和目标 layer。建议默认层：

| layer | 用途 |
| ----- | ---- |
| `background` | 底色、底图 |
| `drawing` | 图纸 PDF、AI、CAD 导出图 |
| `image` | 效果图、照片、渲染图 |
| `annotation` | 箭头、线、分区、图例、标注 |
| `text` | 标题、正文、图注、指标 |
| `overlay` | 需要置顶的强调元素 |

无法 native 表达的 transform 使用 fallback。

## 10. Build Instructions

Build instructions 是 InDesign executor 的唯一输入。它应包含页面、样式资源、资源文件和对象列表。

建议结构：

```json
{
  "metadata": {
    "source": "input.html",
    "mode": "editable-first",
    "protocolVersion": 1
  },
  "document": {
    "id": "architecture-report",
    "unitMode": "presentation",
    "coordinateUnit": "pt",
    "labels": [
      {
        "protocol": "html-indesign",
        "version": 1,
        "kind": "document",
        "id": "architecture-report",
        "source": "html-to-indesign"
      }
    ],
    "pages": [
      {
        "id": "page-1",
        "width": 528,
        "height": 297,
        "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 },
        "labels": [
          {
            "protocol": "html-indesign",
            "version": 1,
            "kind": "page",
            "id": "page-1",
            "source": "html-to-indesign"
          }
        ],
        "guides": [
          {
            "orientation": "vertical",
            "position": 60,
            "source": "grid",
            "labels": [
              {
                "protocol": "html-indesign",
                "version": 1,
                "kind": "guide",
                "id": "page-1-grid-x-01",
                "source": "html-to-indesign"
              }
            ]
          }
        ]
      }
    ]
  },
  "styles": {
    "swatches": {},
    "fonts": {},
    "compositeFonts": {},
    "paragraphStyles": {},
    "characterStyles": {},
    "objectStyles": {},
    "frameStyles": {},
    "tableStyles": {},
    "cellStyles": {}
  },
  "assets": [],
  "layers": [
    {
      "token": "text",
      "displayName": "文字",
      "labels": [
        {
          "protocol": "html-indesign",
          "version": 1,
          "kind": "layer",
          "id": "layer-text",
          "source": "html-to-indesign"
        }
      ]
    }
  ],
  "pages": [
    {
      "id": "page-1",
      "items": []
    }
  ],
  "warnings": []
}
```

对象项示例：

```json
{
  "id": "title-1",
  "type": "TEXT",
  "bounds": { "x": 15, "y": 20, "width": 200, "height": 30 },
  "paragraphStyle": { "token": "page-title", "displayName": "页面标题" },
  "runs": [
    { "text": "标题", "characterStyle": null }
  ],
  "labels": [
    {
      "protocol": "html-indesign",
      "version": 1,
      "kind": "item",
      "id": "title-1",
      "source": "html-to-indesign",
      "role": "text",
      "semantic": "page-title"
    }
  ],
  "zIndex": 10
}
```

图形置入项示例：

```json
{
  "id": "site-plan",
  "type": "GRAPHIC",
  "role": "graphic",
  "bounds": { "x": 15, "y": 35, "width": 240, "height": 180 },
  "objectStyle": { "token": "drawing-frame", "displayName": "图纸图框" },
  "frameStyle": { "token": "pdf-contain", "displayName": "PDF 等比置入" },
  "placed": {
    "assetId": "asset-site-plan-pdf",
    "fit": "contain",
    "position": "center",
    "pageNumber": 3,
    "crop": "trim",
    "preserveVector": true
  },
  "layer": "drawing",
  "labels": [
    {
      "protocol": "html-indesign",
      "version": 1,
      "kind": "item",
      "id": "site-plan",
      "source": "html-to-indesign",
      "role": "graphic",
      "semantic": "drawing-frame"
    }
  ],
  "zIndex": 20
}
```

前向导出的 instructions 必须承载完整标签，或承载足以由 executor 确定性生成完整 `html_indesign` 标签的稳定字段。文档、页面、母版页、样式、图层、参考线和页面对象都必须能写出协议标签；紧凑 `pageItem.label` 不能替代 JSON 脚本标签。

## 11. InDesign 执行器要求

执行器职责：

- 创建或复用文档。
- 创建页面并设置物理尺寸。
- 应用页面边距和原生参考线。
- 创建或复用 layers。
- 创建 swatches。
- 创建 fonts / composite font references。
- 创建 paragraph / character / object / table / cell styles。
- 按页面创建对象。
- 应用样式资源。
- place 图片、PDF、PSD、AI、SVG 和 fallback 资源。
- 设置 PDF 页码、crop box、AI artboard、PSD layer comp 等置入选项。
- 设置对象层级。
- 检查 overset text。
- 写入结构化执行报告。

执行器不负责：

- HTML 解析。
- CSS cascade。
- 浏览器 layout。
- 语义推理。
- 模板选择。

## 12. 反向转换

反向转换是长期主线，不再只是预留接口。

目标：

```text
InDesign Document
-> InDesign Reverse Snapshot
-> Semantic Model
-> Paged HTML/CSS
```

反向转换规范见 `REVERSE_EXPORT.md`。

反向转换必须保留：

- InDesign 页面尺寸。
- 页面标签、母版引用、页面结构模板信息。
- page items 的 geometry。
- applied styles。
- style definitions。
- swatches。
- layers。
- guides。
- placed assets。
- graphic frame 与 placed content transform。
- text runs 和字符样式范围。
- object fitting。
- z-order。
- `html_indesign` 标签。

正向生成的 InDesign 必须写入完整 JSON 脚本标签：

```js
target.insertLabel("html_indesign", JSON.stringify({
  protocol: "html-indesign",
  version: 1,
  kind: "item",
  id: "title-1",
  role: "text",
  semantic: "page-title"
}));
```

紧凑 `pageItem.label` 只能作为人类面板和旧调试兜底，不能替代 `html_indesign` JSON 标签。

标签写入失败不得静默吞掉。文档、页面、母版、核心页面对象、样式 token 和图层 token 的标签写入失败是 error；旧兼容标签或非核心诊断标签写入失败至少写入 warning 和执行报告。

反向导出有四种模式：

| 模式 | 用途 |
| ---- | ---- |
| `structured` | 读取本项目生成或人工按协议打标签的 InDesign |
| `inferred` | 读取弱标签 InDesign 或旧 blueprint，并输出带置信度与证据的推断 HTML |
| `observation` | 导出未标注 InDesign 为低语义观察 HTML，供 Agent 补标签 |

## 13. API 设计

库应暴露纯 Node API，CLI 只是薄封装。

建议 API：

```js
const {
  renderSnapshot,
  validateAuthoringRules,
  snapshotToSemanticModel,
  compileStyles,
  compileInstructions,
  exportInDesignToHtml
} = require('html-indesign');

const snapshot = await renderSnapshot({
  htmlPath: 'deck.html',
  pageSelector: '[data-page], .page',
  mode: 'editable-first'
});

const authoring = validateAuthoringRules(snapshot, {
  strict: false
});

const instructions = compileInstructions(snapshot, {
  assetRoot: 'assets',
  styleNaming: 'class-first'
});

const reverse = await exportInDesignToHtml({
  mode: 'structured',
  outDir: 'test/workspace/reverse-export'
});
```

CLI：

```bash
html-indesign snapshot deck.html --out test/workspace/snapshot.json
html-indesign lint-authoring deck.html --strict
html-indesign model deck.html --out test/workspace/model.json
html-indesign compile deck.html --out test/workspace/instructions.json
html-indesign build test/workspace/instructions.json
html-indesign reverse --mode structured --out test/workspace/reverse-export
html-indesign reverse --mode inferred --blueprint test/artifacts/blueprint.json --out test/workspace/reverse-blueprint
html-indesign reverse --mode observation --out test/workspace/reverse-observed
```

## 14. 验证和报告

每次转换应输出结构化报告。

报告内容：

- 页面数量。
- 页面尺寸。
- 采集元素数量。
- 生成 native 对象数量。
- fallback 数量。
- linked assets 数量和缺失数量。
- unsupported CSS 列表。
- 缺失字体。
- 缺失图片。
- PDF/AI/PSD/SVG 置入失败。
- raster fallback 资源路径。
- overset text。
- 页面溢出元素。
- 导出验证结果。

错误等级：

| 等级 | 含义 |
| ---- | ---- |
| `error` | 无法继续或输出不可用 |
| `warning` | 可继续，但有视觉或可编辑性风险 |
| `info` | 转换说明 |

## 15. 测试策略

必须建立三类测试：

### 15.1 Node 单元测试

覆盖：

- 页面识别。
- 作者侧边距、网格和语义 token 校验。
- mm/px 坐标换算。
- CSS token 到 swatch。
- CSS class 到 paragraph/object style。
- asset kind detection。
- graphic frame 与 placed content 分离。
- text run 到 character style。
- element filtering。
- fallback decision。

### 15.2 浏览器快照测试

使用固定 HTML 样例和 Playwright/Chromium，验证：

- 页面 box 尺寸。
- 元素 rect。
- z-index。
- pseudo elements。
- image object-fit。
- PDF/object/embed 元素 box。
- table layout。

### 15.3 真实 InDesign 端到端测试

少量高价值样例通过 `indesign-cli` 执行：

- 纯文本页。
- 图文混排页。
- 表格页。
- 图纸 PDF 置入页。
- PSD 透明图置入页。
- AI/SVG 矢量置入页。
- SVG / canvas fallback 页。
- 中英混排和复合字体页。

执行后验证：

- 无 overset text。
- 页面数量正确。
- 页面尺寸正确。
- 样式资源存在。
- linked assets 存在且状态正常。
- 导出 PDF/IDML 可验证。

## 16. 与现有代码的关系

当前文件可按新架构逐步迁移：

| 当前文件 | 新角色 |
| -------- | ------ |
| `src/paged-html/` | HTML Adapter 的现有实现：浏览器快照、样式读取、HTML -> instructions |
| `src/generator.js` | 历史 blueprint -> 模板预览 HTML，只作为迁移参考 |
| `src/spec-generator.js` | Agent 可读规范生成器，后续从 style model 生成 |
| `src/validator.js` | 历史模板 validator，保留给旧测试和迁移对照 |
| `src/builder.js` | 历史模板 builder，保留给旧测试和迁移对照 |
| `_indesign_scripts/build_from_instructions.jsx` | 保留为 InDesign executor，减少业务逻辑 |
| `_indesign_scripts/extract_blueprint.jsx` | 历史 blueprint 抽取；其输出通过 `src/indesign-reverse/blueprint-migration.js` 归一化为 reverse model |
| `test/artifacts/*.json` | 继续作为真实 InDesign 样式和模板样本 |
| `test/reference/` | 继续作为旧模板和反向生成参考样本 |

第一阶段实现保留现有历史模板能力，并通过 `src/historical-template/*` wrappers 对外暴露给迁移测试。新的浏览器驱动转换代码放在 `src/paged-html/*` 下，可复用工具放在 `src/shared/*` 下；新功能不得继续扩展历史模板路径。

新模块建议：

```text
src/
  semantic-model/
    document-model.js
    labels.js
    styles.js
    assets.js
    validators.js
  paged-html/
    browser-snapshot.js
    style-compiler.js
    semantic-model-compiler.js
    instructions-compiler.js
    instructions-validator.js
  indesign-reverse/
    snapshot-reader.js
    label-protocol.js
    reverse-model.js
    blueprint-migration.js
    html-writer.js
    asset-exporter.js
    report.js
  shared/
    report.js
    geometry.js
    assets.js
```

`instructions-compiler.js` 后续应从“直接消费浏览器快照”迁移为“消费 Semantic Model 并生成 InDesign instructions”。迁移期间可以保留兼容入口，但新增双向能力必须围绕 Semantic Model 和标签协议实现。

## 17. 非目标

第一阶段明确不做：

- 任意长网页自动分页。
- 自动模板选择。
- 从普通未标注 InDesign 自动推理完美语义。
- 把页面结构模板自动推理成 InDesign 母版。
- 完整浏览器 CSS 到 InDesign 的无损 native 映射承诺。
- 完整交互网页转换。
- JavaScript 动态应用状态转换，除非页面在快照前已经稳定渲染。
- CAD/DWG 原生解析。CAD 图纸应先由外部流程导出为 PDF/AI/SVG/图片。
- Photoshop/Illustrator 内部图层的完整编辑重建。第一阶段以 linked placement 为主。

第一阶段可以做：

- 分页 HTML 一页对一页转换。
- Chromium 页内布局测量。
- 样式资源映射。
- 元素 geometry 映射。
- 图片、PDF、PSD、AI、SVG linked placement。
- native 优先转换。
- fidelity fallback。
- 结构化验证报告。

## 18. 成功标准

一次完整转换应满足：

- HTML 页面数量等于 InDesign 页面数量。
- 每页物理尺寸一致。
- 可映射元素的位置和尺寸按页面坐标稳定落到 InDesign。
- CSS 颜色归并为 swatches。
- 文本块优先使用 paragraph styles。
- 局部文字优先使用 character styles。
- 可见框架优先使用 object/frame styles。
- 图片、PDF、PSD、AI、SVG 作为 linked placed assets 置入，除非明确 fallback。
- 图形框和置入内容的 fitting/crop/scale/offset 语义分离且可追踪。
- 图纸 PDF 支持页码和 crop box。
- 建筑分析标注优先使用 native vector objects。
- 不支持或 fallback 的内容有明确报告。
- 输出 InDesign 文档可导出并验证。
