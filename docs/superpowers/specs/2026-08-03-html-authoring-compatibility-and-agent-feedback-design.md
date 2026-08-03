# 通用 HTML 编写兼容与 Agent 反馈设计

## 1. 目标

让 Agent 可以优先使用正常、自然、可在浏览器预览的 HTML，而不需要先背完 `html-indesign` 的所有协议字段。

系统对含义唯一、可逆、可验证的常见 HTML 写法自动归一化；对无法可靠判断、可能造成内容或视觉错误的写法明确阻断。统一 Skill 负责在创作前说明规则，CLI 负责在 lint、compile 和 build 阶段返回位置、原因、已做处理和可直接采用的修改建议。

本设计不支持任意网页完整还原，不修改作者源 HTML，不通过静默兜底掩盖语义缺失，也不新增协议字段的第二事实源。

## 2. 核心原则

1. **自然 HTML 优先。** 原生语义标签、标准资源属性和常用 CSS 是首选输入，不要求为转换写反常 DOM。
2. **只自动处理确定事实。** 自动归一化必须含义唯一、不会改变浏览器显示、能够写入统一语义模型，并能通过真实 InDesign 回读验证。
3. **有歧义就阻断。** 缺少稳定身份、存在多个候选资源、裁切或图层关系无法判断时，不猜测结果。
4. **所有处理可见。** 自动归一化也要进入 CLI 反馈，说明检测到的 HTML、生成的 canonical 事实和建议的显式写法。
5. **不修改作者源码。** 本轮只在 HTML adapter 到统一语义模型的读入边界归一化；CLI 提供建议，不自动改写文件。
6. **规则共用。** 兼容规则使用稳定 rule code；adapter、lint、compile、build、规范文档和统一 Skill 使用同一名称和含义。

## 3. 三档处理

### 3.1 原生支持

正常 HTML 本来就足够明确时直接读取，不要求额外协议字段：

- `h1`–`h6`、`p`、文本叶节点读取为文字；
- `figure + figcaption` 保留图文结构；
- `ul/ol/li` 保留列表内容和顺序；
- 原生 `table` 保留表格语义；
- `img[src]`、`object[data]`、外部 `svg` 和 CSS `background-image` 读取真实资源；
- CSS padding 可作为页面边距，CSS Grid 可作为页面网格；
- CSS Grid、Flex 和普通流式布局由浏览器快照提供最终几何，转换层不要求作者改写成绝对定位。

这类输入只在存在风险或需要长期回读保护时提示，不为每个正常标签制造噪声。

### 3.2 安全归一化

以下事实可在含义唯一时自动转成 canonical 字段，同时返回非阻断反馈：

- 根据真实资源路径后缀推断图片、PDF、PSD、AI、SVG 类型；显式类型与确定后缀冲突时，以真实资源为准并警告；
- 根据 CSS `object-fit`、`object-position` 和已支持的背景尺寸事实生成置入方式；
- `object[data]` 内唯一的回退 `img` 识别为浏览器预览，不编译成第二个资源；
- 普通容器只有一个真实 `img/object/svg` 子资源时，将容器上的图框/置入意图绑定到该资源图框，但不伪造第二份资源；
- 没有显式角色的文本叶节点、资源节点和只负责容纳子对象的结构节点，分别归一化为 text、graphic 和 container；
- InDesign 对 AI 的 PDF 式页面观察继续归一化为 canonical artboard。

安全归一化不修改 HTML 文件。CLI 返回建议写法，Agent 可以在需要稳定回环或长期维护时把建议写回作者源码。

### 3.3 必须阻断

以下情况不能安全推断：

- 页面或需要长期追踪的对象没有稳定 ID；
- 一个 wrapper 对应多个候选资源，无法判断协议字段属于谁；
- `manual` 裁切缺少完整内容几何；
- PDF 页码、AI 画板或 PSD 图层选择存在冲突；
- 带填充祖先位于嵌套资源之上的 InDesign 图层；
- 可见文本无法归属到独立文字对象；
- 不支持的 CSS、伪元素、Canvas、动态脚本或远程运行时会造成内容丢失；
- 自动判断会改变浏览器视觉、作者结构或 canonical 图层事实。

阻断反馈必须包含 rule code、页面、对象、原因、需要修改的文件（可确定时）和可复制的 HTML/CSS 示例。CLI 不建议用相同输入重试。

## 4. 架构

### 4.1 兼容规则目录

在 `src/adapters/html/compatibility/` 维护 HTML 输入兼容规则和归一化逻辑。规则只能引用 `src/protocol/` 已登记字段，不得定义新的字段 allowlist 或格式能力矩阵。

每条规则至少包含：

