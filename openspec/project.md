# Project: HTML-InDesign Bi-Directional Converter

## 1. 项目愿景 (Mission)
本项目旨在构建一座连接 **Web 技术栈 (HTML)** 与 **Adobe InDesign** 的双向桥梁。
核心目标是实现**“参数化排版”**：让 AI Agent 能够通过编写简单的语义化 HTML，严格遵循 InDesign 母版页的布局规则，自动化生成专业的建筑演示文稿、分析图册或排版文档。

## 2. 核心架构 (Architecture)
系统采用 **Node.js** 作为主控制器，通过 **ExtendScript (.jsx)** 与 InDesign 进行深层交互。

### 数据流向 (The Data Pipeline)
1.  **提取 (Extract)**: InDesign -> `blueprint.json`
    *   通过 ExtendScript 扫描文档母版页，提取带有 **Script Label** 的槽位信息。
2.  **转换 (Convert)**: `blueprint.json` -> `reference.html`
    *   Node.js 工具将 JSON 数据转换为可视化的 **HTML 参照模板**。
    *   该模板直接展示了正确的 HTML 结构、标签属性及注释说明，作为 AI 生成的“临摹范本”。
3.  **生成 (Generate)**: AI Agent -> `content.html`
    *   AI 读取 `reference.html`，选择合适的母版模板，填充具体内容。
    *   **自由布局策略 (Free Layout Strategy)**: 对于标记为“自由画布”的区域，AI 可生成包含多个子元素的复杂 HTML 结构，实现动态排版。
4.  **校验 (Validate)**: `content.html` + `blueprint.json` -> **Report**
    *   Node.js 校验引擎对 HTML 进行“硬约束”检查（母版是否存在、槽位是否匹配）。
    *   如果校验失败，反馈错误报告给 AI 进行自我修正。
5.  **构建 (Build)**: `content.html` -> InDesign Pages
    *   Node.js 将 HTML 解析为构建指令。
    *   ExtendScript 接收指令，在 InDesign 中创建页面、应用母版并填充内容。对于自由布局区域，脚本将动态创建相应的新对象。

## 3. 两种页面模式 (Page Modes)

系统支持两种截然不同的页面模式，AI Agent 必须理解其区别：

### 3.1 固定模板页 (Fixed Template Page)
- **特征**：母版页预定义了固定的槽位（文本框、图片框），AI 只需"填空"
- **HTML 结构**：`<section data-master="A-封面">` + `<div data-slot="槽位名">内容</div>`
- **约束**：槽位名称必须与 Blueprint 中定义的完全匹配（支持简短名模糊匹配）
- **适用场景**：封面、目录、篇章分隔页、标准图文排版页

### 3.2 ⭐ 自由页 (Free Page) - 核心难点
- **特征**：母版页仅提供标题栏等基础元素，主体区域为**空白画布**，AI 可自由创建任意数量、任意位置的元素
- **HTML 结构**：`<section data-template="free" data-master="F-自由页">` + 多个 `<div class="free-item" data-bounds="x,y,w,h">` 子元素
- **技术难点**：
  1. **坐标系统**：AI 需指定每个元素的精确位置 `data-bounds="15mm,30mm,120mm,18mm"` (x, y, width, height)
  2. **动态创建**：ExtendScript 需在 InDesign 中**从零创建**文本框/图片框，而非填充已有槽位
  3. **样式映射**：需通过 `data-paragraph-style`、`data-object-style` 引用 Blueprint 中定义的样式
  4. **层叠顺序**：需通过 `data-z-index` 控制元素的前后叠放关系
- **适用场景**：分析图、自定义布局、无法套用标准模板的复杂排版

### 自由页 HTML 示例
```html
<section data-template="free" data-master="F-自由页">
  <!-- 填充母版上已有的标题槽位 -->
  <div data-slot="分页标题">自由排版示例 / Free Layout</div>

  <!-- 以下为自由创建的元素（母版上不存在） -->
  <div class="free-item" data-type="TEXT"
       data-paragraph-style="小节标题（36点左对齐）"
       data-bounds="15mm,30mm,200mm,20mm">
    动态创建的标题
  </div>

  <div class="free-item" data-type="IMAGE"
       data-object-style="重点圈注"
       data-bounds="15mm,55mm,180mm,120mm">
    <img src="diagram.png"/>
  </div>
</section>
```

## 4. 关键协议 (Key Protocols)
Agent 在执行任务前必须理解以下核心协议（详见 `specs/` 目录）：

- **Blueprint Protocol**: 定义了 InDesign 母版信息的 JSON 结构，作为系统的单一真理源（Single Source of Truth）。
- **Template Reference Protocol**: 定义了如何将 Blueprint 转换为 AI 易读的 HTML 模板格式，包含 `<template>` 标签及用法注释。
- **Free Page Protocol**: 定义自由页的 HTML 语法，包括 `data-bounds` 坐标格式、`data-type` 元素类型、样式引用规则。
- **Validation Engine**: 定义了系统允许的合法操作边界。**严禁** AI 臆造不存在的母版名称或槽位 ID。

