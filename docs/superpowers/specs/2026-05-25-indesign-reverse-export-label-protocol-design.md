# InDesign 反向导出与标签协议设计

## 1. 目标

本设计定义下一阶段 `InDesign -> HTML` 反向导出方向，并把当前讨论收敛为一个原则：

```text
标签是稳定协议，模板是标签载体。
```

项目长期目标仍是：

```text
固定语义 HTML <-> InDesign Document
```

反向导出的第一阶段目标不是任意 InDesign 文件无损还原，而是建立一个可验证的双向闭环：

```text
带标签 InDesign
-> Reverse Snapshot
-> Canonical Semantic Model
-> 固定语义 HTML
-> HTML-to-InDesign
-> 带标签 InDesign
```

未标注 InDesign 文件也可以导出，但第一步只能生成“低语义观察 HTML”，供人或 Agent 观察后补标签，再导回结构化 InDesign。

## 2. 当前仓库已有能力

仓库里已经存在一条旧的 InDesign 导出链路，但它不是新的完整反向导出。

### 2.1 `extract_blueprint.jsx`

文件：`_indesign_scripts/extract_blueprint.jsx`

当前作用：

- 从当前打开的 InDesign 文档抽取：
  - 复合字体。
  - 字符样式。
  - 段落样式。
  - 对象样式。
  - 母版页。
  - 母版页中的带 `label` 对象作为槽位。
  - 母版页中的无 `label` 对象作为静态对象。
- 对象支持的主要类型：
  - 文本框。
  - 图片框。
  - 矩形、椭圆、多边形。
  - 线。
- 抽取字段包括：
  - `bounds`
  - `zIndex`
  - `content`
  - `appliedParagraphStyle`
  - `appliedObjectStyle`
  - `imagePath`
  - `imageCropped`
  - `inlineCSS`
- 对段落样式已有一些高级抽取：
  - 项目符号和编号。
  - 首字下沉。
  - GREP 样式。
  - 嵌套样式。
  - 文字框内边距。
  - 多栏文字框。

当前限制：

- 主要抽取母版页和样式，不是抽取完整内容页。
- 槽位语义依赖 InDesign 对象的 `label` 字符串。
- 输出是 `blueprint.json`，服务旧模板工作流。
- 不输出新的 `data-id-*` 语义协议。
- 不建立可回写的对象身份、关系、分组、网格、页面语义模型。

### 2.2 `generator.js`

文件：`src/generator.js`

当前作用：

- 把 `blueprint.json` 转成模板预览 HTML。
- 为每个母版生成一个 HTML 文件。
- 输出 `index.html` 和 `all-templates.html`。
- 把母版槽位渲染成带 `data-slot` 的可视化框。
- 把段落样式、对象样式转换成 CSS class。
- 在 HTML 注释中生成 Agent 编写约束。

当前限制：

- 生成的是模板参考页，不是内容文档反向导出。
- HTML 协议是旧的 `data-master` / `data-slot` / `data-type` / `data-bounds`。
- 不输出当前 `paged-html` 主线使用的 `data-id-*` 标签协议。
- 不支持从普通内容页恢复结构化 HTML。

### 2.3 `builder.js` 和 `validator.js`

文件：

- `src/builder.js`
- `src/validator.js`
- `src/legacy-template/*`

当前作用：

- 消费旧 HTML 模板协议。
- 校验 `data-master`、`data-slot`、自由页 `data-type`、`data-bounds`。
- 生成旧版 build instructions。

当前限制：

- 属于 legacy template 兼容层。
- 当前新的 `paged-html` 主线已经使用浏览器快照和新 instructions。
- 不能作为反向导出的目标协议。

### 2.4 当前新执行器已有标签雏形

文件：

- `_indesign_scripts/lib/hi_core.jsxinc`
- `_indesign_scripts/lib/hi_items.jsxinc`
- `_indesign_scripts/lib/hi_document.jsxinc`

已有行为：

- `HI.itemLabel(item)` 会给新建对象写入紧凑字符串：

