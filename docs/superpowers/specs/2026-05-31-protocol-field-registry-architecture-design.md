# 协议字段注册表与多格式转换架构设计

## 1. 背景

项目已经从单向 HTML 到 InDesign 转换，发展为固定分页文档的双向转换库。

当前主线是：

```text
HTML <-> Semantic Model <-> InDesign
```

后续可能扩展为：

```text
HTML <-> Semantic Model <-> InDesign
PPTX <-> Semantic Model <-> HTML
PPTX <-> Semantic Model <-> InDesign
```

因此新的架构不能只服务 InDesign。它必须把 HTML、InDesign、PPTX 都视为格式适配器，把统一语义模型作为中心事实源。

当前风险：

- 新增字段容易分散在 `browser-snapshot`、`reverse-model`、`html-writer`、`to-instructions`、ExtendScript 中。
- 字段名、单位、读写方向和弃用状态主要靠文档约定，缺少机器门禁。
- HTML、InDesign、PPTX 对同一能力的表达不同，如果没有能力矩阵，后续会出现各格式各写一套映射。
- 反向导出已经开始处理 PDF 页码、置入裁切、矢量路径、混合模式、母版对象、资源原位引用等复杂字段，继续靠局部补丁会失控。

本 spec 的目标是定义一套可扩展架构，让转换字段集中登记、集中验证、分层实现，避免各写各的。

## 2. 目标

### 2.1 架构目标

建立多格式转换架构：

```text
Format Adapter
  HTML Adapter
  InDesign Adapter
  PPTX Adapter
    |
    v
Canonical Semantic Model
    |
    v
Format Writer
  HTML Writer
  InDesign Instruction Writer
  PPTX Writer
```

核心原则：

- 语义模型是事实源。
- HTML、InDesign、PPTX 都是输入输出适配器。
- 新字段必须先进入协议字段注册表。
- 格式差异通过能力矩阵表达，不通过随机字段名表达。
- 不为未来 PPTX 牺牲当前 HTML/InDesign 质量，但当前设计不能堵死 PPTX。

### 2.2 字段治理目标

新增任何转换字段，都必须回答：

- 字段路径是什么。
- 字段类型是什么。
- 单位是什么。
- 是否属于通用语义字段。
- HTML 如何读取和写出。
- InDesign 如何读取和写出。
- PPTX 是否支持，支持到什么程度。
- 是否写入 `html_indesign` 标签。
- 不支持时是报错、警告、观察信息，还是 fallback。
- 是否已有旧字段需要退役。

字段不能只因为某个模块临时需要，就直接进入模型。

## 3. 非目标

本 spec 不要求立即实现 PPTX 转换。

本 spec 不要求一次性重写现有所有转换链路。

本 spec 不把 Semantic Model 改成抽象到失去建筑汇报特征的通用文档模型。建筑汇报仍然是当前核心场景，PDF、AI、PSD、图纸、矢量标注、母版、网格和资源原位引用仍是一等需求。

本 spec 不接受把字段注册表做成纯文档。字段注册表必须最终成为代码级约束。

## 4. 总体架构

### 4.1 分层

```text
src/protocol/
  field-registry
  capability-matrix
  field-lifecycle
  validators

src/semantic-model/
  canonical model
  model validator
  source metadata

src/adapters/html/
  browser snapshot
  HTML source metadata
  CSS extraction
  resource extraction

src/adapters/indesign/
  html_indesign label reader/writer
  reverse snapshot normalizer
  instruction writer

src/adapters/pptx/
  future PPTX reader/writer
  slide master/layout mapping

src/writers/html/
  author package writer
  visual HTML writer
  presentation preview writer

_indesign_scripts/
  executor only
  no semantic inference
```

当前代码可以逐步迁移到这些边界，不要求一次性移动目录。

### 4.2 数据流

HTML 到 InDesign：

```text
HTML
-> HTML Raw Snapshot
-> HTML Normalizer
-> Semantic Model
-> InDesign Instruction Writer
-> InDesign Executor
-> INDD
```

