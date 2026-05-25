# HTML 源结构保真设计

## 1. 背景

当前项目已经具备 HTML -> InDesign -> HTML 的结构化回读闭环，但回写 HTML 仍偏向“坐标化结构骨架”。它能证明页面、对象、样式、资源、母版和基础语义没有丢，但还不能充分恢复 Agent 原本编写 HTML 时使用的源码结构。

现有规范已经分散定义了部分字段：

- `LABEL_PROTOCOL.md` 定义了 `htmlTag`、`className`、`grid`、`children` 等对象标签雏形。
- `REVERSE_EXPORT.md` 定义了 structured / observation 两种反向模式。
- `SEMANTIC_PROTOCOL.md` 和 `HTML_INDESIGN_LIBRARY_SPEC.md` 定义了母版、页面结构模板、网格参考线和统一语义模型。

这份设计把这些内容收束成一个明确目标：**正向导出时把 HTML 源结构作为一等事实写入 InDesign，反向导出时优先用这些事实重建可继续由 Agent 编辑的 authoring HTML。**

### 1.1 旧 Blueprint 链路的价值

旧的 InDesign 模板还原 HTML 链路不能被视为废弃经验。它已经证明：即使没有完整语义标签，也可以从 InDesign 原生信息里还原出可观察、可预览、可继续补标的 HTML。

可借鉴能力如下：

| 旧链路能力 | 当前应吸收的方向 |
| ---------- | ---------------- |
| `_indesign_scripts/extract_blueprint.jsx` 抽取母版、页面对象、槽位、静态对象和几何边界 | 无标签或弱标签 InDesign 的视觉还原入口 |
| 抽取段落样式、字符样式、对象样式、复合字体、描边、填充、圆角、文本框内边距和多栏 | 反向 CSS 与样式 token 的基础翻译库 |
| 根据 `pageItem.label` 区分槽位和静态对象，但不要求每个对象都有完整语义标签 | 弱标签推断模式，而不是 authoring 模式的替代品 |
| 读取 `geometricBounds`、图层顺序和对象类型 | 无标签视觉 HTML 的确定性依据 |
| 读取图片/PDF/EPS 置入路径、图框尺寸和裁切状态 | 资源图框反向映射的基础能力 |
| `src/generator.js` 把 blueprint 生成为 HTML、CSS 和 Agent 约束注释 | 反向 writer 与作者侧规则生成的可复用经验 |
| `src/validator.js` 校验母版、槽位、类型、样式和边界 | 新 authoring/structured/inferred/observation 校验器的先例 |

因此，本设计不应写成“没有标签就不能导出 HTML”。正确边界是：**没有标签也能导出视觉 HTML；有弱标签和 InDesign 原生结构时可以做推断结构；只有完整源结构标签时才能确定性恢复 authoring HTML。**

## 2. 目标

本设计要支持：

- 本项目正向生成的 InDesign 可以反向导出接近原始 authoring HTML 的结构。
- 无语义标签、弱标签或旧模板导出的 InDesign 也可以反向导出视觉 HTML，而不是被拒绝。
- 对旧模板、槽位标签、母版、图层、参考线、样式和几何关系进行推断，输出带置信度的 inferred HTML。
- 页面网格、边距、栏距、行距、baseline 和页面结构模板能完整回读。
- HTML 的 `tagName`、`id`、`classList`、`data-id-*`、关键 `style` 布局变量能写入 InDesign 标签。
- HTML 父子关系、组件容器、卡片、图例、标注组、图文模块能在 InDesign 中持久化，并在反向导出时重建嵌套。
- InDesign 真实参考线仍用于人类接手，但反向还原网格时优先读取页面标签，参考线只用于校验或观察模式。
- 对无标签或标签不完整的手工 InDesign，输出视觉 HTML、推断报告和补标建议，不假装恢复原始源码结构。

本设计不覆盖：

- 从完全无标签的任意 InDesign 自动推理出高质量 authoring HTML。
- 还原作者原始 CSS 文件的格式、注释、选择器顺序和无关 class。
- 自动把所有视觉相近对象归纳成复杂响应式组件。
- 任意网页自动分页。

