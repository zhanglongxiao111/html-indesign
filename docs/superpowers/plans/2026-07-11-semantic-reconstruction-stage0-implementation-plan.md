# 语义重建阶段 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan stage by stage. Do not enable multi-agent unless the user explicitly requests it. Checkboxes track stage-level work; this plan intentionally omits pseudocode and minute-level steps.

**Goal:** 完成语义重建路线图 0A–0F，让现有结构重建 pass 在统一 profile 下安全、幂等地进入真实 InDesign 反向链路，并以同一份 47 页人类文件门禁证明可以默认启用。

**Architecture:** 先冻结 observed-only 基线，再修 trusted-source 与 fail-closed；随后收口 pass 幂等和阅读顺序、建立唯一 profile 解析器、完成 synth 属性级残差去重，最后用真实门禁把已验证列表从 `experimental` 提升为 `safe`。底层 pipeline 只消费解析后的有序算法列表，CLI、E2E 和插件不得各自维护默认列表。

**Tech Stack:** Node.js CommonJS、`node:test`、现有 reverse pipeline、InDesign CLI host action、现有 author/effective-diff/conversion-gate 审计。

## Global Constraints

- 事实源是 `docs/superpowers/specs/2026-07-06-semantic-reconstruction-algorithm-roadmap.md`；本计划只覆盖 0A–0F，不提前实施 A–F。
- 新字段必须先进入 `src/protocol/`；阶段 0 原则上只新增运行参数和 pass 报告，不新增 canonical 文档字段。
- 写回 pass 不得改动 `labelStatus: "accepted"` 且带 `sourceNode` 的结构；审计失败必须让所有正式入口失败。
- 所有实现按测试先行：先增加能复现当前缺陷的失败测试，再改生产代码。
- 客户文件路径、名称和内容不得写入 Git；真实产物只放 `test/workspace/semantic-reconstruction-stage0/`。
- 每个阶段单独收口和提交；前一阶段验证未通过，不进入下一阶段。
- 不通过关闭 pass、换顺序、保留双默认路径或放宽门禁预算恢复绿色。

---

## Planned File Map

新增：

- `src/semantic-reconstruction/profiles.js`：唯一 profile、依赖闭包、去重和规范排序。
- `src/semantic-reconstruction/reading-order-lite.js`：独立 reading-order-lite pass 与报告。
- `src/writers/html/author-style-residual.js`：CSS 声明规范化、synth 覆盖判断和 inline 残差计算。
- `test/semantic-reconstruction/reading-order.test.js`：阅读顺序、trusted 混排和幂等测试。
- `docs/review/2026-07-11-semantic-reconstruction-stage0.md`：0A 基线、各阶段结果和 0F 准入结论。

主要修改：

- `src/semantic-reconstruction/reconstruct.js`
- `src/semantic-reconstruction/index.js`
- `src/semantic-reconstruction/caption-structure.js`
- `src/semantic-reconstruction/figure-grid.js`
- `src/semantic-reconstruction/text-block.js`
- `src/semantic-reconstruction/reading-order.js`
- `src/reverse-pipeline/index.js`
- `scripts/indesign-reverse-export.js`
- `scripts/indesign-e2e.js`
- `src/indesign-cli-plugin/tool-catalog.js`
- `src/indesign-cli-plugin/tools/reverse-export.js`
- `src/writers/html/author-style-attrs.js`
- `src/writers/html/author-css-writer.js`
- 对应 `test/semantic-reconstruction/`、`test/indesign-to-html/`、`test/indesign-cli-plugin/` 和 `test/indesign-e2e-runner.test.js`

## 0A：冻结可复现基线

**目标：** 在不启用重建算法的条件下，把当前绿色状态保存成后续候选运行必须复用的机器证据。