InDesign 到 HTML：

```text
INDD
-> InDesign Reverse Snapshot
-> InDesign Normalizer
-> Semantic Model
-> HTML Author Package Writer
-> deck.html / presentation.html
```

未来 PPTX 到 HTML：

```text
PPTX
-> PPTX Raw Snapshot
-> PPTX Normalizer
-> Semantic Model
-> HTML Author Package Writer
```

未来 InDesign 到 PPTX：

```text
INDD
-> InDesign Reverse Snapshot
-> Semantic Model
-> PPTX Writer
```

## 5. 统一语义模型

### 5.1 模型定位

统一语义模型保存跨格式共享事实。

它不是：

- 浏览器 DOM。
- InDesign instructions。
- PPTX XML。
- 旧 blueprint。
- 某个作者包的源码树。

它可以包含 source metadata，但 source metadata 只是来源信息，不是视觉兜底补丁。

### 5.2 字段分类

字段分三类。

| 类别 | 含义 | 示例 |
| ---- | ---- | ---- |
| canonical | 多格式共享字段 | `page.size`、`item.bounds`、`asset.path`、`visualStyle.blendMode` |
| source metadata | 来源结构信息 | `sourceNode`、`sourceFile`、`structure.parentId` |
| format extension | 某格式独有能力 | `pptx.animation`、`indesign.scriptLabelRaw` |

规则：

- canonical 字段必须进入字段注册表。
- source metadata 必须明确只服务回环和源码恢复，不能替代 canonical 字段。
- format extension 必须带格式命名空间，不能伪装成通用字段。

示例：

```json
{
  "item": {
    "bounds": { "x": 0, "y": 0, "width": 100, "height": 80 },
    "visualStyle": {
      "fillColor": "#ffcc00",
      "blendMode": "multiply"
    },
    "sourceNode": {
      "tagName": "svg",
      "classList": ["analysis-zone"]
    },
    "extensions": {
      "pptx": {
        "animation": null
      }
    }
  }
}
```

## 6. 协议字段注册表

### 6.1 定位

字段注册表是所有转换字段的机器可读目录。

它必须能被这些模块读取：

- HTML snapshot normalizer。
- InDesign reverse normalizer。
- HTML writer。
- InDesign instruction writer。
- 标签读写器。
- 测试门禁。
- 文档生成器。

### 6.2 字段定义

字段定义至少包含：

```js
{
  path: 'items[].visualStyle.blendMode',
  owner: 'effects',
  status: 'active',
  kind: 'canonical',
  type: 'enum',
  values: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'],
  unit: null,
  defaultValue: 'normal',
  label: {
    persist: true,
    key: 'blendMode'
  },
  html: {
    read: ['computedStyle.mixBlendMode'],
    write: ['style.mix-blend-mode'],
    support: 'native'
  },
  indesign: {
    read: ['pageItem.transparencySettings.blendingSettings.blendMode'],
    write: ['pageItem.transparencySettings.blendingSettings.blendMode'],
    support: 'native'
  },
  pptx: {
    read: [],
    write: [],
    support: 'unsupported',
    fallback: 'rasterize-or-warn'
  },
  validation: {
    unknownValue: 'warn',
    missing: 'omit'
  }
}
```

### 6.3 字段路径规则

字段路径必须稳定。

推荐根域：

| 根域 | 用途 |
| ---- | ---- |
| `document.*` | 文档级元数据 |
| `parentPages[].*` | 母版页 / 跨页重复模板 |
| `pages[].*` | 页面字段 |
| `layers[].*` | 图层字段 |
| `styles.*` | 样式资源 |
| `assets[].*` | 外部资源 |
| `items[].*` | 页面对象 |
| `items[].textStyle.*` | 实际文字样式 |
| `items[].textFrameStyle.*` | 文本框样式 |
| `items[].frameStyle.*` | 图框和置入框样式 |
| `items[].visualStyle.*` | 填充、描边、透明度、混合模式等视觉样式 |
| `items[].vectorGeometry.*` | 路径点、箭头、线型 |
| `items[].asset.placement.*` | 置入页码、裁切、偏移、缩放、图层显隐 |
| `items[].sourceNode.*` | 作者源码节点 |
| `items[].extensions.<format>.*` | 格式独有字段 |