## 3. 模式定义

反向导出应明确区分四种输出模式。

| 模式 | 目标 | 输入要求 | 输出特点 |
| ---- | ---- | -------- | -------- |
| `authoring` | 恢复 Agent 可继续编辑的 HTML | 完整源结构标签 | 保留页面网格、class、嵌套、组件容器、语义属性 |
| `structured` | 恢复固定语义 HTML | 基础协议标签 | 保留页面、对象、样式、资源、母版和坐标；结构允许扁平 |
| `inferred` | 从弱标签和 InDesign 原生信息推断结构 | 旧槽位标签、母版、图层、参考线、样式、分组或几何关系 | 输出推断 DOM、置信度、补标建议；不得冒充原始源码 |
| `observation` | 观察无标签 InDesign | 无标签也可 | 绝对坐标视觉 HTML、样式和资源尽量保真、未知对象报告、待补标签清单 |

`authoring` 是本设计新增的高质量目标；`structured` 是当前已经跑通的主线；`inferred` 继承旧 blueprint/template 链路的推断经验；`observation` 是所有 InDesign 文档都应具备的最低视觉回读能力。

`authoring` 不应静默降级到 `structured`。如果缺少必要源结构字段，应失败并输出报告，提示使用 `structured`、`inferred` 或 `observation`。

`inferred` 不应静默升级为 `authoring`。它可以生成更自然的 DOM 和 class 建议，但必须把来源、置信度和不确定项写入报告。

`observation` 不依赖标签。它应尽可能使用 InDesign 原生事实还原视觉，包括页面尺寸、母版可见对象、文本框、图框、线条、形状、表格、置入资源、图层顺序、样式和参考线。

## 4. 协议原则

### 4.0 标签依赖边界

标签是高质量往返的确定性事实源，但不是反向导出 HTML 的唯一入口。

无标签 InDesign 仍可确定读取：

- 页面尺寸、页边距、母版应用和页面顺序。
- 页面对象类型、几何边界、图层、叠放顺序、描边、填充、圆角和透明度。
- 文本内容、段落样式、字符样式、文本框内边距、多栏、列表、首字下沉和复合字体信息。
- 表格结构、单元格内容、行列尺寸、表格线、填充和文本样式。
- 图片、PDF、AI、PSD、EPS 等置入资源路径、图框、裁切和缩放状态。
- 页面参考线、母版参考线、图层命名、对象样式命名和分组关系。

这些事实足以生成 `observation` HTML，也能为 `inferred` 模式提供推断依据。缺失的是作者原始 DOM 意图、class 命名、组件嵌套和网格变量，这些只能由完整标签或人工/Agent 补标确认。

### 4.1 正向必须多写事实

浏览器快照阶段已经能看到 DOM 树、class、data attributes、computed style 和布局结果。正向导出时不能只把视觉对象变成 InDesign 页面对象，还必须把源结构事实写入 `html_indesign` 标签。

必须持久化的事实包括：

- 文档事实：profile、资源根、单位模式、页面尺寸策略。
- 页面事实：页面标签、语义、母版引用、页面结构模板、网格规则。
- 节点事实：HTML 标签名、id、class、data attributes、DOM 父子关系、子节点顺序。
- 布局事实：页面主网格位置、局部组件网格、CSS 变量、最终几何坐标。
- 样式事实：段落、字符、对象、框架、表格、图层和资源 token。
- 编辑事实：哪些容器应在 InDesign 中成组，哪些只是 HTML 结构容器。

### 4.2 InDesign 标签是事实源，不是注释

写入 InDesign 的 `html_indesign` 标签必须足够让反向导出确定性恢复结构。紧凑 `pageItem.label` 只用于人类面板提示和兼容调试，不可作为主协议。

### 4.3 参考线不是网格定义本体

InDesign 参考线可以表达页面网格，但参考线本身无法稳定表达“12 列、8 行、栏距 6mm、行距 5mm、baseline 4mm”的语义。因此：