- [x] 确认本机已设置 `$env:HUMAN_INDD_GATE_SOURCE`，值指向当前 47 页门禁源文件；路径不写入任何仓库文件。
- [x] 用当前 observed-only 行为运行真实人类文件 E2E，输出到 `test/workspace/semantic-reconstruction-stage0/baseline/`。
- [x] 生成 author-editability、reverse-visual、reverse-snapshot stability 和 effective-diff 报告。
- [x] 写入本地 `conversion-gate.case.json`：`requiredGates` 固定为 `editability`、`trustedSource`、`stability`；P0、HTML 缺失、HTML 文本和页面差异预算为 0；P1 与 HTML 几何预算固定为人工复核后的 baseline 实值。
- [x] 在 review 文档记录 Git commit、页数、对象数、资源数、算法列表为空、六份回环报告和 conversion gate 结果；不记录客户路径和内容。

验证：

```powershell
npm test
npm run e2e:indesign -- -- --indd $env:HUMAN_INDD_GATE_SOURCE --run-dir test/workspace/semantic-reconstruction-stage0/baseline
npm run audit:author-editability -- -- --author-root test/workspace/semantic-reconstruction-stage0/baseline/reverse-html/author --out test/workspace/semantic-reconstruction-stage0/baseline/author-editability-report.json
npm run audit:reverse-snapshot -- -- --expected test/workspace/semantic-reconstruction-stage0/baseline/generated-author-e2e/reverse-snapshot.json --actual test/workspace/semantic-reconstruction-stage0/baseline/generated-author-e2e/second-pass/reverse-snapshot.json --out test/workspace/semantic-reconstruction-stage0/baseline/reverse-snapshot-audit.json
npm run audit:effective-diff -- -- --expected test/workspace/semantic-reconstruction-stage0/baseline/reverse-snapshot.json --actual test/workspace/semantic-reconstruction-stage0/baseline/generated-author-e2e/reverse-snapshot.json --stability-audit test/workspace/semantic-reconstruction-stage0/baseline/reverse-snapshot-audit.json --out test/workspace/semantic-reconstruction-stage0/baseline/effective-diff-report.json
npm run audit:reverse-visual -- -- --reverse-html test/workspace/semantic-reconstruction-stage0/baseline/reverse-html --out test/workspace/semantic-reconstruction-stage0/baseline/reverse-visual-report.json
npm run audit:conversion-gate -- -- --case test/workspace/semantic-reconstruction-stage0/baseline/conversion-gate.case.json --out test/workspace/semantic-reconstruction-stage0/baseline/conversion-gate-report.json
```

**完成条件：** 全部命令退出 0；`reconstruction-report.json` 为 `observed-only`；baseline 文件齐全且 review 文档可复核。

## 0B：trusted-source 与 fail-closed

**目标：** 任何结构 pass 都不能改可信作者结构；只要审计失败，底层 pipeline、CLI、插件和 E2E 必须统一失败。

- [x] 在 `test/semantic-reconstruction/reconstruct.test.js` 增加“trusted 页级对象没有 order，旁边非 trusted 对象触发分组”的失败测试，证明当前 helper 会误写 `structure.order`。
- [x] 修改共享排序/分组调用，保证 trusted 对象字段和相对顺序保持原样；补混合 trusted/untrusted 正反例。
- [x] 修改 `src/reverse-pipeline/index.js`，把 `trustedSourcePreservation.ok` 合并进最终 `ok`，缺失或非 `true` 均 fail-closed。
- [x] 补 CLI、插件 resume 和 E2E 回归，证明失败报告不能被包装成成功状态。

验证：

```powershell
node --test "test/semantic-reconstruction/**/*.test.js"
node --test "test/indesign-to-html/cli.test.js" "test/indesign-cli-plugin/plugin-tools.test.js" "test/indesign-e2e-runner.test.js"
npm test
```

**完成条件：** trusted 变异测试由红转绿；所有入口对同一失败证据返回失败；现有 1033 项基线无回退。

## 0C：pass 幂等与 reading-order-lite

**目标：** 五个目标 pass 各自可重复执行，组合运行两次也不改变模型；阅读顺序成为显式、可报告的最后一步。

