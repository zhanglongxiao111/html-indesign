# html-indesign 库设计规范

## 1. 项目目标

`html-indesign` 是一个分页 HTML 与 Adobe InDesign 双向转换库。

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
  <section class="page" data-page>
    ...
  </section>
  <section class="page" data-page>
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

转换时创建同尺寸 InDesign 页面，不做 fit-to-page 缩放。浏览器测量得到的是 CSS px，InDesign 使用 mm/pt，因此仍需要稳定的单位换算：

```text
mmPerPxX = pageWidthMm / pageRect.widthPx
mmPerPxY = pageHeightMm / pageRect.heightPx
```

这是坐标单位转换，不是视觉适配缩放。

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

```text
HTML/CSS input
  |
  v
Browser Renderer
  - load assets
  - enforce page size
  - wait for fonts/images
  - compute layout
  |
  v
Layout Snapshot
  - pages
  - elements
  - computed styles
  - pseudo elements
  - text runs
  - assets
  |
  v
Style Compiler
  - swatches
  - fonts/compositeFonts
  - paragraph styles
  - character styles
  - object/frame styles
  - table/cell styles
  |
  v
Element Compiler
  - text frames
  - image frames
  - shapes
  - lines
  - tables
  - groups/fallback rasters
  |
  v
Build Instructions
  |
  v
InDesign Executor
```

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

内部 IR 必须把“页面、样式、资源、框架、置入内容”拆开。这样 HTML -> InDesign 和后续 InDesign -> HTML 都能使用同一组语义字段。

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
| `widthMm` | number | 页面宽度 |
| `heightMm` | number | 页面高度 |
| `rectPx` | `RectPx` | 浏览器页面 box |
| `mmPerPxX` | number | X 方向单位换算 |
| `mmPerPxY` | number | Y 方向单位换算 |
| `items` | `PageItemModel[]` | 页面对象 |

### 5.3 StyleModel

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

### 5.4 PageItemModel

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `id` | string | 稳定对象 ID |
| `role` | enum: `text`, `graphic`, `shape`, `line`, `table`, `group`, `fallback` | 对象角色 |
| `sourceSelector` | string | HTML 来源选择器 |
| `tagName` | string | HTML 标签名 |
| `boundsMm` | `RectMm` | 页面内几何位置 |
| `zIndex` | number | 页面内叠放顺序 |
| `layer` | string | 目标层 |
| `styleRefs` | `StyleRefs` | 样式引用 |
| `transform` | `TransformModel` | transform 信息 |
| `opacity` | number | 透明度 |
| `content` | object | 文本、资源、表格等内容 |
| `fallback` | `FallbackModel` | fallback 信息 |

### 5.5 StyleRefs

| 字段 | 含义 |
| ---- | ---- |
| `swatch` | 主色板引用 |
| `paragraphStyle` | 段落样式引用 |
| `characterStyles` | 字符样式引用列表 |
| `objectStyle` | 对象样式引用 |
| `frameStyle` | 框架样式引用 |
| `tableStyle` | 表格样式引用 |
| `cellStyle` | 单元格样式引用 |

### 5.6 AssetModel

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

### 5.7 GraphicFrameModel 与 PlacedGraphicModel

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

## 6. 输入约束

### 6.1 页面容器

页面容器必须满足：

- 能被选择器识别，默认 `[data-page], .page`。
- 有明确物理宽高，推荐 `mm`。
- 不依赖浏览器滚动区域表达分页。
- 页面内部溢出默认视为错误或 warning。

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
        data-id-page="3"
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
| `data-id-page` | PDF 页码 |
| `data-id-crop` | PDF crop box：`media`、`crop`、`bleed`、`trim`、`art` |
| `data-id-artboard` | AI/SVG 画板或导入区域 |
| `data-id-layer-comp` | PSD layer comp |
| `data-id-fit` | `cover`、`contain`、`fill`、`none` |
| `data-id-preserve-vector` | 是否优先保留矢量 |

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
| `[data-id-style="hero-title"]` | `hero-title` |
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