- 页面标签保存完整网格规则。
- InDesign 页面生成原生参考线。
- 反向读取时优先读页面标签。
- 参考线用于校验标签和实际文档是否一致。
- 无标签时可从参考线生成 `observedGuides`，但不得自动宣称恢复了 authoring 网格。

## 5. 标签扩展

### 5.1 Document 标签

文档标签增加源结构策略：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "document",
  "id": "architecture-report",
  "source": "html-to-indesign",
  "profile": "architecture-report",
  "unitMode": "presentation",
  "coordinateUnit": "pt",
  "sourceStructure": {
    "mode": "preserve",
    "schemaVersion": 1,
    "htmlEntry": "deck.html",
    "assetRoot": "test/fixtures/e2e/architecture-report"
  }
}
```

规则：

- `sourceStructure.mode="preserve"` 表示本文件应支持 `authoring` 回读。
- 如果正向生成时未启用源结构保真，反向 `authoring` 模式必须失败。

### 5.2 Page 标签

页面标签应保存 HTML 页面容器事实和网格规则：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "page",
  "id": "agenda-page",
  "source": "html-to-indesign",
  "semantic": "agenda",
  "sourceNode": {
    "tagName": "section",
    "id": "agenda-page",
    "classList": ["page"],
    "attributes": {
      "data-page": "agenda",
      "data-id-layout": "contents-grid"
    },
    "path": "main.deck > section#agenda-page"
  },
  "parentPage": {
    "id": "report-parent",
    "name": "汇报母版"
  },
  "layout": "contents-grid",
  "grid": {
    "columns": 12,
    "rows": 8,
    "columnGutter": 6,
    "rowGutter": 5,
    "baseline": 4,
    "unit": "mm"
  },
  "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 }
}
```

规则：

- `sourceNode` 用于恢复 HTML 容器。
- `grid` 用于恢复 authoring CSS 与 InDesign 参考线。
- `layout` 仍表示页面结构模板，不自动创建 InDesign 母版。

### 5.3 Item 标签

对象标签应拆分为四类事实：源节点、结构关系、布局、映射结果。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "agenda-chapter-03",
  "source": "html-to-indesign",
  "role": "card",
  "semantic": "chapter-card",
  "sourceNode": {
    "tagName": "div",
    "id": "agenda-chapter-03",
    "classList": ["chapter", "grid-item", "grid-frame"],
    "attributes": {
      "data-id-object": "",
      "data-id-layer": "content",
      "data-id-object-style": "chapter-card"
    },
    "textPolicy": "children",
    "path": "main.deck > section#agenda-page > div.chapter:nth-of-type(3)"
  },
  "structure": {
    "parentId": "agenda-page",
    "children": ["agenda-chapter-03-title", "agenda-chapter-03-body"],
    "order": 6,
    "containerPolicy": "group"
  },
  "layout": {
    "grid": {
      "col": 5,
      "span": 3,
      "row": 5,
      "rowSpan": 2
    },
    "cssVars": {
      "--grid-col": "5",
      "--grid-span": "3",
      "--grid-row": "5",
      "--grid-row-span": "2"
    },
    "bounds": { "x": 990, "y": 640, "width": 520, "height": 240, "unit": "pt" }
  },
  "styleRefs": {
    "objectStyleToken": "chapter-card",
    "frameStyleToken": "chapter-card-frame",
    "paragraphStyleToken": null,
    "characterStyleToken": null
  }
}
```

规则：

- `sourceNode.tagName` 和 `sourceNode.classList` 是恢复 authoring HTML 的主要依据。
- `structure.parentId` 和 `structure.children` 是恢复嵌套的主要依据。
- `structure.containerPolicy` 决定 InDesign 端如何表达容器。
- `layout.grid` 用于恢复主网格排版，不依赖视觉猜测。
- `layout.bounds` 用于校验和 fallback，不替代 `layout.grid`。

### 5.4 Group 标签

InDesign 组对象应使用同一 `item` 标签，只是 `role="group"`。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "legend-block",
  "role": "group",
  "semantic": "legend",
  "sourceNode": {
    "tagName": "div",
    "classList": ["legend", "grid-item", "grid-frame"]
  },
  "structure": {
    "parentId": "site-analysis-page",
    "children": ["legend-item-ice", "legend-item-service", "legend-item-circulation"],
    "order": 12,
    "containerPolicy": "group"
  }
}
```

