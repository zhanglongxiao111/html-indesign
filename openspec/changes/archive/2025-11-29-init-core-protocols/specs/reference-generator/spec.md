## ADDED Requirements

### Requirement: Visual Fidelity Generation
生成器 SHALL 将 Blueprint JSON 转换为高保真的 HTML 预览，确保视觉效果尽可能接近 InDesign 原貌。

#### Scenario: 渲染文本槽位
- **WHEN** 渲染一个文本槽位
- **THEN** 必须应用对应的 CSS 样式（字体、大小、颜色）
- **AND** 必须显示 InDesign 中的原始文本内容（Placeholder Text）
- **AND** 必须隐藏机器可读的 Script Label（仅保留在 data-slot 属性中）
- **AND** 必须确保槽位层级（z-index）高于背景静态元素

### Requirement: Multi-File Output
生成器 SHALL 为每个 InDesign 母版生成独立的 HTML 文件，并生成一个索引页。

#### Scenario: 输出文件结构
- **WHEN** 处理包含 "Cover" 和 "Inner" 两个母版的蓝图
- **THEN** 输出目录必须包含 `Cover.html`, `Inner.html` 和 `index.html`
- **AND** 文件名必须经过清洗，去除非法字符但保留中文语义