禁止：

- 在不同模块发明同义路径。
- 用 `legacy` 命名承载当前字段。
- 把已退役字段继续写入 canonical 模型。
- 用格式专有前缀污染通用字段，例如 `indesignPdfPage`。

## 7. 格式能力矩阵

字段注册表必须声明每个字段在各格式中的能力。

能力等级：

| 等级 | 含义 |
| ---- | ---- |
| `native` | 格式原生支持 |
| `lossless` | 可无损表达，但不是该格式内建高级对象 |
| `approximate` | 可近似表达 |
| `fallback` | 需要栅格化、拆分对象或生成派生资源 |
| `observe-only` | 只能读取为观察信息，不能结构化写回 |
| `unsupported` | 不支持，必须报错或明确警告 |

示例矩阵：

| 字段 | HTML | InDesign | PPTX |
| ---- | ---- | -------- | ---- |
| `pages[].size` | native | native | native |
| `pages[].grid` | native CSS / data-id | native guides | approximate |
| `parentPages[]` | source template | native parent page | slide master/layout |
| `items[].bounds` | native | native | native |
| `styles.paragraphStyles` | CSS class | native style | approximate/native text style |
| `items[].asset.placement.pdfPage` | data-id + preview | native placed PDF page | fallback image |
| `items[].asset.placement.visibleLayers` | metadata + preview | native PDF/AI layer visibility when available | fallback image |
| `items[].visualStyle.blendMode` | native CSS | native transparency setting | unsupported or raster fallback |
| `items[].vectorGeometry.paths` | SVG | native path | freeform shape approximate |
| `items[].vectorGeometry.markers` | SVG marker | native line arrowhead | native line arrowhead approximate |
| `items[].table` | HTML table | native table | native table |
| `items[].chart` | SVG/canvas/resource | placed or vector approximation | native chart possible |
| `items[].extensions.pptx.animation` | unsupported | unsupported | native |

PPTX 加入后，不能要求所有字段都无损。矩阵必须明确哪些字段可无损、哪些字段只能视觉 fallback。

## 8. HTML、InDesign、PPTX 的职责边界

### 8.1 HTML Adapter

负责：

- 读取分页 HTML。
- 使用浏览器获得布局真相。
- 读取 `data-id-*`。
- 读取 CSS 计算样式和作者样式。
- 读取资源路径和预览资源。
- 读取作者源码包元数据。

不负责：

- 推断复杂建筑语义。
- 生成 InDesign 专有字段。
- 为方便转换改写作者 HTML。

### 8.2 InDesign Adapter

负责：

- 读取和写入 `html_indesign` 标签。
- 读取页面、母版、图层、样式、对象、资源、路径、表格。
- 把 InDesign 对象归一化为 Semantic Model。
- 从 Semantic Model 生成 instructions。

不负责：

- 解析 HTML。
- 解析 CSS cascade。
- 推断 Agent 写作意图。
- 在 ExtendScript 里做复杂语义迁移。

### 8.3 PPTX Adapter

未来负责：

- 读取 slide、slide master、layout、shape、text box、table、chart、media。
- 把 PPTX 坐标归一化到 Semantic Model。
- 从 Semantic Model 写出 PPTX slide。

PPTX 特有能力：

- 动画。
- 幻灯片切换。
- 原生图表。
- 演示备注。
- 幻灯片母版和版式。

这些能力进入 `extensions.pptx.*`，除非能证明它们应升级为 canonical 字段。

### 8.4 Writers

HTML Writer 负责输出：

- 作者源码包。
- 视觉 HTML。
- reveal.js 等演示预览外壳。

InDesign Writer 负责输出：

- instructions。
- 标签。
- 原生样式、图层、页面对象。

