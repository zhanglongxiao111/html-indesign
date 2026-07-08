# 任务：writer 与 audit 迁移重复代码审计

## 背景

本轮重构把部分脚本算法迁入 `src/writers/html/audit/`、`src/writers/indesign/audit/`，脚本应变成薄 CLI。需要确认是否真的迁移并退役旧实现，而不是 script 和 src 各保留一份算法。

## 目标

审计 writer/audit 增长是否来自必要模块化，找出重复算法、旧脚本残留、兼容双路径、静默兜底和可删代码。

## 范围

- `src/writers/html/audit/`
- `src/writers/indesign/audit/`
- `src/writers/html/`
- `src/writers/indesign/`
- `scripts/audit-*.js`
- `scripts/indesign-e2e.js`
- `scripts/indesign-reverse-export.js`
- 相关测试：`test/indesign-to-html/`、`test/html-to-indesign/`、`test/indesign-e2e-runner.test.js`

## 硬约束

- 只读审计，不得修改代码、测试、配置、git index 或 HEAD。
- 只允许写自己的报告：`docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/报告_writer与audit迁移重复代码审计.md`
- 不得调用子 agent。
- 不跑真实 InDesign E2E。
- 严格执行项目原则：兜底默认有害；脚本不得继续承载已迁入 src 的核心算法；退役代码必须清理；视觉偏差和假成功不能靠末端补丁掩盖。

## 建议命令

- `git diff --numstat 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/writers scripts`
- `git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- scripts src/writers`
- `rg "function |module.exports|require\\(" scripts src/writers/html/audit src/writers/indesign/audit`
- `rg "fallback|default|try|catch|process.exit\\(0\\)|warning" scripts src/writers`

## 报告要求

报告必须包含：

- 当前结论：迁移干净 / 存在重复实现 / 存在旧算法残留。
- 证据：文件行号、命令结果摘要。
- 风险分级：P0/P1/P2/none。
- 可删候选：每项说明删除位置、原因、风险和验证命令。
- 不可删理由：对主要新增 audit 模块说明为什么应保留。
- 是否需要沉淀为长期规范。
