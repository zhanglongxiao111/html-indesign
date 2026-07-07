# Agent 可编辑性基准实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可重复运行的 Agent 编辑任务基准：以落库的 `reverse-snapshot.json` 为固定输入，每次运行用当前语义重建算法现生成反向作者包，让被试 Agent 执行 8 个真实编辑任务，由确定性判定器自动批改，输出任务成功率、diff 局部性和失败聚类。基准结果作为语义重建算法迭代的目标函数和回归门禁，替代"让 LLM 阅读 HTML 主观评价可编辑性"的旧循环。

**Architecture:** 三阶段解耦 prepare / edit / verify。判定器是纯 Node 确定性函数，放在 `src/writers/html/audit/` 与现有审计同层，复用 `content-inventory`、`structure-signature` 和既有 assemble / lint / instructions 编译链路，不依赖任何 LLM；被试 Agent 只出现在 edit 阶段，且工作区内只有自然语言任务说明，看不到期望断言。整套工具是仓库内部测试工具，不进入 InDesign CLI 插件 `tools/list`。设计依据与论证见 `docs/superpowers/specs/2026-07-06-agent-editability-benchmark-design.md`（下称 spec），**执行者动工前必须先通读 spec**；本计划只写执行顺序、文件落点和验收，不重复设计论证。计划与 spec 冲突时以 spec 为准；spec 与代码事实冲突时停止并报告，不自行发挥。

**Tech Stack:** Node.js CommonJS、`node:test`、cheerio、现有审计模块（`content-inventory.js`、`structure-signature.js`、`author-editability.js`）、`scripts/indesign-reverse-export.js` 已导出的 `compileReverseSnapshotToHtml`、既有 `assemble:authoring` / `lint:authoring` / instructions 编译链路。

---

## Scope

纳入本轮：

- 判定器 `edit-task-verdict.js`：spec §7 的 8 种断言类型、diff 局部性统计、门禁结果聚合。
- 编排 `benchmark-editability.js`：`--prepare` / `--verify` 两阶段 CLI，逻辑主体在 `src/`。
- snapshot fixture 生成与落库（需要一次真实 InDesign 运行）。
- 8 个 v1 任务 case（spec §12 的 T01–T08）。
- 对照组机制：同一套任务跑 `forward-control`（正向 fixture 副本）与 `reverse-author`（现生成）两个变体。
- 首轮真实基准运行、`baseline.json` 落库、首份报告进 `docs/review/`。
- verify 阶段的 baseline 棘轮判定（无 baseline 时显式 `baseline: null`，只报告不拦截）。
- `audit:author-editability` 代理指标校准第一轮（按基准实际发现补指标，不预设改动内容）。
- `AGENTS.md` 执行基线表与 plans README 同步。

不纳入本轮（spec §15 Phase 4）：

- 无标注 snapshot 变体（剥离 `html_indesign` 标签走观察模式重建）。
- L2 真实 InDesign 回环判定层。
- 编辑成本（tokens / 耗时）门禁，v1 只透传记录。
- 新增任何协议字段。如实现中发现断言必须依赖新 `data-id-*` 字段，停止并回到 `src/protocol/` 注册表流程，不得私造。

## Current Baseline

执行前确认：

```powershell
git status --short --branch
npm test
```

预期：`npm test` 全绿。当前不存在 `test/fixtures/editability-benchmark/`，snapshot fixture 由任务 1 生成。

## Target Metrics

硬门槛：

- 判定器单测全绿：脚本化"完美编辑"必须 pass；至少三种脚本化"坏编辑"（改错页、全局重排格式、改对内容但组装失败）必须 fail 且原因码正确。
- prepare 防应试测试通过：Agent 工作区内不存在 case 文件、`expected`、`target` 的任何拷贝。
- `forward-control` 变体 8/8 任务可通过（任务定义 sanity 门槛；不达标先修任务定义，不算导出算法缺陷）。
- `reverse-author` 变体产出首个真实成功率，`baseline.json` 落库，首份失败聚类报告进 `docs/review/`。
- `npm test` 全绿；无新增协议字段；判定器无网络调用。

目标门槛（不强制本轮达成）：