PPTX Writer 未来负责输出：

- PPTX package。
- slide masters。
- slide layouts。
- shapes、tables、charts、media。

Writer 不能发明未登记字段。

## 9. 字段生命周期

### 9.1 新增字段

新增字段流程：

1. 在字段注册表登记。
2. 明确字段 owner。
3. 明确 HTML / InDesign / PPTX 能力等级。
4. 增加模型校验。
5. 增加至少一个方向的读写测试。
6. 如果是双向字段，增加回环测试。
7. 更新规范文档或生成文档。

没有注册表条目的字段，不得进入 canonical model。

### 9.2 观察字段

观察字段用于承接混乱标签、未知样式、外部模板残留、旧字段和无法确定语义的信息。

规则：

- 观察字段不得驱动结构化编译。
- 观察字段必须能在报告中看到来源和降级原因。
- 局部合规字段可以提升为 canonical。
- 不合规字段只能留在 observation 或 report。

### 9.3 退役字段

退役字段必须登记：

```js
{
  path: 'items[].asset.placement.page',
  status: 'retired',
  replacedBy: 'items[].asset.placement.pdfPage',
  readPolicy: 'observe-only',
  writePolicy: 'forbidden'
}
```

退役规则：

- 不得继续写入 canonical model。
- 不得继续作为读取兜底。
- 不得进入 instructions。
- 不得出现在新样例里。
- 如果仍需要识别，只能进入 observation report。

这条规则与 `AGENTS.md` 中“退役代码必须当场清除”一致。

### 9.4 格式专有字段升级

格式专有字段可以升级为 canonical，但必须满足：

- 至少两个格式可以稳定表达，或它对通用文档语义确实必要。
- 有清晰字段名，不绑定某个格式术语。
- 有降级策略。
- 有测试覆盖。

例如：

- `pptx.animation` 暂时不应升级。
- `chart` 可能升级，因为 HTML、PPTX、InDesign 都可能通过不同方式表达图表。

## 10. 字段域设计

### 10.1 文档和页面

字段：

- `document.id`
- `document.title`
- `document.profile`
- `document.unitMode`
- `document.coordinateUnit`
- `document.colorIntent`
- `pages[].id`
- `pages[].index`
- `pages[].size`
- `pages[].margins`
- `pages[].grid`
- `pages[].parentPageRef`
- `pages[].layout`

PPTX 映射：

- `pages[]` 对应 slides。
- `parentPages[]` 对应 slide masters 或 layouts。
- `pages[].layout` 对应 slide layout token。

### 10.2 样式

字段：

- `styles.swatches`
- `styles.fonts`
- `styles.compositeFonts`
- `styles.paragraphStyles`
- `styles.characterStyles`
- `styles.objectStyles`
- `styles.frameStyles`
- `styles.tableStyles`
- `styles.cellStyles`

规则：

- token 与 displayName 分离。
- 中文面板名只作为 displayName。
- Agent 写 HTML 时使用 token。
- 项目语义库负责 token 到 displayName 的映射。

PPTX 映射：

- paragraph/character styles 可以映射为 text run properties。
- object/frame styles 可能只能内联或近似。
- table/cell styles 可映射为 PPTX table 样式和单元格属性。

### 10.3 资源和置入

字段：

- `assets[].path`
- `assets[].kind`
- `assets[].status`
- `assets[].preview`
- `items[].asset.placement.fit`
- `items[].asset.placement.crop`
- `items[].asset.placement.pdfPage`
- `items[].asset.placement.artboard`
- `items[].asset.placement.visibleLayers`
- `items[].asset.placement.hiddenLayers`
- `items[].asset.placement.contentOffset`
- `items[].asset.placement.contentSize`
- `items[].asset.placement.contentScale`

规则：

- UNC 原位引用是默认策略。
- 派生预览图必须保留原始来源路径。
- PDF 页码必须使用明确字段，不得从旧 `data-id-page` 兜底。
- AI、PSD、PDF 的图层显隐必须作为 placement metadata。

PPTX 映射：

