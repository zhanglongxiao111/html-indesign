# 任务：public API 与孤儿模块退役审计

## 背景

代码行数增长可能来自新模块增加但旧模块、旧 public facade 或孤儿模块未清理。需要从入口、导出、require graph 和退役目录角度确认。

## 目标

审计 public API、模块图、旧目录和 orphan modules，确认没有旧 facade、旧目录、孤儿模块或测试-only 假入口导致的增长。

## 范围

- `index.js`
- `src/**/index.js`
- `src/indesign-cli-plugin/tools/`
- `src/indesign-pipeline/`
- `src/reverse-pipeline/`
- `test/architecture/orphan-modules.test.js`
- `test/public-api.test.js`
- `test/protocol/baseline-imports.test.js`

## 硬约束

- 只读审计，不得修改代码、测试、配置、git index 或 HEAD。
- 只允许写自己的报告：`docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/报告_public-api与孤儿模块退役审计.md`
- 不得调用子 agent。
- 不跑真实 InDesign E2E。
- 严格执行项目原则：旧公共入口不得恢复；退役模块不得通过 public API、plugin tool 或 require graph 存活；插件只暴露正式 html.* 工具。

## 建议命令

- `node --test test/architecture/orphan-modules.test.js test/public-api.test.js test/protocol/baseline-imports.test.js`
- `rg "pagedHtml|indesignReverse|historicalTemplate|paged-html|indesign-reverse|legacy" index.js src test`
- `git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- index.js src/indesign-cli-plugin src/indesign-pipeline src/reverse-pipeline test/public-api.test.js test/protocol/baseline-imports.test.js`

## 报告要求

报告必须包含：

- 当前结论：退役入口清理完成 / 存在旧入口残留 / 存在孤儿模块风险。
- 证据：文件行号、命令结果摘要。
- 风险分级：P0/P1/P2/none。
- 可删候选：孤儿或准孤儿模块列表。
- 不可删理由：对新增 pipeline/public entry 的保留理由。
- 是否需要沉淀为长期规范。