- `reverse-author` 与 `forward-control` 的成功率差距被逐类归因，每个失败聚类都有具名缺陷和下一步入口。

## Planned File Changes

新增文件：

- `src/writers/html/audit/edit-task-verdict.js`：判定器纯函数。输入（case、编辑前快照目录、编辑后工作区目录、门禁结果），输出 `EditTaskVerdict`。
- `src/writers/html/audit/editability-benchmark.js`：套件加载与校验、workspace prepare、verify 聚合、`EditabilityBenchmarkReport` 与失败聚类、baseline 比对。
- `scripts/benchmark-editability.js`：CLI 入口，只做参数解析与调用，参数风格与现有 audit 脚本一致（同时支持空格与 `=` 形式）。
- `test/fixtures/editability-benchmark/snapshots/architecture-report.reverse-snapshot.json`：固定输入 fixture。
- `test/fixtures/editability-benchmark/cases/T01-…T08-*.case.json`：8 个任务定义。
- `test/fixtures/editability-benchmark/baseline.json`：首轮基准产物（任务 8 落库）。
- `test/editability-benchmark/edit-task-verdict.test.js`
- `test/editability-benchmark/editability-benchmark.test.js`
- `docs/review/<日期>-editability-benchmark-首轮报告.md`（任务 8 产出）。

修改文件：

- `package.json`：新增 `"benchmark:editability": "node scripts/benchmark-editability.js"`。
- `src/writers/html/audit/author-editability.js`：仅在任务 9 校准发现缺失维度时按结论修改。
- `AGENTS.md`：执行基线表新增 benchmark 行（任务 10）。
- `docs/superpowers/plans/README.md`：当前计划列表。
- spec 文件头部状态行：提案 → 已实施（任务 10）。

约束：

- 判定器与编排逻辑全部进 `src/writers/html/audit/`，`scripts/` 只接线；不得在 scripts 里堆断言实现。
- 判定器不得调用网络或任何 LLM；断言评估只消费 `content-inventory`、`structure-signature`、文件 diff 与 CSS 解析，不重新发明 HTML 解析。
- 运行产物只进 `test/workspace/`，不进版本库。
- snapshot fixture 只在 snapshot schema 演进或 fixture 页面内容大改时更新，更新必须单独提交并写明原因；**不因算法迭代而更新**。
- 复用 `scripts/indesign-reverse-export.js` 已导出的 `compileReverseSnapshotToHtml` 生成 `reverse-author` 变体；如需微调导出面，只允许增加导出，不改既有行为。

## Implementation Tasks

### 0. 准备执行环境

- [ ] 确认工作分支与脏文件状态，记录到执行报告。
- [ ] 运行 `npm test`，确认基线全绿。
- [ ] 通读 spec 全文，特别是 §6 case 格式、§7 断言词汇表、§8 三阶段流程。

验收命令：

```powershell
git status --short --branch
npm test
```

### 1. 生成并落库 snapshot fixture（需要真实 InDesign 一次）

- [ ] 运行 `npm run e2e:indesign -- -- --reverse-roundtrip`，从 `test/workspace/indesign-e2e-<时间戳>/` 取 `reverse-snapshot.json`。
- [ ] 人工复核：无客户内容、无真实项目路径（fixture 源自 architecture-report 自有样例，预期天然干净）。
- [ ] 复制为 `test/fixtures/editability-benchmark/snapshots/architecture-report.reverse-snapshot.json`，单独提交。
- [ ] 验证纯 Node 链路：用 `compileReverseSnapshotToHtml`（或 `node scripts/indesign-reverse-export.js --snapshot <fixture> --out-dir test/workspace/benchmark-fixture-check/`）从该 fixture 生成作者包，作者包审计通过。

如本机无真实 InDesign 环境：停止本任务并向用户报告，等待用户运行；**不得伪造或手工拼 snapshot**。