- 图片可原生嵌入或链接，策略另定。
- PDF、AI、PSD 通常需要预览图 fallback。
- fallback 必须保留原位源文件路径和生成预览路径。

### 10.4 文本

字段：

- `items[].content.text`
- `items[].content.runs`
- `items[].textStyle`
- `items[].textFrameStyle`
- `styles.paragraphStyles`
- `styles.characterStyles`

需要覆盖：

- 字体。
- 复合字体。
- 字号。
- 行距。
- 字距。
- 对齐。
- 列表。
- 编号。
- 首字下沉。
- GREP / 嵌套样式的可表达降级。
- 溢出状态。

PPTX 映射：

- 文本框、段落、run 基本可表达。
- GREP / 嵌套样式通常不可原生表达，需要展开到 runs。

### 10.5 矢量和效果

字段：

- `items[].vectorGeometry.kind`
- `items[].vectorGeometry.paths`
- `items[].vectorGeometry.markers`
- `items[].visualStyle.fillColor`
- `items[].visualStyle.fillOpacity`
- `items[].visualStyle.strokeColor`
- `items[].visualStyle.strokeWeight`
- `items[].visualStyle.strokeOpacity`
- `items[].visualStyle.strokeStyle`
- `items[].visualStyle.strokeLineCap`
- `items[].visualStyle.strokeLineJoin`
- `items[].visualStyle.opacity`
- `items[].visualStyle.blendMode`
- `items[].visualStyle.effects`

规则：

- 透明度和混合模式必须分开。
- 正片叠底不是透明度，必须映射为 `blendMode: "multiply"`。
- 线端箭头必须是路径描边字段，不得退化成矩形。
- 未能恢复路径时，可以降级为矩形，但必须报告。

PPTX 映射：

- 基础路径和线条可近似。
- 复杂贝塞尔、复合路径和混合模式可能需要 fallback。

### 10.6 图表

图表是未来扩展点。

建议字段：

- `items[].chart.kind`
- `items[].chart.data`
- `items[].chart.series`
- `items[].chart.axes`
- `items[].chart.style`
- `items[].chart.sourceAsset`

能力矩阵：

| 格式 | 策略 |
| ---- | ---- |
| HTML | SVG、canvas、DOM 表格驱动 |
| InDesign | 置入图表图片、SVG、AI，或拆成矢量近似 |
| PPTX | 原生 chart 优先 |

图表字段不在本轮实现，但字段注册表必须允许新增该域。

## 11. 标签协议关系

`html_indesign` 标签只持久化协议事实。

规则：

- 标签字段必须来自字段注册表。
- 标签可以保存 canonical 字段。
- 标签可以保存 source metadata。
- 未登记字段不得写入有效标签。
- 旧标签可以读入 observation，但不能直接成为事实。

HTML `data-id-*` 与 InDesign `html_indesign` 的关系：

```text
data-id-* -> Semantic Model -> html_indesign
html_indesign -> Semantic Model -> data-id-*
```

PPTX 加入后，应有等价的 PPTX 自定义属性或附加数据机制：

```text
PPTX custom data -> Semantic Model -> data-id-*
Semantic Model -> PPTX custom data
```

具体机制可以后置，但当前字段设计不能假设只有 InDesign 有标签。

## 12. 测试和门禁

### 12.1 字段注册门禁

新增静态测试：

- 扫描代码中出现的 canonical 字段路径。
- 扫描 `data-id-*` 字段名。
- 扫描 `html_indesign` 标签字段。
- 扫描 instructions 中来自模型的字段。
- 未登记字段报错。

### 12.2 方向测试

每个 active 字段至少有一个方向测试。

重要字段必须有双向测试：

```text
HTML -> Semantic Model -> InDesign -> Semantic Model -> HTML
```

或：

```text
InDesign -> Semantic Model -> HTML -> Semantic Model
```

### 12.3 能力矩阵测试

能力矩阵必须可测试：