- [x] 为 `caption-structure` 增加同一模型连续运行两次的失败测试，固定当前图注 order 从 1 变 2 的缺陷。
- [x] 修复同一 figure/caption 已建立父子关系时的处理：第二次运行记录为已满足或 skipped，不再次增加 order。
- [x] 新建 `reading-order-lite` pass，排序键固定为 `(y, x, originalIndex)`，处理无 bounds、相同坐标、宽页面和 trusted 混排。
- [x] 从 `figure-grid.js`、`text-block.js` 移除隐式全页排序；在 `reconstruct.js` 注册 reading-order-lite，并让它在所有结构写回后执行。
- [x] 增加四个已落地 pass、reading-order-lite 和目标组合列表的模型级双跑字节稳定测试。

验证：

```powershell
node --test "test/semantic-reconstruction/**/*.test.js"
npm test
```

**完成条件：** 每个 pass 和组合列表双跑后模型逐字节一致；pass 报告准确区分 applied/skipped；trusted-source 审计保持通过。

## 0D：统一 reconstruction profile 与入口

**目标：** `none / experimental / safe`、依赖和执行顺序只定义一次，并在 snapshot CLI、`--indd`、插件和底层 pipeline 中一致生效。

- [ ] 新建 `profiles.js`，集中定义规范顺序、依赖闭包、去重、未知名称拒绝以及 profile 解析结果。
- [ ] 规范顺序固定为 `page-object-graph → caption-structure → figure-grid → text-block → reading-order-lite`；重复名称只执行一次，缺失依赖自动补齐后按规范顺序执行。
- [ ] 底层 `compileReverseSnapshotToHtml` 必须收到显式 `reconstructionProfile`；不再把缺参静默解释为空列表。
- [ ] CLI 新增 `--reconstruction-profile none|safe|experimental`；`--reconstruct` 仅在 experimental 下有效。
- [ ] E2E 参数、递归第二轮、插件 schema、state 和 resume 全量透传相同字段；0F 前用户入口默认解析为 `none`，`safe` 列表暂不包含未准入 pass。
- [ ] 更新帮助文本和测试，删除各入口自带的第二份默认列表或排序逻辑。

验证：

```powershell
node --test "test/semantic-reconstruction/**/*.test.js"
node --test "test/indesign-to-html/cli.test.js" "test/indesign-cli-plugin/plugin-tools.test.js" "test/indesign-e2e-runner.test.js"
npm run plugin:validate
npm test
```

**完成条件：** 四个入口对同一 profile 解析出相同有序列表；none 明确 observed-only；experimental 可显式运行目标列表；safe 不能包含未准入算法。

## 0E：synth 覆盖与 inline 残差

**目标：** 降低重复 item inline style，同时保证浏览器最终有效格式和 InDesign 回读事实不变。

- [ ] 先增加 CSS 级联负例：同一对象同时具有 synth 与 paragraph/object class，声明样式与 synth 在字号、行高、颜色或对齐上冲突；直接删除 inline 必须被测试判为视觉事实回退。
- [ ] 新建 `author-style-residual.js`，集中处理声明解析、单位/颜色/精度规范化、synth rule 存在性和属性级残差。
- [ ] 调整 `components.css` 输出顺序：声明式 paragraph/character/object style 在前，synth 在后。
- [ ] item inline 只删除被实际 synth rule 等价覆盖的属性；保留 source style、grid 变量、文本框属性、z-index、styleOverrides 和所有不同值残差。
- [ ] trusted source、rich-text run、table cell、vector 和 PDF wrapper 不进入本轮 item 级去重；找不到 synth rule 时保留并报告。
- [ ] 补作者包写出、结构签名、可编辑性计数和浏览器计算样式回归。

验证：

