# HTML-InDesign 双向转换语义协议

本文档收敛旧 `openspec/` 中仍然有效的协议内容。当前代码仍是最终依据；本文只记录长期语义、数据结构和边界。

库级目标、浏览器快照、样式映射和执行架构以 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 为准。

## 1. 目标

本项目的长期目标是实现 HTML 与 InDesign 的双向转换。

第一阶段已建立 HTML 到 InDesign：把受约束的 HTML 编译为 InDesign 构建指令，再交给真实 InDesign 执行。HTML 不是任意网页源码，而是面向建筑设计汇报的语义输入。

下一阶段进入双向主线：HTML 的 `data-id-*` 语义必须能写入 InDesign 的 `html_indesign` 脚本标签；InDesign 反向导出时优先读取这些标签恢复固定语义 HTML。

当前的 blueprint 提取、参考 HTML 生成和 `AGENT_SPEC.md` 属于 legacy template 兼容层，主要用于追溯和迁移旧 InDesign 模板。旧 blueprint 不作为新 authoring 协议的事实源，但可以作为 `indesign-reverse` 的 legacy input，被转换为统一语义模型后输出 observation/inferred HTML。

推荐链路：

```text
固定语义 HTML
-> 语义校验
-> 样式和资源解析
-> 统一语义模型
-> InDesign 构建指令 JSON
-> indesign-cli 执行 JSX
-> InDesign 内容页、样式和资源
```

反向链路：

```text
带标签 InDesign
-> reverse snapshot
-> 统一语义模型
-> 固定语义 HTML
```

## 2. Legacy 页面模式

本节到第 5 节记录旧模板兼容协议，用于理解和迁移 `data-master` / `data-slot` / `blueprint` / legacy build instructions。它们不是当前 authoring 协议的事实源。当前主线事实源是 `HTML_INDESIGN_LIBRARY_SPEC.md` 中定义的统一语义模型，InDesign 端持久化边界是 `LABEL_PROTOCOL.md` 中定义的 `html_indesign` 标签。旧 blueprint 输入必须先归一化进统一语义模型，再写出反向 HTML。

### 固定模板页

固定模板页使用已有 InDesign 母版和槽位。HTML 只填充内容，不决定槽位位置。

```html
<section data-master="A-封面">
  <div data-slot="项目中文名">项目名称</div>
  <div data-slot="背景图片"><img src="cover.jpg"></div>
</section>
```

当前兼容属性：

| 属性 | 含义 |
| ---- | ---- |
| `data-master` | InDesign 母版名 |
| `data-slot` | 母版槽位名或槽位简称 |

槽位匹配采用三级策略：

1. 精确匹配。
2. 标准化匹配，忽略空白和大小写。
3. 简称匹配，从 `名称：XXX`、`slot: XXX`、`name: XXX` 等 label 中提取槽位名。

### 自由页

自由页套用基础母版，但正文区域允许创建新元素。自由元素必须有明确类型和边界。

```html
<section data-template="free" data-master="F-自由页">
  <div data-slot="分页标题">分析图 / Diagram</div>

  <div data-type="TEXT"
       data-paragraph-style="小节标题（36点左对齐）"
       data-bounds="15mm,30mm,200mm,25mm">
    动态标题
  </div>

  <div data-type="IMAGE"
       data-object-style="[基本图形框架]"
       data-bounds="15mm,60mm,180mm,120mm">
    <img src="diagram.png">
  </div>
</section>
```

当前兼容属性：

| 属性 | 含义 |
| ---- | ---- |
| `data-template="free"` | 声明自由页 |
| `data-type` | 自由元素类型，当前核心类型为 `TEXT`、`IMAGE` |
| `data-bounds` | `x,y,width,height`，默认单位 `mm`，也兼容 `px` |
| `data-paragraph-style` | InDesign 段落样式名 |
| `data-character-style` | InDesign 字符样式名 |
| `data-object-style` | InDesign 对象样式名 |
| `data-swatch` | InDesign 色板名 |
| `data-z` / `data-zindex` | 自由元素叠放顺序 |

## 3. Legacy Blueprint 结构