规则：

- 卡片、图例、指标组、标注组、图文模块适合映射为 InDesign 组。
- 纯布局容器可以不建组，但必须在子对象标签中记录 `parentId`。
- 深层文本内联结构不建 InDesign 组，使用 text runs 和字符样式恢复。

## 6. Semantic Model 扩展

现有 `PageItemModel` 需要增加源结构字段。新增字段如下：

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `sourceNode` | object | HTML 源节点事实 |
| `structure.parentId` | string | HTML 父节点或页面 ID |
| `structure.children` | string[] | 子节点顺序 |
| `structure.order` | number | 同级顺序 |
| `structure.containerPolicy` | enum | `group`、`virtual`、`flatten` |
| `layout.grid` | object | 主网格位置 |
| `layout.cssVars` | object | 可恢复的 CSS 变量 |
| `layout.localGrid` | object | 卡片或组件内部局部网格 |
| `layout.bounds` | object | 最终几何边界 |
| `reversePolicy` | object | 反向写 HTML 策略 |

`PageModel` 也应增加：

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `sourceNode` | object | 页面容器 HTML 事实 |
| `grid` | object | 页面主网格 |
| `layoutZones` | object[] | 页面区域定义，如图纸区、文字区、指标区 |

`DocumentModel` 应增加：

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `sourceStructure` | object | 是否支持 authoring 回读及 schema 版本 |

## 7. 正向转换要求

### 7.1 Browser Snapshot

浏览器快照阶段必须采集：

- 每个可映射节点的 `tagName`、`id`、`classList`、`attributes`。
- DOM 父节点关系和同级顺序。
- 页面级 grid、gap、padding、baseline。
- CSS 变量，特别是 `--grid-col`、`--grid-span`、`--grid-row`、`--grid-row-span`。
- 被 `data-id-ignore` 包裹但需要继承源结构的资源对象。

### 7.2 Snapshot -> Semantic Model

建模阶段必须：

- 给每个 item 生成稳定 `sourceNode`。
- 根据 DOM 关系生成 `structure.parentId` 和 `structure.order`。
- 根据 CSS Grid 或 CSS 变量生成 `layout.grid`。
- 对 `data-id-object` 容器和其子文本建立父子关系，不再只保留扁平对象列表。
- 对无法稳定恢复的节点记录 warning，不静默丢弃。

### 7.3 Semantic Model -> Instructions

instructions 必须携带完整标签信息，或携带足以让 executor 写出完整标签的字段。不得只携带执行所需的视觉字段。

### 7.4 InDesign Executor

执行器必须：

- 给文档、页面、母版、样式、图层、参考线和页面对象写完整 `html_indesign` 标签。
- 对 `containerPolicy="group"` 的对象创建 InDesign 组，并把组标签写在组对象上。
- 对 `containerPolicy="virtual"` 的容器不创建组，但保留子对象 `parentId`。
- 标签写入失败时按现有硬规则报错，不允许静默成功。

## 8. 反向转换要求

### 8.1 InDesign Snapshot

反向快照必须读取：

- 文档、页面、母版、图层、样式、参考线、页面对象标签。
- InDesign 组和组内对象顺序。
- 页面对象几何边界和所属页面。
- 无标签对象的观察信息。

### 8.2 Reverse Model

反向模型构建应按优先级恢复：

1. `html_indesign` 标签中的源结构字段。
2. InDesign 组关系。
3. 页面对象顺序和几何位置。
4. 观察模式下的视觉推断。

在 `authoring` 模式下，缺少源结构字段应进入错误报告，不自动降级。

在 `inferred` 模式下，应增加推断来源：

1. 旧 blueprint 槽位标签和短名称解析。
2. InDesign 真实组关系。
3. 母版名称、页面名称、图层名称和对象样式名称。
4. 参考线、页边距和对象几何对齐关系。
5. 文本样式层级、字号差异和对象邻近关系。
6. 资源类型和图框命名。

