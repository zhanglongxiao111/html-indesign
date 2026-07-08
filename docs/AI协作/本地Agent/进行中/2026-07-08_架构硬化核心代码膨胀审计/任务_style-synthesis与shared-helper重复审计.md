# 任务：style-synthesis 与 shared helper 重复审计

## 背景

本轮重构将 style synthesis 和通用 helper 从 writer / adapter / script 中抽出。需要确认抽取后旧实现已经退役，没有形成一套 shared、一套本地 helper 的重复。

## 目标

审计 `src/style-synthesis/`、`src/shared/` 和相关调用点，确认 helper 单一来源、命名边界清晰、没有为了过 guardrail 而移动重复代码。

## 范围

- `src/style-synthesis/`
- `src/shared/`
- `src/writers/indesign/`
- `src/writers/html/`
- `src/adapters/html/`
- 相关测试：`test/architecture/single-implementation.test.js`、`test/shared/`、`test/semantic-model/synthesized-styles.test.js`

## 硬约束

- 只读审计，不得修改代码、测试、配置、git index 或 HEAD。
- 只允许写自己的报告：`docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/报告_style-synthesis与shared-helper重复审计.md`
- 不得调用子 agent。
- 不跑真实 InDesign E2E。
- 严格执行项目原则：共享逻辑必须单一来源；不得保留旧 helper 双路径；不得靠本地兜底掩盖翻译层缺陷。

## 建议命令

- `git diff --summary 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/style-synthesis src/shared src/writers src/adapters`
- `rg "function normalize|function clean|function parse|bordersAreUniform|parseZIndex|normalizeLineEndings|collapseWhitespace" src`
- `node --test test/architecture/single-implementation.test.js test/shared/style-utils.test.js test/shared/text.test.js`

## 报告要求

报告必须包含：

- 当前结论：单一来源成立 / 存在重复实现 / 存在可合并 helper。
- 证据：文件行号、命令结果摘要。
- 风险分级：P0/P1/P2/none。
- 可删候选：每项说明删除风险和覆盖测试。
- 不可删理由：说明哪些 helper 拆出后降低了重复或改善边界。
- 是否需要沉淀为长期规范。
