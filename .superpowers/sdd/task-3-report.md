# Task 3 Report - G3 / G4 / G5 / G7 / G8 Guardrails

## 改动文件

- `test/architecture/semantic-model-contract.test.js`
- `test/architecture/audit-fail-closed.test.js`
- `test/architecture/retired-naming.test.js`
- `test/architecture/docs-code-sync.test.js`
- `test/architecture/orphan-modules.test.js`
- `test/architecture/baselines/G3.json`
- `test/architecture/baselines/G4.json`
- `test/architecture/baselines/G5.json`
- `test/architecture/baselines/G7.json`
- `test/architecture/baselines/G8.json`
- `test/architecture/index.js`
- `test/architecture/require-graph.test.js`
- `test/architecture/helpers/require-graph.js`

## Baseline 条目数量

- G3: 108
- G4: 9
- G5: 74
- G7: 5
- G8: 6

## 验证

- `node --test test/architecture/`: pass, 36/36 tests.
- `npm test`: pass, 794/794 tests.

## 备注

- G3 字段同构和未登记字段扫描使用 `src/protocol` registry 与 `scanModelPaths` 生成字段面，不手抄字段矩阵。
- G4 对 `scripts/audit-*.js` 做 invalid-input 测试命名约定扫描，并对子进程无输入场景做非零退出码检查。
- G5 扫描退役命名路径和代码/配置内容，保留 `docs/legacy/`、`legacy-label` 观察标签和 protocol lifecycle 词表边界。
- G8 复用真实 require graph collector；本轮补了 spread `...require()` 的静态边识别，避免把 registry spread require 误判为孤儿模块。