每个推断出的页面区、组件、class 或语义角色都必须有 `confidence` 和 `evidence`。低置信度结果可以写入 HTML 注释或报告，但不能作为确定协议字段。

### 8.3 HTML Writer

`authoring` writer 应：

- 按 `structure.parentId` 和 `structure.children` 重建 DOM 树。
- 按 `sourceNode.tagName` 输出标签。
- 按 `sourceNode.classList` 输出 class。
- 恢复关键 `data-id-*` 属性。
- 对网格对象输出 `style="--grid-col:5;--grid-span:3;--grid-row:5;--grid-row-span:2"` 这类 CSS 变量，或输出等价 class 规则并在报告中记录映射。
- 输出页面级 `data-id-grid`、`data-id-column-gutter`、`data-id-row-gutter`、`data-id-baseline`。
- 默认不得把有 `layout.grid` 的对象写成绝对定位；只有无网格或局部视觉对象可使用绝对坐标，并必须写入报告。

`structured` writer 可继续输出坐标化固定语义 HTML，但必须保留所有可用标签字段。

`inferred` writer 输出尽量自然的 HTML，并明确标记 `data-id-reverse-mode="inferred"`。它可以生成建议 class、建议容器和建议语义属性，但必须同步输出 `inferred-report.json`。

`observation` writer 输出视觉 HTML，并明确标记 `data-id-reverse-mode="observation"`。它不得因为缺少语义标签失败，除非 InDesign 文档本身无法被读取。

## 9. InDesign 分组策略

InDesign 分组是编辑体验和 HTML 嵌套之间的折中，不能机械把所有 HTML 容器都变成组。

| HTML 容器类型 | InDesign 表达 | 原因 |
| ------------- | ------------- | ---- |
| 卡片、指标组、图例、标注组 | 真实组 | 人类常整体移动和编辑 |
| 图文模块、图纸说明模块 | 真实组或虚拟组 | 取决于是否需要整体选择 |
| 页面结构区，如左栏、右侧图纸区 | 虚拟容器 | 避免 ID 组层级过深 |
| 纯 CSS grid wrapper | 虚拟容器 | 只保留结构，不影响人工编辑 |
| 文本内联 span | 文本 runs | InDesign 字符样式更自然 |

`containerPolicy` 必须由语义协议或 authoring validator 决定，不应在 InDesign executor 末端凭感觉推断。

## 10. 校验规则

新增 authoring 回读校验：

| 规则 | 等级 | 说明 |
| ---- | ---- | ---- |
| `SOURCE_STRUCTURE_MISSING` | error | `authoring` 模式缺少文档级源结构声明 |
| `SOURCE_NODE_MISSING` | error | 核心对象缺少 `sourceNode` |
| `STRUCTURE_PARENT_MISSING` | error | 核心对象缺少 `parentId` 且不是页面直接子项 |
| `GRID_LAYOUT_MISSING` | warning/error | 顶层 grid-item 缺少 `layout.grid` |
| `GROUP_CHILD_MISSING` | error | 组标签声明的子对象不存在 |
| `GROUP_CHILD_ORDER_INVALID` | error | 子对象顺序不可确定 |
| `REFERENCE_GRID_MISMATCH` | warning | 页面标签网格与实际参考线不一致 |
| `AUTHORING_DOWNGRADE_REQUIRED` | error | 只能 structured/inferred/observation，不能 authoring |

真实 E2E 回环应增加：

- 正向 instructions 中检查 `sourceNode`、`structure`、`layout.grid`。
- InDesign snapshot 中检查对象标签包含源结构字段。
- `authoring` reverse HTML 中检查 class、嵌套、grid CSS 变量恢复。
- 对比 authoring HTML 的关键 DOM 结构，不做逐字符 diff。

## 11. 迁移策略

建议分四步实施。

### 阶段零：旧 Blueprint 能力归并

先把旧链路里仍有价值的能力归并到新架构，不改变现有正向视觉输出：