Blueprint 是 legacy template 兼容层的事实来源，只服务旧模板查看、旧槽位迁移和历史测试资产。新 authoring 主线不得把 blueprint 当作长期事实源，也不得要求新 HTML 先退化成 `master/slot` 结构。反向迁移时，blueprint 可通过 `legacyBlueprintToSemanticModel` 进入 `indesign-reverse`，输出带置信度的 inferred/observation HTML。

当前 legacy blueprint 有效结构包含：

| 字段 | 含义 |
| ---- | ---- |
| `metadata` | 导出时间、源文档名等信息 |
| `compositeFonts` | 复合字体信息，主要用于中英混排预览 |
| `characterStyles` | 字符样式注册表 |
| `paragraphStyles` | 段落样式注册表 |
| `objectStyles` | 对象样式注册表 |
| `masters` | 母版集合 |
| `masters[*].slots` | 带 label 的可填充槽位 |
| `masters[*].staticItems` | 无 label 的静态预览元素 |

槽位和静态元素应保留 `type`、`bounds`、`content`、样式引用和 `zIndex`。这些信息用于参考 HTML、校验、预览和 build instructions。

## 4. 校验

校验应尽量在 Node 侧完成，JSX 只执行已经验证过的指令。

必须校验：

| 检查 | 错误代码 |
| ---- | -------- |
| 引用不存在的母版 | `MASTER_NOT_FOUND` |
| 引用不存在的槽位 | `SLOT_NOT_FOUND` |
| 图片槽位填了纯文本 | `TYPE_MISMATCH` |
| 自由元素缺少边界 | `MISSING_BOUNDS` |
| 自由元素边界格式错误 | `INVALID_BOUNDS` |
| 样式名不存在 | `STYLE_NOT_FOUND` |

错误报告应保持结构化：

```json
{
  "valid": false,
  "errors": [
    {
      "code": "SLOT_NOT_FOUND",
      "location": "Section 1 -> Slot \"Titl\"",
      "message": "Slot does not exist.",
      "suggestion": "Use an available slot name from blueprint."
    }
  ]
}
```

## 5. Legacy Build Instructions

本节描述旧模板兼容层的 build instructions。新的 `paged-html` 主线仍会生成 InDesign executor 消费的 JSON 指令，但该指令是统一语义模型派生出的执行命令，不是长期事实源；当前主线指令结构以 `HTML_INDESIGN_LIBRARY_SPEC.md` 的 “Build Instructions” 章节为准。

旧模板 HTML 编译后生成单个 JSON 指令文件，默认路径为 `test/workspace/instructions.json`，供 legacy builder / executor 消费。

固定模板页：

```json
{
  "master": "A-封面",
  "items": [
    { "slot": "项目中文名", "type": "TEXT", "content": "项目名称" },
    { "slot": "背景图片", "type": "IMAGE", "src": "cover.jpg" }
  ]
}
```

自由页：

```json
{
  "template": "free",
  "master": "F-自由页",
  "items": [
    {
      "type": "TEXT",
      "bounds": { "x": 15, "y": 30, "width": 200, "height": 25 },
      "paragraphStyle": "小节标题（36点左对齐）",
      "content": "动态标题",
      "zIndex": 10
    }
  ]
}
```

执行器要求：

- 按 `pages` 数组顺序追加页面。
- 不删除已有页面。
- 固定模板页先套用母版，再 override 可填充槽位。
- override 后恢复原始 `geometricBounds`，避免 InDesign 母版覆写偏移。
- 自由页动态创建元素，按 `zIndex` 叠放。

## 6. 演进方向

`data-master`、`data-slot`、`data-template` 是当前兼容层，不应成为新语义协议的唯一表达。新语义应逐步表达 `deck`、`section`、`page`、`title`、`body`、`image`、`caption`、`metric`、`table`、`case-study`、`image-grid` 等对象，并通过映射层兼容现有母版和槽位。

稳定语义 token 是 Agent 编写分页 HTML 时需要遵守的协议词表；中文 InDesign 面板名不是每个 Agent 自行维护，而应由库或项目 preset 统一映射。Agent 可以写 `page-title`、`drawing-frame`、`metric-card` 等稳定 token，编译配置负责映射为 `页面标题`、`图纸框架`、`指标卡片` 等人类可读资源名。