- `native` 字段必须证明可读或可写。
- `fallback` 字段必须报告 fallback reason。
- `unsupported` 字段不得静默丢弃。
- `observe-only` 字段不得进入结构化编译。

### 12.4 文档一致性

长期目标：

- 字段文档从注册表生成。
- 规范文档只解释原则和边界。
- 字段列表不再手写多份。

## 13. 迁移策略

采用渐进迁移，不一次性推翻现有链路。

### 阶段 1：建立注册表骨架

范围：

- 新建字段注册表。
- 先登记当前最关键字段域。
- 增加静态测试，初期只警告。

优先字段：

- `page.grid`
- `page.margins`
- `item.bounds`
- `styleRefs`
- `visualStyle`
- `asset.placement`
- `vectorGeometry`
- `sourceNode`
- `structure`

### 阶段 2：接入校验

范围：

- HTML normalizer 使用注册表校验输出模型。
- InDesign reverse normalizer 使用注册表校验输出模型。
- HTML writer 和 instruction writer 禁止写未知字段。

### 阶段 3：拆分大模块

按字段域拆分：

- `text-style-mapping`
- `object-style-mapping`
- `asset-placement-mapping`
- `vector-geometry-mapping`
- `effects-mapping`
- `source-structure-mapping`

拆分必须以测试保持行为不变为前提。

### 阶段 4：退役字段清理

把当前已确定退役的字段集中登记并清理。

原则：

- 退役字段只允许 observation。
- 不允许兜底读取。
- 不允许新写出。

### 阶段 5：PPTX 预留适配器

只建立接口和能力矩阵，不实现完整 PPTX。

需要定义：

- `PptxAdapter` 输入输出边界。
- slide / master / layout 到 `pages` / `parentPages` / `layout` 的映射。
- PPTX custom data 的标签持久化策略。
- PDF/AI/PSD fallback 策略。

## 14. 文件和模块建议

建议新增：

```text
src/protocol/
  index.js
  field-registry.js
  field-paths.js
  capability-matrix.js
  lifecycle.js
  validate-model-fields.js
  validate-data-id-fields.js

src/protocol/fields/
  document-fields.js
  page-fields.js
  style-fields.js
  text-fields.js
  asset-fields.js
  vector-fields.js
  effect-fields.js
  source-fields.js
  pptx-extension-fields.js
```

未来可新增：

```text
src/adapters/pptx/
  read-pptx.js
  write-pptx.js
  pptx-labels.js
  pptx-capabilities.js
```

现有模块不要求立即搬家，但新增能力必须优先靠近对应字段域，避免继续扩大单文件。

## 15. 判断标准

本架构是否成功，用以下标准判断：

- 新增字段时，不需要同时猜多个模块该怎么写。
- 字段是否支持 HTML、InDesign、PPTX，一眼能从能力矩阵看出。
- 旧字段不能无声继续生效。
- 反向导出不会因为未知标签误判成结构化事实。
- HTML 作者包、InDesign 标签、未来 PPTX 标签都能共享同一套 token 和字段规则。
- 大文件增长得到控制。
- 真实项目新增复杂能力时，不需要绕过协议层。

## 16. 开放问题

以下问题不在本 spec 中强行决定，但实施计划需要逐步回答：

- PPTX 是作为本项目内置 adapter，还是作为 `indesign-cli` / 未来统一 CLI 的插件能力。
- PPTX 资源策略是默认嵌入、链接，还是根据内部发布平台选择。
- 图表是否在近期升级为 canonical 字段。
- 字段注册表是否需要生成 JSON Schema。
- 标签协议是否升级版本到 v2，还是在 v1 内加入字段白名单校验。

## 17. 推荐结论

推荐采用“统一语义模型 + 协议字段注册表 + 格式能力矩阵”的架构。

当前实现仍然以 HTML/InDesign 为主，但字段设计从今天开始按多格式适配器约束。

PPTX 不需要现在实现，但必须作为能力矩阵中的目标格式存在。这样未来加入 PPTX 时，是新增 adapter 和 writer，而不是重写 HTML/InDesign 链路。