```text
html-indesign:id=<id>;role=<role>;type=<type>
```

- `HI.insertJsonLabel(target, key, value)` 已存在。
- 参考线已经写入 `html_indesign_guide` JSON 标签。
- 构建报告写入文档标签 `build_last_result`。

这说明新主线已经具备写脚本标签的基础，但还没有形成完整、稳定、可反向读取的标签协议。

## 3. 核心判断

### 3.1 标签是协议

双向转换的稳定边界不是模板名，也不是页面长相，而是对象上的语义标签。

HTML 侧标签是：

```html
data-page
data-id-semantic
data-id-role
data-id-paragraph-style
data-id-character-style
data-id-object-style
data-id-frame-style
data-id-layer
data-id-grid
```

约定：`data-page` 是页面容器标记；`data-id-*` 用于语义、样式、网格和资源参数。PDF 置入页码只使用 `data-id-pdf-page`；旧 `data-id-page` 只能作为退役或观察信息记录，不得作为有效读取字段。

InDesign 侧标签应是脚本标签：

```js
target.insertLabel("html_indesign", JSON.stringify({...}))
```

反向导出时优先读取脚本标签，而不是猜测对象语义。

### 3.2 模板是标签载体

模板的主要价值不是固定信息本身，而是批量预设标签。

InDesign 模板的价值：

- 预设母版页标签。
- 预设页面槽位标签。
- 预设对象标签。
- 预设样式标签。
- 预设图层标签。
- 降低人类用户手动写标签的成本。

HTML 模板的价值：

- 预设 `data-id-*`。
- 预设 CSS 网格、区域和组件。
- 预设 Agent 编写约束。
- 降低 Agent 写错标签和布局规则的概率。

因此：

```text
模板可以缺席，标签不能缺席。
```

没有模板但有标签的 InDesign 可以结构化反向导出。

有模板但没有标签的 InDesign 只能低语义导出。

### 3.3 未标注文件可以被语义化重建

缺乏语义标签的 InDesign 不能直接变成高质量语义 HTML，但可以进入迁移流程：

```text
未标注 InDesign
-> 低语义观察 HTML
-> Agent 观察页面视觉和对象结构
-> Agent 补 data-id 语义标签
-> HTML-to-InDesign
-> 带脚本标签的结构化 InDesign
```

这个流程不是无损转换，而是“语义化重建”。

## 4. 来源等级

反向导出必须区分来源等级。

| 来源 | 输入特征 | 反向质量 | 处理策略 |
| ---- | -------- | -------- | -------- |
| 本项目生成的 InDesign | 有完整 `html_indesign` 标签 | 最高 | 必须完整读回 |
| 人工 InDesign，按协议打标签 | 有规范脚本标签 | 高 | 正式支持 |
| 人工 InDesign，只使用模板但无标签 | 有母版和样式，语义不完整 | 中 | 输出低语义 HTML 和模板线索 |
| 普通未标注 InDesign | 只有视觉对象 | 低 | 输出观察 HTML，等待 Agent 语义化 |
| 旧 blueprint 模板 | 由 `extract_blueprint.jsx` 抽出 | 兼容 | 保留 legacy-template 路径 |

## 5. 标签协议

### 5.1 统一标签键

新协议使用统一脚本标签键：

```text
html_indesign
```

值为 JSON 字符串。

旧键继续兼容：

| 旧键或旧字段 | 用途 | 新处理 |
| ------------ | ---- | ------ |
| `pageItem.label` 中的 `html-indesign:id=...` | 当前对象调试标签 | 作为兼容兜底读取 |
| `html_indesign_guide` | 当前参考线标签 | 继续读取，后续可迁移到统一键 |
| `build_last_result` | 构建报告 | 保持报告用途，不作为语义协议 |
| 母版对象 `label` | 旧 blueprint 槽位 | 兼容为 `legacySlotLabel` |

### 5.2 标签通用字段