对象样式命名与段落样式相同，优先使用 class 或 `data-id-style`。

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
    "mode": "editable-first"
  },
  "document": {
    "pages": [
      { "id": "page-1", "width": 528, "height": 297 }
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
  "layers": [],
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
  "paragraphStyle": "page-title",
  "runs": [
    { "text": "标题", "characterStyle": null }
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
  "objectStyle": "drawing-frame",
  "frameStyle": "pdf-contain",
  "placed": {
    "assetId": "asset-site-plan-pdf",
    "fit": "contain",
    "position": "center",
    "pageNumber": 3,
    "crop": "trim",
    "preserveVector": true
  },
  "layer": "drawing",
  "zIndex": 20
}
```

## 11. InDesign 执行器要求

执行器职责：

- 创建或复用文档。
- 创建页面并设置物理尺寸。
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

## 12. 反向转换预留

虽然第一阶段是 HTML -> InDesign，但数据结构必须为反向转换留接口。

反向转换目标：

```text
InDesign Document
-> Document Snapshot
-> Style Model
-> Paged HTML/CSS
```

反向转换需要保留：

- InDesign 页面尺寸。
- page items 的 geometry。
- applied styles。
- style definitions。
- swatches。
- placed assets。
- graphic frame 与 placed content transform。
- text runs 和字符样式范围。
- object fitting。
- z-order。

正向生成的 InDesign 对象应写入可追踪 label，例如：

```text
html-indesign:id=title-1;role=text;style=page-title
```

这样后续可以稳定地从 InDesign 导回 HTML。

## 13. API 设计

库应暴露纯 Node API，CLI 只是薄封装。

建议 API：

```js
const { renderSnapshot, compileStyles, compileInstructions } = require('html-indesign');

const snapshot = await renderSnapshot({
  htmlPath: 'deck.html',
  pageSelector: '[data-page], .page',
  mode: 'editable-first'
});

const instructions = compileInstructions(snapshot, {
  assetRoot: 'assets',
  styleNaming: 'class-first'
});
```

CLI：

```bash
html-indesign snapshot deck.html --out test/workspace/snapshot.json
html-indesign compile deck.html --out test/workspace/instructions.json
html-indesign build test/workspace/instructions.json
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

少量高价值样例通过 `cli-anything-indesign` 执行：

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
| `src/generator.js` | 反向/参考 HTML 生成能力的来源，可拆分为 style export 和 reference writer |
| `src/spec-generator.js` | Agent 可读规范生成器，后续从 style model 生成 |
| `src/validator.js` | 迁移为 snapshot/instructions validator |
| `src/builder.js` | 迁移为 snapshot -> instructions compiler |
| `_indesign_scripts/build_from_instructions.jsx` | 保留为 InDesign executor，减少业务逻辑 |
| `test/artifacts/*.json` | 继续作为真实 InDesign 样式和模板样本 |
| `test/reference/` | 继续作为旧模板和反向生成参考样本 |

第一阶段实现保留现有 legacy template 文件的位置，并通过 `src/legacy-template/*` wrappers 对外暴露。新的浏览器驱动转换代码放在 `src/paged-html/*` 下，可复用工具放在 `src/shared/*` 下。这样既保留当前模板驱动工作流，又把 paged HTML 工作流作为独立路径引入。

新模块建议：

```text
src/
  browser-snapshot.js
  style-compiler.js
  element-compiler.js
  instructions-validator.js
  asset-resolver.js
  placed-asset-compiler.js
  report.js
  types/
    snapshot.ts
    styles.ts
    assets.ts
    instructions.ts
```

## 17. 非目标

第一阶段明确不做：

- 任意长网页自动分页。
- 自动模板选择。
- 自动母版推理。
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
