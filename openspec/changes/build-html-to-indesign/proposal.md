# Change: Build HTML to InDesign

## Why
我们已完成蓝图提取、参照生成和校验，但缺少将通过校验的 content.html 落地到 InDesign 的构建步骤。需要定义统一的构建指令格式，并实现 HTML → 指令 → JSX 执行的端到端流程。

## What Changes
- 定义 HTML → 构建指令的中间格式（页级 master、槽位填充、自由页动态元素），支持“整合 HTML 演示文稿”一次包含多页并按顺序输出指令。
- 实现 Node 侧 builder：解析通过校验的合并版 HTML（含多 section），生成有序的构建指令 JSON（按 HTML 顺序）。
- 实现 InDesign JSX 执行器：根据指令按序追加页面（不删除旧页面），套用对应母版并填充槽位；自由页支持动态新建元素。
- 提供端到端示例与测试（content.html → 指令 → InDesign 执行），确保结果可见。

## Impact
- 受影响规范：新增 build-engine 能力。
- 受影响代码：
  - `src/builder.js`（新）：HTML → 指令生成器。
  - `_indesign_scripts/build_from_instructions.jsx`（新）：执行构建指令。
  - 测试/示例：`test/output_build/`（端到端产物）。