所有 `html_indesign` 标签都应包含：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "page-1-title",
  "source": "html-to-indesign"
}
```

字段说明：

| 字段 | 含义 |
| ---- | ---- |
| `protocol` | 固定为 `html-indesign` |
| `version` | 标签协议版本 |
| `kind` | `document`、`page`、`parentPage`、`item`、`style`、`layer`、`guide` |
| `id` | 稳定对象 ID |
| `source` | `html-to-indesign`、`manual-tagged`、`legacy-blueprint`、`agent-semanticized` |

`id`、`token` 和 `*Token` 字段是协议稳定值；`name`、`displayName` 和 `*Name` 字段是 InDesign 面板显示名。几何裸数字默认使用文档标签中的 `coordinateUnit`。

### 5.3 文档标签

目标对象：`Document`

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "document",
  "id": "architecture-report",
  "title": "建筑汇报",
  "profile": "architecture-report",
  "unitMode": "presentation",
  "coordinateUnit": "pt",
  "assetRoot": "assets",
  "createdBy": "html-indesign"
}
```

用途：

- 确认文档是否属于本协议。
- 记录单位模式。
- 记录资源根目录。
- 记录语义配置。

### 5.4 页面标签

目标对象：`Page`

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "page",
  "id": "agenda-page",
  "semantic": "agenda",
  "htmlTag": "section",
  "className": "page",
  "parentPageId": "report-parent",
  "parentPageName": "汇报母版",
  "layout": "contents-grid",
  "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 },
  "grid": {
    "columns": 12,
    "rows": 8,
    "columnGutter": 6,
    "rowGutter": 5,
    "baseline": 4
  }
}
```

用途：

- 反向生成 `<section class="page">`。
- 恢复页边距。
- 恢复主网格。
- 恢复母版引用。

### 5.5 母版页标签

目标对象：`MasterSpread` 或母版页中的对象。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "parentPage",
  "id": "report-parent",
  "name": "汇报母版",
  "semantic": "report-parent",
  "provides": ["folio", "header-line", "chapter-marker"]
}
```

母版对象标签：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "parent-folio",
  "role": "text",
  "semantic": "folio",
  "scope": "parentPage",
  "htmlTag": "span",
  "className": "page-number"
}
```

用途：

- 反向导出模板定义。
- 识别页码、页眉、页脚和重复装饰。
- 避免把母版对象误当成每页重复内容。

### 5.6 样式标签

目标对象：

- 段落样式。
- 字符样式。
- 对象样式。
- 表格样式。
- 单元格样式。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "style",
  "id": "style-paragraph-page-title",
  "styleKind": "paragraph",
  "token": "page-title",
  "displayName": "页面标题",
  "htmlClass": "page-title"
}
```

用途：

- 避免反向导出时每个 Agent 重新维护语义映射表。
- 从 InDesign 中文样式名恢复稳定 token。
- 从稳定 token 恢复 HTML class 和 `data-id-*`。

### 5.7 对象标签