- 梳理 `extract_blueprint.jsx`、`generator.js`、`validator.js` 中的可复用翻译规则。
- 把母版、槽位、静态对象、样式、资源、几何和图层顺序抽取能力纳入 `indesign-reverse`。
- 明确哪些代码可迁移，哪些旧模板接口应退役删除。
- 增加无标签/弱标签 InDesign 到 `observation` HTML 的最小测试。

### 阶段一：标签补全

只补正向标签，不改变视觉输出：

- 扩展 Semantic Model。
- 扩展 item/page/document labels。
- 确保 InDesign 中能读到 sourceNode、structure、layout。
- 增加静态测试和真实 E2E 标签审计。

### 阶段二：authoring writer

新增反向 writer 模式，并补齐 inferred/observation writer 的模式边界：

```powershell
npm run reverse:indesign -- --mode authoring
npm run reverse:indesign -- --mode inferred
npm run reverse:indesign -- --mode observation
npm run e2e:indesign -- --reverse-roundtrip --reverse-mode authoring
```

输出：

```text
reverse-html/deck.authoring.html
reverse-html/deck.inferred.html
reverse-html/deck.observation.html
reverse-html/authoring-report.json
reverse-html/inferred-report.json
```

### 阶段三：组和虚拟容器

补齐 InDesign 组策略：

- 卡片、图例、标注组生成真实组。
- 页面结构区生成虚拟容器标签。
- 回读时按组和虚拟容器恢复嵌套。

## 12. 与现有文档的关系

本设计不是替代现有规范，而是补齐一个缺失层：

- `LABEL_PROTOCOL.md` 应吸收本设计的字段定义，成为长期协议。
- `REVERSE_EXPORT.md` 应吸收 `authoring`、`inferred` 模式和降级规则。
- `HTML_INDESIGN_LIBRARY_SPEC.md` 应吸收 Semantic Model 扩展字段。
- `SEMANTIC_PROTOCOL.md` 应吸收 Agent 作者侧需要遵守的源结构规则。

实现计划应优先修改代码，再同步长期规范。不要先在多个长期文档里重复堆定义，避免规范漂移。

## 13. 成功标准

完成后，以下结果必须成立：

- 从当前架构汇报 fixture 正向导出的 InDesign，再反向导出 `authoring` HTML，页面仍有原始 `page`、`grid-item`、`grid-frame` 等 class。
- 页面级 `data-id-grid`、栏距、行距、baseline、母版和 `data-id-layout` 全部恢复。
- 卡片、图例、指标组等嵌套结构能恢复为父子 DOM，而不是全部平铺。
- InDesign 中能看到真实参考线和可编辑对象；需要整体编辑的模块能作为组接手。
- 如果删除关键 `html_indesign` 标签，`authoring` 模式失败并给出明确报告。
- 如果输入是无标签 InDesign，`observation` 模式仍能输出视觉 HTML，至少保留页面、文本、图形、图框、资源、表格、样式和叠放顺序。
- 如果输入是旧模板或弱标签 InDesign，`inferred` 模式能借助母版、槽位、样式、参考线、分组和几何关系输出带置信度报告的结构化 HTML。
- `structured`、`inferred` 和 `observation` 模式仍可独立工作，不被 authoring 模式复杂度污染。

## 14. 关键决策

本设计采用：

- **视觉回读兜底**：无标签 InDesign 也必须能输出视觉 HTML，这是开放系统的最低能力。
- **协议标签优先**：完整 authoring 还原依赖正向写入的源结构标签。
- **旧链路归并**：旧 blueprint/template 的母版、槽位、样式、资源和几何抽取能力进入新反向链路。
- **推断必须显式**：弱标签和视觉关系可以推断结构，但必须记录证据和置信度。
- **InDesign 组辅助**：组用于人类编辑体验和显式组件关系，但不是唯一嵌套来源。
- **参考线校验网格**：参考线帮助人类和校验器，但页面标签才是网格语义来源。
- **模式严格分离**：`authoring`、`structured`、`inferred`、`observation` 不互相假装。
- **无标签不猜源码**：无标签 InDesign 可以视觉还原和辅助补标，但不能声称恢复原始 authoring HTML。