## 5. 技术栈 (Tech Stack)
- **Host**: Adobe InDesign (ExtendScript / JSX)
- **Controller**: Node.js (TypeScript/JavaScript)
- **Core Libraries**:
    - `cheerio`: 用于服务器端 HTML 解析与操作。
    - `json2`: 用于 ExtendScript 环境下的 JSON 处理（如需）。

## 6. 已知技术坑 (Known Technical Issues)

### 6.1 InDesign Override 坐标偏移 BUG
- **问题**：通过 `masterPageItem.override(page)` 方法将母版元素覆写到普通页面时，元素位置会发生意外偏移
- **原因**：这是 InDesign CS6 及以上版本的已知 BUG，与 `Page.masterPageTransform` 矩阵处理有关
- **解决方案**：在 override 后立即恢复原始 `geometricBounds`
- **参考**：Adobe 社区帖子 [forums.adobe.com/thread/1455184](https://community.adobe.com/t5/indesign-discussions/override-elements-by-script-problems/td-p/6072078)

### 6.2 ExtendScript 语法限制
- 不支持 ES6+ 语法（无 `let`/`const`、箭头函数、模板字符串）
- 数组无 `indexOf`、`forEach` 等方法，需手动实现
- 无原生 JSON 对象，需 polyfill 或手动拼接

## 7. 项目约定 (Conventions)
- **Script Label 是唯一真理**：InDesign 中未打标签的对象对系统是**不可见**的。
- **三级槽位匹配**：精确匹配 → 标准化匹配（去空格+小写）→ 简短名匹配（解析 `名称：XXX` 格式）

### 7.1 目录结构约定

```
project-root/
├── src/                          # Node.js 源码
│   ├── builder.js               # HTML → JSON 指令转换
│   ├── generator.js             # Blueprint → Reference HTML 生成
│   ├── spec-generator.js        # Blueprint → AGENT_SPEC.md 规范生成
│   └── validator.js             # HTML 校验引擎
│
├── _indesign_scripts/            # InDesign ExtendScript 脚本
│   ├── extract_blueprint.jsx    # 核心：提取 Blueprint JSON
│   ├── build_from_instructions.jsx  # 核心：构建 InDesign 页面
│   └── _debug/                  # 调试脚本（归档，可删除）
│
├── test/                         # 测试与参考文件
│   ├── artifacts/               # 从 InDesign 提取的原始数据
│   │   └── blueprint.json       # 当前模板的 Blueprint（唯一真理源）
│   ├── reference/               # generator.js 生成的参考 HTML
│   │   ├── index.html          # 模板索引页
│   │   ├── all-templates.html  # 全模板单页预览
│   │   ├── A-封面.html          # 各母版独立预览（按母版名命名）
│   │   └── AGENT_SPEC.md       # AI Agent 约束规范文档
│   └── workspace/               # 临时工作区（在 .gitignore 中）
│       ├── content.html        # AI 生成的内容 HTML（约定名称）
│       └── instructions.json   # builder 生成的构建指令（约定名称）
│
├── docs/                         # 项目文档
└── openspec/                     # OpenSpec 规范管理
```

### 7.2 文件命名约定

| 文件类型 | 命名规则 | 示例 |
|----------|----------|------|
| Blueprint JSON | `blueprint.json` | `test/artifacts/blueprint.json` |
| 参考 HTML（单模板） | `{母版名}.html` | `A-封面.html`, `F-自由页.html` |
| 参考 HTML（全部） | `all-templates.html` | - |
| AI 约束规范 | `AGENT_SPEC.md` | `test/reference/AGENT_SPEC.md` |
| AI 生成内容 | `content.html` | 约定的固定名称 |
| 构建指令 | `instructions.json` | 约定的固定名称（InDesign 自动读取） |

### 7.3 测试工作流

```bash
# 1. 从 InDesign 提取 Blueprint（在 InDesign 中运行脚本）
#    输出: test/artifacts/blueprint.json

# 2. 生成参考 HTML 和 AI 规范
node src/generator.js test/artifacts/blueprint.json test/reference

# 3. AI 编写内容 HTML（参考 test/reference/ 中的文件）
#    输出: test/workspace/content_xxx.html

# 4. 校验 HTML
node src/validator.js test/workspace/content.html test/artifacts/blueprint.json

# 5. 生成构建指令（输出到约定路径，InDesign 会自动读取）
node src/builder.js test/workspace/content.html test/artifacts/blueprint.json test/workspace/instructions.json

# 6. 在 InDesign 中执行构建（运行 build_from_instructions.jsx，自动读取 instructions.json）
```