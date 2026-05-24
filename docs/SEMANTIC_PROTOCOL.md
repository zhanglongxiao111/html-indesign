# HTML-InDesign 双向转换语义协议

本文档收敛旧 `openspec/` 中仍然有效的协议内容。当前代码仍是最终依据；本文只记录长期语义、数据结构和边界。

库级目标、浏览器快照、样式映射和执行架构以 `docs/HTML_INDESIGN_LIBRARY_SPEC.md` 为准。

## 1. 目标

本项目的长期目标是实现 HTML 与 InDesign 的双向转换。

第一阶段先实现 HTML 到 InDesign：把受约束的 HTML 编译为 InDesign 构建指令，再交给真实 InDesign 执行。HTML 不是任意网页源码，而是面向建筑设计汇报的语义输入。

InDesign 到 HTML 是后续阶段能力。当前的 blueprint 提取、参考 HTML 生成和 `AGENT_SPEC.md` 主要服务于第一阶段：把现有 InDesign 模板抽象成可校验、可编译的 HTML 语义。

推荐链路：

```text
固定语义 HTML
-> 语义校验
-> 样式和资源解析
-> InDesign 构建指令 JSON
-> cli-anything-indesign 执行 JSX
-> InDesign 内容页、样式和资源
```

## 2. 页面模式

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

## 3. Blueprint 结构

Blueprint 是宿主侧语义、校验和构建的主要事实来源。当前有效结构包含：

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

## 5. Build Instructions

HTML 编译后生成单个 JSON 指令文件，默认路径为 `test/workspace/instructions.json`，供 `_indesign_scripts/build_from_instructions.jsx` 消费。

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