- 稳定 `code`；
- 检测到的 source pattern；
- 处理等级：`native`、`normalized` 或 `blocked`；
- canonical 结果；
- 人类可读说明；
- `suggestedFix`；
- Skill 中对应的规则主题。

HTML adapter 在生成统一语义模型前应用规则，并把归一化 provenance 附加到本次报告，不污染 canonical 文档字段。

### 4.2 统一反馈结构

lint、compile 和 build 共用以下概念结构：

```json
{
  "compatibility": {
    "summary": {
      "normalized": 2,
      "warnings": 1,
      "blocked": 0
    },
    "messages": [
      {
        "level": "warning",
        "code": "HTML_ASSET_KIND_INFERRED",
        "pageId": "site-plan",
        "itemId": "site-plan-ai",
        "message": "Resource type was inferred from site-plan.ai.",
        "suggestedFix": "Add data-id-asset-kind=\"ai\" to the object element.",
        "ruleRef": "assets/resource-kind"
      }
    ]
  }
}
```

最终字段名在实施时进入现有 CLI 输出 contract 测试，不新增与 `errors`、`warnings`、`report` 平行且含义重复的第二套诊断系统。`compatibility` 是现有消息的汇总视图和 provenance，不替代原报告。

### 4.3 CLI 行为

- `html.authoring_lint`：返回所有自动归一化、建议和阻断项；严格模式允许安全归一化通过，不再把这类提示升级为错误。
- `html.compile_instructions`：复用 lint 产生的同一批消息，并在 compile summary 中记录归一化数量；不得重新实现一套判断。
- `html.build_indesign`：构建前复用严格 lint 和 compile 结果；成功结果携带非阻断反馈，失败结果在 `error.details` 中保留完整定位和建议。
- `html.reverse_export`：不负责猜测正向普通 HTML；它继续输出明确 canonical 作者包，并保留观察事实。

CLI 的第一条错误消息保持简短，但报告 artifact 必须包含全部问题。Agent 能从返回值直接知道下一步，不需要先打开源码寻找错误含义。

## 5. Skill 与规范

统一发布源 `D:/AI/mcp-indesign/skills/indesign-cli/` 增加“普通 HTML 如何被理解”章节：

- 首先按正常 HTML 和 CSS 编写；
- 列出原生支持、安全归一化和必须显式声明的边界；
- 说明先运行 `html.authoring_lint`，读取所有反馈后再构建；
- 提供图片、PDF/AI、figure、表格、文字容器、Grid/Flex 和 fallback preview 的最小示例；
- 明确自动归一化不等于源 HTML 零漂移。需要承诺源码回环稳定时，Agent 应把 CLI 建议写回作者包后重新检查。

长期原则同步进入 `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md`。详细 rule code 由代码目录和生成/测试后的报告维护，Skill 不复制一份容易过期的全量字段表。

## 6. 数据流

```text
普通 HTML/CSS
  -> 浏览器快照
  -> HTML compatibility rules
       -> native facts
       -> safe normalized facts + visible feedback
       -> blocked diagnostics + suggested fix
  -> HTML adapter
  -> unified semantic model
  -> InDesign writer / validator
  -> CLI lint / compile / build response and report artifacts
```

安全归一化生成的 provenance 只服务本次诊断和审计。canonical model 继续使用 `src/protocol/` 的正式字段，writer 和 executor 不读取 HTML 特有兼容分支。

## 7. 验证

1. 为每条新增兼容规则先写失败测试，再实现最小归一化。
2. 使用自然 HTML fixture 覆盖语义标签、普通 wrapper、唯一资源、object fallback、CSS Grid/Flex、表格和文字容器。
3. 验证含义唯一的输入能通过严格 lint，CLI 返回具体归一化反馈。
4. 验证多资源 wrapper、缺少 manual 几何、跨层遮挡和不可归属文字仍然失败，并返回可操作建议。
5. 验证 lint、compile 和 build 对同一问题使用相同 code、位置和说明。
6. 运行全量 `npm test`、插件校验和打包预检。
7. 使用真实 InDesign E2E 验证至少一个自然 HTML 资源案例，确认浏览器预览、instructions、InDesign 回读和导出均未回退。
8. 用更新前后的统一 Skill 做无答案泄漏的 Agent 前向测试，确认 Agent 会先写自然 HTML、运行 lint、读取反馈并修正阻断项。

## 8. 非目标

- 不支持任意网页抓取或完整 CSS 浏览器复刻。
- 不自动改写作者 HTML、CSS 或资源文件。
- 不为某个模型或某次会话建立专用兼容分支。
- 不允许 writer、executor 或 fixture 私自新增同义字段。
- 不把自动推断当作源码零漂移证明。