语义字段名和 token 值的边界必须分清：`data-id-paragraph-style`、`data-id-object-style`、`data-id-layer`、`data-id-asset-kind` 等字段名是固定协议，项目不能自造同义字段替代；字段中的 token 值来自当前激活的语义库。未声明 `semanticPreset` 时使用标准语义库；声明 `semanticPreset` 时只使用项目语义库，标准语义库不再参与合并。项目语义库通常由 `npm run preset:init -- -- --package <deck.config.json>` 从标准库生成快照后维护。

作者包中的 `deck.config.json` 可以声明：

```json
{
  "semanticPreset": "semantic-preset.json"
}
```

组装后的 `deck.html` 会在文档根节点写入 `data-id-semantic-preset="semantic-preset.json"`，前向导出时该信息进入文档级 `html_indesign` 标签。反向导出遇到当前 preset 未登记的 token 时，应写出 `reports/semantic-candidates.json` 作为候选提示，不自动篡改项目语义库。

标签是双向转换的协议本体。HTML 侧使用 `data-id-*`，InDesign 侧使用 `html_indesign` JSON 脚本标签。标签协议详见 `LABEL_PROTOCOL.md`。

模板只是标签载体。模板可以帮助人类用户或 Agent 批量获得正确标签、样式和布局约束，但转换语义不应依赖某个模板文件存在。

HTML 页面结构模板和 InDesign 母版必须区分：

| 概念 | HTML 表达 | InDesign 表达 | 规则 |
| ---- | --------- | ------------- | ---- |
| 跨页重复模板 | `data-id-parent-page` / `data-id-parent-page-name` | 母版页 | 用于页码、页眉页脚、章节标识、固定装饰线、重复背景、参考线；前者是稳定 ID，后者是面板显示名 |
| 页面结构模板 | `data-id-layout` | 页面标签 / `reverse-model.json` | 用于左文右图、图像矩阵、指标卡片区等页面组织方式，不默认创建 InDesign 母版 |

HTML 示例：

```html
<section class="page"
         data-page="agenda"
         data-id-parent-page="report-parent"
         data-id-parent-page-name="汇报母版"
         data-id-layout="contents-grid"
         data-id-semantic="agenda">
</section>
```

其中：

- `data-id-parent-page` 对应 InDesign 母版页稳定 ID，`data-id-parent-page-name` 对应 InDesign 面板显示名。
- `data-id-layout` 对应 HTML/Agent 侧页面结构模板。
- 二者不能混用。
- 页面容器推荐继续使用当前代码支持的 `data-page` 或 `.page`；`data-id-*` 负责语义、布局约束和资源参数。
- `data-id-pdf-page` 专用于 PDF 置入页码；历史 `data-id-page` 作为 PDF 页码兼容字段可读取但不再推荐。

页面级排版语义优先使用不破坏浏览器预览的自然表达：`.page` 的 `padding` 映射为 InDesign 页边距；当现有 HTML 采用绝对定位、不适合增加 padding 时，可用 `data-id-margin="top right bottom left"` 声明非视觉页边距。主网格使用页面级 `data-id-grid="列数"`、`data-id-grid="列数x行数"` 或可解析的 CSS Grid 派生；带间距网格使用 `data-id-column-gutter`、`data-id-row-gutter` 或 CSS `gap` 表达；baseline / 模数行使用 `data-id-baseline="4mm"` 表达。执行器应生成 InDesign 原生参考线，不生成可打印对象。

对于多页建筑汇报，推荐使用作者源码包组织 HTML：`deck.config.json` 记录页面顺序和共享样式，`pages/*.html` 保存页面片段，`styles/*.css` 保存共享样式，`deck.html` 由组装器生成。转换器仍消费组装后的 `deck.html`，但 Agent 默认不直接编辑该生成物。

源码包来源字段：

- 文档标签记录 `sourcePackage`。
- 页面标签记录 `sourceFile`、`sourceNode`、`grid`。
- 对象标签记录 `sourceFile`、`sourceNode`、`structure`、`layout.grid` 和 `layout.cssVars`。

这些字段只描述作者来源和结构关系，不作为视觉兜底补丁。反向源码包优先使用这些字段拆分页面和恢复 `class` / `data-id-*`。

`sourceNode` 描述作者源码节点，反向作者源码包必须优先使用它恢复标签名、class 和稳定属性。`sourceAsset` 描述作者源码中的资源引用，服务 `img`、`object`、`embed`、`picture` 等标签恢复。`structure.parentId` 描述作者源码父子关系；当它指向同页对象时，反向源码包应嵌套输出，而不是平铺。