目标对象：页面对象。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "agenda-title",
  "role": "text",
  "semantic": "page-title",
  "htmlTag": "h2",
  "className": "page-title grid-item",
  "layerToken": "text",
  "layerName": "文字",
  "styleRefs": {
    "paragraphStyleToken": "page-title",
    "paragraphStyleName": "页面标题",
    "objectStyleToken": null,
    "objectStyleName": null,
    "frameStyleToken": null,
    "frameStyleName": null
  },
  "grid": {
    "col": 1,
    "span": 4,
    "row": 2,
    "rowSpan": 1
  }
}
```

不同角色扩展字段：

文本：

```json
{
  "role": "text",
  "text": {
    "preserveRuns": true,
    "runs": true
  }
}
```

图框：

```json
{
  "role": "graphic",
  "asset": {
    "kind": "pdf",
    "relativePath": "drawings/floor-01.pdf",
    "pageNumber": 1,
    "crop": "trim",
    "fit": "contain"
  }
}
```

表格：

```json
{
  "role": "table",
  "table": {
    "headerRows": 1,
    "source": "native-table"
  }
}
```

组：

```json
{
  "role": "group",
  "semantic": "case-card",
  "children": ["case-title", "case-image", "case-caption"]
}
```

## 6. 反向导出模式

### 6.1 `structured`

结构化模式。

要求：

- 文档、页面、核心对象有 `html_indesign` 标签。
- 缺少关键标签时报告 error。
- 不通过视觉猜测补语义。

用途：

- 本项目生成的 InDesign 回读。
- 人工按协议打标签的 InDesign 回读。

输出：

- 固定语义 HTML。
- `reverse-model.json`。
- 资源目录。
- 诊断报告。

### 6.2 `observation`

观察模式。

要求：

- 不要求标签。
- 尽量保留视觉、坐标、图层、样式和资源。
- 所有未识别语义都标记为 unknown。

用途：

- 旧 InDesign 项目迁移。
- Agent 观察和语义化。

输出示例：

```html
<section class="page observed-page"
         data-page="observed-page-1"
         data-id-observed="true"
         data-id-margin="unknown"
         data-id-grid="unknown">
  <div class="observed-text"
       data-id-role="text"
       data-id-semantic="unknown"
       data-id-observed-id="page-1-item-12"
       style="left:20mm;top:30mm;width:100mm;height:20mm">
    项目标题
  </div>
</section>
```

Agent 语义化后应改成：

```html
<h1 class="cover-title grid-item"
    data-id-role="text"
    data-id-semantic="cover-title"
    data-id-paragraph-style="封面标题">
  项目标题
</h1>
```

### 6.3 `blueprint-legacy`

兼容模式。

继续使用：

```text
extract_blueprint.jsx -> blueprint.json -> generator.js -> template preview HTML
```

用途：

- 查看旧模板。
- 迁移旧模板槽位。
- 与历史测试资产保持兼容。

限制：

- 不作为新的双向转换主线。
- 不保证生成当前 `paged-html` 协议。

## 7. 反向导出产物

反向导出不应只输出一个 HTML 文件。建议输出一个目录：

```text
reverse-export-<timestamp>/
  deck.html
  reverse-model.json
  report.json
  assets/
    ...