验收命令：

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip
node scripts/indesign-reverse-export.js --snapshot test/fixtures/editability-benchmark/snapshots/architecture-report.reverse-snapshot.json --out-dir test/workspace/benchmark-fixture-check/
```

预期：反向导出成功，`reverse-html/author/` 结构完整，审计报告无 failure。

### 2. Case schema 与套件加载器

- [ ] 在 `editability-benchmark.js` 实现 case 加载与校验：必填字段（`kind`、`schemaVersion`、`id`、`category`、`instruction`、`expected.assertions`、`expected.diffBudget`、`expected.gates`）、断言类型白名单（spec §7 的 8 种）、`category` 枚举、`diffBudget` 数值合法性。
- [ ] 非法 case 显式报错并给出字段路径，不静默跳过（失败要早于假成功）。
- [ ] 套件加载：扫描 `cases/*.case.json`，按 id 排序，id 重复报错。

测试要点（`editability-benchmark.test.js`）：合法 case 加载成功；缺必填字段、未知断言类型、非法预算分别报出对应原因码。

验收命令：

```powershell
node --test test/editability-benchmark/editability-benchmark.test.js
```

### 3. 判定器 edit-task-verdict

- [ ] 实现 spec §7 全部 8 种断言：`text-changed`、`text-added`、`text-removed`、`resource-replaced`、`object-removed`、`order-swapped`、`style-token-changed`、`pages-byte-identical`。文本与资源断言基于 `content-inventory` 前后对比；顺序断言基于 `structure-signature`；`style-token-changed` 基于 CSS 声明级解析；`pages-byte-identical` 基于编辑前快照逐字节比对（只覆盖 `pages/*.html` 与 `styles/*.css`，`deck.html` 是组装生成物不计入）。
- [ ] 实现 diff 局部性统计：相对编辑前快照统计改动文件数与改动行数（同样只计 `pages/` 与 `styles/`），与 `diffBudget` 比对。
- [ ] 聚合门禁结果 + 断言结果 + diff 结果为 `EditTaskVerdict`（格式见 spec §9.1），单任务 `ok` = 三者全过。
- [ ] 无法评估的断言（页面缺失、快照损坏）显式 fail 并给出原因码，不静默跳过。

测试要点（`edit-task-verdict.test.js`，全部脚本化构造、无 LLM）：

- 完美编辑（脚本精确完成 T01 意图）→ `ok: true`。
- 改错页（把改动写到另一页）→ 目标断言 fail 且 `pages-byte-identical` 报出违例文件。
- 全局重排格式（内容对但整包重新缩进）→ diff 预算 fail，报出实际行数与预算。
- 改对内容但组装产物不一致 → gate fail 且原因码指向 assemble。
- 每种断言类型至少一个正例一个反例。

验收命令：

```powershell
node --test test/editability-benchmark/edit-task-verdict.test.js
```

### 4. prepare 编排

- [ ] `--prepare`：为每个（任务 × 变体）建立独立工作区 `test/workspace/<run>/T<NN>-<variant>/`。
- [ ] `reverse-author` 变体：从 snapshot fixture 经 `compileReverseSnapshotToHtml` 现生成作者包；`forward-control` 变体：复制 `test/fixtures/e2e/architecture-report/`。
- [ ] 每个工作区写入 `TASK.md`：只含 `instruction` 原文、组装命令说明、完成标准的通用描述；**不含** `expected`、`target`、case 文件。
- [ ] 留存编辑前快照（工作区旁的 `baseline-snapshot/` 目录或等价机制），供 verify 做 byte-identical 与 diff 统计。
- [ ] 防应试测试：断言工作区目录树内不存在 `expected`、`target` 字段内容与 `*.case.json` 拷贝。

测试要点：prepare 后工作区结构完整、两变体作者包可组装、防应试断言通过、重复 prepare 到同一目录显式报错或要求空目录。

验收命令：

```powershell
node --test test/editability-benchmark/editability-benchmark.test.js
npm run benchmark:editability -- -- --prepare --suite test/fixtures/editability-benchmark --workspace test/workspace/benchmark-smoke/
```

### 5. verify 编排与套件报告

- [ ] `--verify`：对每个工作区依次执行门禁（assemble 一致性检查、lint、instructions 静态编译，均复用现有链路）、断言评估、diff 统计，产出每任务 `EditTaskVerdict`。
- [ ] 聚合 `EditabilityBenchmarkReport`（spec §9.2）：分变体成功率、任务明细、`failureClusters`（按 `category` × 失败环节聚类）。
- [ ] 读取工作区可选 `driver-report.json` 透传成本字段，不参与 pass/fail。
- [ ] baseline 比对：`--baseline` 提供时执行棘轮判定（成功率不降、已通过任务不转失败、预算不放宽），违反即整体 fail；未提供时输出 `baseline: null`，只报告。
- [ ] `--out` 写完整 JSON 报告；stdout 输出人类可读摘要；整体 fail 时进程退出码非 0。

测试要点：用任务 3 的脚本化正/负工作区跑 verify，报告结构、聚类、退出码正确；有/无 baseline 两种路径行为正确。

验收命令：

```powershell
node --test test/editability-benchmark/editability-benchmark.test.js
npm run benchmark:editability -- -- --verify --workspace test/workspace/benchmark-smoke/ --out test/workspace/benchmark-smoke/report.json
```

### 6. 最小闭环：T01 + T03

- [ ] 写 `T01-edit-cover-title.case.json`（text-edit，改封面主标题）与 `T03-replace-material-image.case.json`（resource-edit，替换 material-system 页一张图片）。断言与预算按 spec §6/§12，`maxChangedLines` 先在 `forward-control` 上实测校准后声明。
- [ ] 集成自测：脚本化在 `forward-control` 工作区完成 T01 完美编辑 → verify 必须 pass；作为回归测试固化。
- [ ] 在 `reverse-author` 变体上人工或子代理走通一次 T01 全流程（prepare → 编辑 → verify），确认端到端可用。

验收命令：

```powershell
node --test test/editability-benchmark/
npm run benchmark:editability -- -- --prepare --suite test/fixtures/editability-benchmark --workspace test/workspace/benchmark-t01-t03/
npm run benchmark:editability -- -- --verify --workspace test/workspace/benchmark-t01-t03/ --out test/workspace/benchmark-t01-t03/report.json
```

预期：`forward-control` 上 T01/T03 可完成且判定 pass；`reverse-author` 结果如实记录（失败也是合法结果，进报告）。

### 7. 补齐 T02、T04–T08

- [ ] 按 spec §12 落地其余六个 case：T02 改 site-analysis 正文一句话、T04 metrics-table 加一行、T05 design-strategy 对调两个图块、T06 删除一个图+图注对、T07 修改一个样式 token、T08 改 drawing-sheet 一条图注。
- [ ] 每个 case 的 `instruction` 引用两个变体中都真实存在的内容（同一份文档，逐一核对 fixture 页面实际内容后再写）。
- [ ] 每个 case 在 `forward-control` 上验证可完成（脚本化或子代理），不可完成的先修任务定义。

验收命令：

```powershell
node --test test/editability-benchmark/
npm run benchmark:editability -- -- --prepare --suite test/fixtures/editability-benchmark --workspace test/workspace/benchmark-full-dry/
```

预期：8 个 case 全部通过 schema 校验并能 prepare；`forward-control` 逐一验证记录在案。

### 8. 首轮真实基准与 baseline 落库

- [ ] 完整 prepare 两个变体 × 8 任务；用子代理逐工作区执行编辑（被试标识记入报告）。
- [ ] `forward-control` 必须 8/8：不达标的任务先修任务定义并重跑，修订记录写入报告。
- [ ] `reverse-author` 如实出分；失败任务按 spec §12 的映射做失败聚类与根因初判。
- [ ] 产出 `baseline.json` 人工复核后落库。
- [ ] 首份报告写入 `docs/review/<日期>-editability-benchmark-首轮报告.md`：两变体成绩、对照差距、失败聚类、每个聚类的具名缺陷与下一步入口。

验收命令：

```powershell
npm run benchmark:editability -- -- --prepare --suite test/fixtures/editability-benchmark --workspace test/workspace/benchmark-round1/
# （edit 阶段：子代理逐工作区执行）
npm run benchmark:editability -- -- --verify --workspace test/workspace/benchmark-round1/ --out test/workspace/benchmark-round1/report.json
```

预期：`forward-control` 成功率 1.0；`reverse-author` 首个真实成功率与聚类进入 review 报告和 baseline。

### 9. 棘轮接入与代理指标校准第一轮

- [ ] 在 `audit:conversion-gate` 增加可选 `--benchmark <report.json>` 输入：报告存在时，基准整体 fail 或棘轮违反计入总门禁失败；不提供时不影响现有行为。
- [ ] 校准第一轮：并排比对首轮基准结果与 `audit:author-editability` 报告。基准失败但代理全绿的每个案例，定位缺失维度并补进 `author-editability.js`（新指标默认只统计，接入预算另行决定）；代理告警但基准全过的指标，复核后调整或降级 warning。
- [ ] 校准结论写入 `docs/review/`，与首轮报告互相引用。

验收命令：

```powershell
node --test test/editability-benchmark/ test/indesign-reverse/
npm run audit:conversion-gate -- -- --case <gate.case.json> --benchmark test/workspace/benchmark-round1/report.json
npm test
```

预期：conversion-gate 新维度可用且向后兼容；校准改动有测试与结论文档。

### 10. 文档同步与收口

- [ ] `AGENTS.md` 执行基线表新增：`可编辑性基准 | npm run benchmark:editability -- -- --prepare/--verify …`（一行，细节留在 spec）。
- [ ] `docs/superpowers/plans/README.md` 当前计划列表加入本计划。
- [ ] spec 状态行从"提案"改为"已实施"，并补记实施中与设计的偏差（如有）。
- [ ] 退役检查：无恢复旧路径、无私造字段、无未解释占位；确认插件 `tools/list` 未被触碰。

验收命令：

```powershell
rg "benchmark:editability" package.json AGENTS.md scripts src test
rg "TODO|TBD" src/writers/html/audit/edit-task-verdict.js src/writers/html/audit/editability-benchmark.js scripts/benchmark-editability.js
npm test
```

## Commit Plan

按风险分段提交：

1. `fixture: add editability benchmark reverse snapshot`
2. `audit: add edit task verdict engine`
3. `audit: add editability benchmark prepare/verify orchestration`
4. `fixture: add editability benchmark cases T01/T03`
5. `fixture: complete editability benchmark case suite`
6. `audit: record first editability benchmark baseline`
7. `audit: wire benchmark into conversion gate and calibrate editability metrics`
8. `docs: document editability benchmark entry points`

每次提交前：`git diff --check` + 受影响测试文件 `node --test`；最后提交前完整 `npm test`。

## Risks And Controls

| 风险 | 控制 |
| ---- | ---- |
| 本机无真实 InDesign，snapshot fixture 无法生成 | 任务 1 显式前置并允许停止等待用户；严禁伪造 snapshot |
| 被试 Agent 随机性导致偶发失败 | 单次运行 + 允许一次复跑并在报告标注 `reruns`；棘轮比较要求同被试；波动记录留作 v2 输入 |
| 判定器误判（假阳/假阴） | 任务 3 的坏编辑单测族；无法评估的断言显式 fail 带原因码 |
| 任务定义过难或含糊，错怪导出算法 | `forward-control` 对照组 8/8 硬门槛；不达标先修任务 |
| 工作区泄漏期望答案，Agent 应试 | prepare 防应试测试固化为回归测试 |
| snapshot fixture 被算法迭代顺手更新，跨版本失去可比性 | fixture 更新必须单独提交并写明原因；代码评审时把"fixture 变更 + 算法变更同一提交"当缺陷 |
| 编排脚本膨胀成第二个门禁系统 | 逻辑主体进 `src/writers/html/audit/`，scripts 只接线；断言词汇扩张必须同步补判定器单测 |
| 基准结果被解读为单一分数 | 报告结构强制携带任务明细与失败聚类；stdout 摘要必须列出失败任务与原因码，不只打印成功率 |

## Completion Criteria

- [ ] snapshot fixture 落库且纯 Node 链路可从它生成作者包。
- [ ] 判定器 8 种断言全部实现且正/反例单测全绿。
- [ ] prepare/verify 可通过 npm script 端到端运行，防应试测试通过。
- [ ] 8 个 case 全部落地且 `forward-control` 8/8。
- [ ] 首轮 `reverse-author` 基准完成，`baseline.json` 落库，首份报告进 `docs/review/`。
- [ ] conversion-gate 可选接入基准报告，向后兼容。
- [ ] 代理指标校准第一轮完成并有结论文档。
- [ ] `npm test` 全绿；AGENTS.md、plans README、spec 状态同步完成。
