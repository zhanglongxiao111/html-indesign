# Change: Init Core Protocols

## Why
目前 InDesign 与 AI Agent 之间缺乏统一的数据交换标准。AI 容易生成不存在的母版页或错误的槽位名称，导致 InDesign 脚本运行失败。我们需要建立一套“硬约束”协议，确保 AI 生成的 HTML 是可被 InDesign 精确解析的。

## What Changes
- 新增 **Blueprint Protocol** 能力：定义 InDesign 导出的 JSON 蓝图结构及 HTML 标记规范。
    - **核心升级**：支持完整样式提取（段落/字符/对象样式）及 CSS 映射，支持无标签静态元素的提取。
- 新增 **Validation Engine** 能力：定义校验逻辑，确保 HTML 与 Blueprints 的一致性。
- 新增 **Reference Generator** 能力：实现 `JSON -> HTML` 转换器，验证 JSON 数据的视觉还原能力，并为 AI 提供可视化的填空模板。

## Impact
- **受影响规范**：无（全新能力）。
- **受影响代码**：
    - `_indesign_scripts/extract_blueprint.jsx`: 需实现复杂的样式解析与 CSS 生成算法。
    - `src/types/blueprint.ts`: 需扩展以容纳 Style Registry 和 Static Items。
    - `src/validator.js`: 需适配新的 JSON 结构。
    - `src/generator.js`: **[NEW]** 实现 HTML 渲染逻辑。