```powershell
node --test "test/indesign-to-html/author-style-attrs.test.js" "test/indesign-to-html/author-css-writer.test.js" "test/indesign-to-html/author-package-writer.test.js" "test/indesign-to-html/structure-signature.test.js" "test/indesign-to-html/author-editability-audit.test.js"
npm test
```

**完成条件：** 冲突 class 场景最终计算样式不变；inline 数量下降；结构签名、内容库存和现有视觉/写出测试无回退。

## 0F：真实门禁与 safe 提升

**目标：** 在真实 47 页文档上证明目标列表可发布，然后让所有用户入口统一默认 safe。

- [ ] 以 experimental 和目标有序列表运行 candidate，确保首轮和递归第二轮都实际携带同一 profile 与算法列表。
- [ ] 使用 0A 的同一 snapshot、预算和 required gates 生成 candidate 全套报告；不得更新 baseline 输入或放宽预算。
- [ ] 对比 author-editability：覆盖率不得下降，散落对象、inline 和低层几何不得增加；目标改善项写入 review 文档。
- [ ] 全部门禁通过后，把目标有序列表加入 safe；snapshot CLI、`--indd` 和插件默认 safe，诊断必须显式选择 none。
- [ ] 更新 `AGENTS.md`、路线图状态、插件帮助和 review 结论；不把真实源路径或客户内容写入文档。

验证：

```powershell
npm test
npm run e2e:indesign -- -- --indd $env:HUMAN_INDD_GATE_SOURCE --run-dir test/workspace/semantic-reconstruction-stage0/candidate --reconstruction-profile experimental --reconstruct page-object-graph,caption-structure,figure-grid,text-block,reading-order-lite
npm run audit:author-editability -- -- --author-root test/workspace/semantic-reconstruction-stage0/candidate/reverse-html/author --baseline test/workspace/semantic-reconstruction-stage0/baseline/author-editability-report.json --out test/workspace/semantic-reconstruction-stage0/candidate/author-editability-report.json
npm run audit:reverse-snapshot -- -- --expected test/workspace/semantic-reconstruction-stage0/candidate/generated-author-e2e/reverse-snapshot.json --actual test/workspace/semantic-reconstruction-stage0/candidate/generated-author-e2e/second-pass/reverse-snapshot.json --out test/workspace/semantic-reconstruction-stage0/candidate/reverse-snapshot-audit.json
npm run audit:effective-diff -- -- --expected test/workspace/semantic-reconstruction-stage0/baseline/reverse-snapshot.json --actual test/workspace/semantic-reconstruction-stage0/candidate/generated-author-e2e/reverse-snapshot.json --baseline test/workspace/semantic-reconstruction-stage0/baseline/effective-diff-report.json --stability-audit test/workspace/semantic-reconstruction-stage0/candidate/reverse-snapshot-audit.json --out test/workspace/semantic-reconstruction-stage0/candidate/effective-diff-report.json
npm run audit:reverse-visual -- -- --reverse-html test/workspace/semantic-reconstruction-stage0/candidate/reverse-html --out test/workspace/semantic-reconstruction-stage0/candidate/reverse-visual-report.json
npm run audit:conversion-gate -- -- --case test/workspace/semantic-reconstruction-stage0/candidate/conversion-gate.case.json --out test/workspace/semantic-reconstruction-stage0/candidate/conversion-gate-report.json
npm run plugin:validate
```

**完成条件：** `npm test`、插件校验、首轮三报告、二轮三份 canonical 报告、trusted-source、effective-diff、reverse-visual、author-editability 和 conversion gate 全部通过；canonical 作者源码零漂移；safe 默认与 candidate 已验证列表完全一致。

## Final Checkpoint

- [ ] `git diff --check` 通过，工作区只包含本阶段预期文件。
- [ ] `npm test` 全绿。
- [ ] `npm run plugin:validate` 通过。
- [ ] review 文档列出 0A–0F 每阶段提交、命令、结果和剩余非阻塞项。
- [ ] 路线图只把阶段 0 标记为已实施；A0 及以后仍保持未实施。
