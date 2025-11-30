## ADDED Requirements

### Requirement: Blueprint JSON Structure (Advanced)
系统 SHALL 生成包含完整视觉信息的 JSON 蓝图，支持样式表（Styles）和静态元素（Static Items）。

#### Scenario: 导出样式和静态元素
- **WHEN** 扫描包含特定段落样式的母版
- **THEN** 输出 JSON 必须包含分栏样式注册表：`paragraphStyles`（段落样式 CSS）、`characterStyles`、`objectStyles`
- **AND** 每个母版必须包含 `staticItems` 数组（无 Label 的装饰元素）
- **AND** 每个母版必须包含 `slots` 对象（有 Label 的交互元素），且 Slot 需引用对应的段落样式名称
- **AND** 所有文本对象（无论是否为 Slot）必须包含 `content` 字段以支持高保真预览

### Requirement: Extraction Strategy
蓝图提取器 SHALL 提取页面上的所有可视元素，构建 Style Registry。
- **Styles**: 遍历文档所有段落样式，转换为 CSS 规则。
- **Items**: 遍历所有 PageItem，提取位置、类型、内容及应用样式。
- **Colors**: 将 InDesign 颜色空间转换为 Web Hex。

#### Scenario: 全量提取并记录样式引用
- **WHEN** 扫描任意母版页的所有 PageItem
- **THEN** 每个 PageItem MUST 带有其 `type`、`bounds`、`content`（文本为空也需输出）以及 z-index 信息
- **AND** 文本类 PageItem MUST 记录 `appliedParagraphStyle`，并在样式注册表中存在对应条目
- **AND** 所有提取到的颜色 MUST 转换为 Web Hex 形式后写入相关 CSS 或属性

### Requirement: Build Instruction Schema
系统 SHALL 定义一套中间 JSON 指令格式，用于将解析后的 HTML 转换为 InDesign 可执行的操作。

#### Scenario: 生成构建指令
- **WHEN** 解析器处理完校验通过的 HTML
- **THEN** 它必须生成一个包含有序操作列表的 JSON
- **AND** 每个操作项必须包含 `action` ("createPage"), `master`, `items` (填充数据)
- **AND** 填充数据必须将 Label 映射到具体内容 (文本字符串或图片路径)
