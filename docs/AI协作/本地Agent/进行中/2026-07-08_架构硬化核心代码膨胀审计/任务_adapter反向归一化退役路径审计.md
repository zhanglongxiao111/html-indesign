# 任务：adapter 反向归一化退役路径审计

## 背景

本轮重构重点之一是清理 raw dialect 和退役字段，尤其是 `label.type/token`、旧 `item.type`、`sourceType` 被错误用于 current semantic 的问题。需要确认 adapters 中没有新旧双路径继续生效。

## 目标

只读审计 HTML/InDesign adapters 的反向归一化、标签白名单、snapshot-to-model、blueprint migration，确认退役字段只作为观察或迁移事实，不进入当前结构化模型决策。

## 范围

- `src/adapters/html/`
- `src/adapters/indesign/`
- `src/semantic-reconstruction/`
- `src/writers/html/author-package-writer.js` 中消费 adapter 输出的相关路径
- 相关测试：`test/indesign-to-html/reverse-model.test.js`、`test/indesign-to-html/label-whitelist.test.js`、`test/semantic-reconstruction/`

## 硬约束

- 只读审计，不得修改代码、测试、配置、git index 或 HEAD。
- 只允许写自己的报告：`docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/报告_adapter反向归一化退役路径审计.md`
- 不得调用子 agent。
- 不跑真实 InDesign E2E。
- 严格执行项目原则：旧标签只能观察或迁移；白名单外语义不得参与结构化编译；退役字段不得继续进入 current model 或 writer decision path。

## 建议命令

- `rg "label\\.type|label\\.token|item\\.type|sourceType|effectiveLabel|observedLabel|roleFromInDesignType" src/adapters src/semantic-reconstruction src/writers/html test/indesign-to-html test/semantic-reconstruction`
- `git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/adapters src/semantic-reconstruction src/writers/html/author-package-writer.js`
- 可运行 targeted tests，但要记录命令和结果。

## 报告要求

报告必须包含：

- 当前结论：退役路径已清 / 存在观察路径但合理 / 存在运行路径风险。
- 证据：文件行号、命令结果摘要。
- 风险分级：P0/P1/P2/none。
- 可删候选：明确是否是运行路径、测试路径、迁移路径或观察报告路径。
- 不可删理由：对保留 `sourceType` 等观察字段说明边界。
- 是否需要沉淀为长期规范。