```

### 7.1 `deck.html`

人类和 Agent 主要编辑入口。

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

### 7.2 `reverse-model.json`

完整中间模型。`reverse-model.json` 是统一语义模型的序列化结果，可以附加 snapshot、unresolved 和诊断信息，但不能成为独立于语义模型的第三套结构。

用途：

- 保留 HTML 不方便表达的 InDesign 信息。
- 辅助 round-trip 验证。
- 支持后续工具做差异比较。

核心结构：

```json
{
  "metadata": {
    "sourceDocument": "report.indd",
    "exportedAt": "2026-05-25T00:00:00Z",
    "mode": "structured",
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

### 7.3 `report.json`

诊断报告。

必须记录：

- 标签缺失。
- 标签 JSON 无效。
- 协议版本不匹配。
- 未识别对象类型。
- 资源链接丢失。
- 样式无法映射。
- 模板信息只能部分恢复。
- 观察模式中的 unknown 对象数量。

## 8. 反向导出流程

### 8.1 InDesign 侧导出脚本

新增脚本：

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

### 8.2 Node 侧反向编译器

新增模块：

```text
src/indesign-reverse/
  snapshot-reader.js
  label-protocol.js
  reverse-model.js
  html-writer.js
  asset-exporter.js
  report.js
```

职责：

- 校验 InDesign 侧 snapshot。
- 把脚本标签恢复为 Canonical Semantic Model。
- 把无标签对象转换为 observed item。
- 生成 `deck.html`。
- 生成 `reverse-model.json`。
- 生成 `report.json`。

### 8.3 CLI 封装

新增脚本：

```text
scripts/indesign-reverse-export.js
```

建议命令：

```powershell
node scripts/indesign-reverse-export.js --mode structured --out test/workspace/reverse-export
node scripts/indesign-reverse-export.js --mode observation --out test/workspace/reverse-observed
```

内部流程：

```text
cli-anything-indesign script run _indesign_scripts/export_to_html_snapshot.jsx
-> read reverse-snapshot.json
-> compile to deck.html / reverse-model.json / report.json
```

## 9. 模板处理规则

模板分为两类：

| 类型 | 归属 | 作用 | 是否导出为 InDesign 母版 |
| ---- | ---- | ---- | ------------------------ |
| 跨页重复模板 | InDesign 母版页 | 页码、页眉页脚、章节标识、固定装饰线、永远重复的背景元素、页面参考线 | 是 |
| 页面结构模板 | HTML/Agent 侧布局约束 | 左文右图、主图图片区、多图矩阵、指标卡片区、图纸页区域等页面组织方式 | 默认否 |

InDesign 母版只承载跨页重复结构。页面结构模板属于 HTML/Agent 侧布局约束，不默认导出为大量 InDesign 母版。需要给人类接手的页面区域，应通过标签、参考线、样式和可编辑对象表达。

### 9.1 HTML -> InDesign

如果 HTML 声明模板或母版：

```html
<section class="page"
         data-id-parent-page="汇报母版"
         data-id-layout="左文右图">
</section>
```

其中 `data-id-parent-page` 对应 InDesign 母版，`data-id-layout` 对应 HTML/Agent 侧页面结构模板。二者不能混用。

导出 InDesign 时应：

- 创建或复用母版页。
- 给母版页写 `html_indesign` 标签。
- 给母版对象写 `html_indesign` 标签。
- 给页面写母版引用标签。
- 页面主体内容仍作为实体页面对象创建。
- 不因为 `data-id-layout="左文右图"`、`data-id-layout="四图矩阵"` 等页面结构模板自动创建同名 InDesign 母版。
- 把页面结构模板记录到页面标签和 `reverse-model.json`，用于回读和 Agent 继续编辑。

### 9.2 InDesign -> HTML

如果 InDesign 使用了带标签母版：

- 输出 `data-id-parent-page`。
- 输出模板定义到 `reverse-model.json`。
- 对母版页码、页眉、页脚等重复对象，不在每页 HTML 里重复实体化。
- 只把真正来自母版页的跨页重复结构视为母版模板信息。

如果 InDesign 使用了未标注母版：

- 输出母版名称。
- 抽取母版对象为 observed parent items。
- 报告 `PARENT_PAGE_SEMANTIC_UNKNOWN`。
- 不编造语义。

如果页面上存在可推断的图文布局、图像矩阵或卡片阵列：

- observation 模式只保留视觉对象和坐标。
- structured 模式只在已有标签声明时输出 `data-id-layout`。
- 不根据视觉自动创建 `data-id-layout="左文右图"` 等确定语义，除非后续 Agent 语义化阶段明确补写。

### 9.3 模板不作为强依赖

转换成功不要求模板存在。

结构化转换要求标签存在。

模板只是更方便地提供标签、样式和布局约束。

模板不应迫使人类用户在 InDesign 里维护大量“单图页、双图页、四图页、左文右图页”母版。此类页面组织方式应留在 HTML/Agent 侧，通过页面结构模板、区域标签、网格和组件规则表达。

## 10. Agent 语义化流程

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

Agent 不应直接修改 InDesign 标签。Agent 应修改 HTML，因为 HTML 更适合审阅、diff、测试和版本管理。

## 11. 校验规则

### 11.1 标签校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `LABEL_PROTOCOL_MISSING` | warning/error | structured 模式为 error，observation 模式为 warning |
| `LABEL_JSON_INVALID` | error | 标签不是合法 JSON |
| `LABEL_VERSION_UNSUPPORTED` | error | 协议版本不支持 |
| `LABEL_KIND_MISMATCH` | error | 标签 kind 与宿主对象类型不符 |
| `LABEL_ID_DUPLICATED` | error | 同一作用域 ID 重复 |
| `STYLE_TOKEN_MISSING` | warning | 样式没有稳定 token |

### 11.2 反向对象校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `ITEM_SEMANTIC_UNKNOWN` | warning | 对象缺少语义 |
| `ITEM_TYPE_UNSUPPORTED` | warning/error | 对象类型无法映射 |
| `ASSET_LINK_MISSING` | warning/error | 链接资源丢失 |
| `TEXT_RUN_LOSSY` | warning | 局部字符样式无法完整表达 |
| `TABLE_EXPORT_LOSSY` | warning | 表格结构无法完整还原 |
| `GROUP_RELATIONSHIP_MISSING` | warning | 组关系缺失或无法恢复 |

### 11.3 回环校验

反向导出完成后，应支持以下测试：

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

视觉比较作为后续增强，不作为第一阶段硬门槛。

## 12. 第一阶段实施方向

下一步不应先执行高级 InDesign 原生能力补齐计划，而应先实现反向导出骨架。

推荐阶段：

### 阶段 1：前向写完整标签

目标：

- 当前 `HTML -> InDesign` 生成的所有页面、对象、样式、图层、参考线都写入 `html_indesign` JSON 标签。
- 保留现有 `pageItem.label` 紧凑字符串作为调试兜底。

验收：

- 真实 InDesign E2E 后能用脚本读回所有核心标签。

### 阶段 2：结构化反向导出

目标：

- 只支持本项目生成的带标签 InDesign。
- 输出 `deck.html`、`reverse-model.json`、`report.json`。

验收：

- `architecture-report` fixture 可以完成：

```text
HTML -> InDesign -> HTML
```

- 导出的 HTML 保留 `data-id-*`、class、样式引用、资源引用和页面网格。

### 阶段 3：观察模式

目标：

- 支持未标注 InDesign 导出低语义 HTML。
- 所有 unknown 对象都可视、可编辑、可被 Agent 补标签。

验收：

- 任意简单 InDesign 页面可导出为可预览 HTML。
- 报告明确列出 unknown 对象。

### 阶段 4：Agent 语义化回写

目标：

- 给 observation HTML 提供检查器。
- 检查语义标签、网格、资源、样式引用。
- 导回结构化 InDesign。

验收：

- 未标注 InDesign 经 Agent 补标签后，能生成带脚本标签的新 InDesign。

### 阶段 5：模板和母版增强

目标：

- 支持带标签母版页。
- 支持模板定义导出到 `reverse-model.json`。
- 支持 HTML 端模板信息导回 InDesign 母版标签。

验收：

- 母版页码、页眉、页脚不会被误导出为每页重复实体。

## 13. 与高级能力补齐计划的关系

`2026-05-25-indesign-advanced-native-features.md` 应后移。

原因：

- 如果先增加文字串接、绕图、脚注、原生 SVG、图表等能力，却没有反向标签模型，这些能力会成为单向能力。
- 先建立反向骨架后，每新增一个高级能力，都必须同时定义：
  - HTML 标签。
  - InDesign 标签。
  - instructions 字段。
  - 反向读取规则。
  - 回环测试。

因此后续实现顺序应是：

```text
标签协议和反向骨架
-> 当前能力回环
-> 高级能力逐项补齐
```

## 14. 成功标准

第一阶段完成时，应满足：

- 本项目生成的 InDesign 可以反向导出固定语义 HTML。
- HTML 再导回 InDesign 后，对象标签仍稳定。
- 模板信息不会丢失，但模板不是转换强依赖。
- 未标注 InDesign 可以导出观察 HTML。
- Agent 可以通过 HTML 给未标注对象补语义。
- 旧 blueprint 路径保留为兼容层，不阻塞新反向主线。

## 15. 开放边界

第一阶段明确不承诺：

- 任意手工 InDesign 自动识别完美语义。
- 任意复杂母版自动变成高质量 HTML 模板。
- 任意未标注对象自动归类为标题、正文、图纸或卡片。
- 反向导出后视觉完全像素级一致。
- InDesign 所有高级功能一次性读回。

必须承诺：

- 不静默丢弃标签。
- 不静默丢弃对象。
- 不把猜测结果伪装成确定语义。
- 所有降级都进入报告。