网格不是给人工拖拽使用的装饰层，而是 Agent 编写分页 HTML 的版面契约。每个页面必须声明边距和主网格；顶层可映射元素的关键边缘应贴合页边距、列线、栏间距两侧、行线或 baseline。允许浏览器继续使用自然 CSS Grid / gap / padding 预览，但翻译层会把这些规则沉淀为 InDesign 页边距和原生参考线。卡片、图例、表格内部的嵌套文字可以使用局部节奏，不强制贴页面主网格。

建筑汇报页面推荐声明 12 列、6 个粗行模块的主网格，同时声明栏间距和作者侧 baseline：

```html
<section class="page"
         data-page="grid-demo"
         data-id-margin="14mm 16mm 10mm 18mm"
         data-id-grid="12x6"
         data-id-column-gutter="6mm"
         data-id-baseline="4mm">
</section>
```

`data-id-grid` 描述人类可见主网格；`data-id-baseline` 描述作者侧垂直节奏，用于 HTML 排版和校验，默认不把每条 baseline 都输出成 InDesign 可见参考线。只有声明 `data-id-baseline-guides="all"` 时才会输出全量 baseline，这通常只用于调试。`data-id-snap-grid` 只描述次级微调模数，不能单独满足页面主网格规则。`data-id-guide-mode="used-snap"` 只作为兼容/调试模式，用实际顶层对象边缘反推参考线，不作为建筑汇报默认规则。

作者侧约束检查由 `validateAuthoringRules(snapshot, options)` 执行。当前检查项包括：

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `PAGE_MARGIN_RULE_MISSING` | error | 页面缺少 `data-id-margin`、`data-id-margin-*` 或可识别页面 padding |
| `PAGE_GRID_RULE_MISSING` | error | 页面缺少 `data-id-grid` 或可解析 CSS Grid；`data-id-snap-grid` 不能单独满足 |
| `PAGE_GRID_RULE_INVALID` | error | 页面声明了网格但格式不可解析 |
| `GRID_ALIGNMENT_OFF` | warning | 顶层可映射元素关键边缘没有贴合声明主网格或 baseline |
| `SEMANTIC_TOKEN_MISSING` | warning | 可映射元素缺少稳定 class 或 `data-id-*` 语义 token |

`strict` 模式会把 warning 提升为 error，适合交付前或 CI 使用。普通开发阶段可以先保留 warning，让 Agent 逐步修正 HTML。

## 7. InDesign 标签对应

前向导出必须把 HTML 语义写入 InDesign：

| HTML 信息 | InDesign 标签位置 |
| --------- | ----------------- |
| 文档 profile、资源根目录、单位模式 | Document `html_indesign` |
| 页面 ID、语义、边距、网格、layout、parent page | Page `html_indesign` |
| 母版页 ID、名称、提供的重复结构 | MasterSpread `html_indesign` |
| 页码、页眉、固定装饰等母版对象 | PageItem `html_indesign` |
| 样式 token 和中文显示名 | Style `html_indesign` |
| 图层 token 和中文显示名 | Layer `html_indesign` |
| 文本、图框、形状、线、表格、组 | PageItem `html_indesign` |
| 页面参考线 | Guide `html_indesign` 或兼容 `html_indesign_guide` |

反向导出必须优先读取 `html_indesign`，只在标签缺失时进入观察模式或 legacy 兼容路径。

## 8. 反向导出模式

反向导出规范详见 `REVERSE_EXPORT.md`。

| 模式 | 输入 | 输出 |
| ---- | ---- | ---- |
| `structured` | 本项目生成或人工按协议打标签的 InDesign | 固定语义 HTML |
| `inferred` | 弱标签 InDesign 或旧模板蓝图 | 带置信度和补标线索的推断 HTML |
| `observation` | 未标注或部分标注 InDesign | 低语义观察 HTML |

未标注 InDesign 的推荐迁移流程：

```text
未标注 InDesign
-> observation HTML
-> Agent 补 data-id 语义标签
-> HTML-to-InDesign
-> 带脚本标签的结构化 InDesign
```

Agent 应优先修改 HTML，而不是直接修改 InDesign 脚本标签。HTML 更适合审阅、diff、测试和版本管理。
