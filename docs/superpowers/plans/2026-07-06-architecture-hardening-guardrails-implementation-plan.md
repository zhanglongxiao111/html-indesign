# 架构加固与护栏体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 `docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md`（下称 spec）：先把 8 条架构护栏（G1–G8）变成随 `npm test` 运行的静态测试并用豁免基线圈住现状，使架构从立护栏那一刻起停止恶化；然后按工作包 W0–W4 修复审查报告确认的病变（门禁假通过、模型方言、注册表旁路、层穿透、退役残留），每修一处收掉一条豁免，最终全部基线归零。

**Architecture:** 护栏测试与辅助器全部放 `test/architecture/`（helpers 解析 require 图、实现棘轮基线、统一失败信息格式），不进 `src/`。修复侧的架构裁定已在 spec §4 全部做完：canonical 字段形态、svg 角色裁定方法、SAFE_TAGS 处置、共享工具收敛位置、反向流水线上移落点。执行者照裁定落地；对裁定有异议或发现与代码事实冲突，停止并报告，不擅自改道。豁免基线只减不增，新增豁免必须经用户批准。

**Tech Stack:** Node.js CommonJS、`node:test`、现有 `src/protocol/` 注册表与文档生成器、`src/shared/`、真实 InDesign E2E（仅 W1/W3 回归时需要）。

---

## 执行解释原则

本计划的目标不是机械重命名或制造新门禁，而是把 `AGENTS.md` 已声明的架构契约变成代码事实和测试事实。执行中遇到细节未写全、扫描误报或实现路径有多种选择时，按以下原则裁决；原则与单个任务文字冲突时，先停下记录证据，再按原则修订执行口径，不得为了过测试缩小规则含义。

1. **护栏拦真实架构回退，不拦合法实现细节。** 例如插件目录内部文件可以相互依赖；禁止的是插件依赖 `scripts/` 或跨模块深挖非公共入口。护栏误报时修护栏定义和测试样本，不扩大豁免。
2. **协议字段集中登记，但扫描边界必须可执行。** `data-id-*` HTML 属性先由 `src/protocol/` 常量化并禁止裸字面量；`html_indesign` 脚本标签 payload 字段需要先有明确常量导出和字段清单，再纳入扫描。不得用模糊字符串扫描制造大面积误报。
3. **模型同构指字段契约一致，不是逐对象内容强行相等。** HTML adapter 与 InDesign adapter 的出口都必须通过 `validateSemanticModel(strict)`；同构测试比较 canonical 字段名、缺省值、字段域和单位契约。只有在 paired fixture 明确建立对象对应关系时，才比较对象级内容。
4. **先证明，再搬迁。** W1/W2/W3 中任何字段裁定、共享实现收敛、脚本上移或链路归位，都先用测试或取证说明当前行为，再做等价迁移；行为变化必须单独标注，不能混进“纯搬迁”提交。
5. **最终目标仍是全量收口。** 这些原则只用于避免误读和误报，不降低本计划的完成标准：全部护栏落地、豁免基线归零、退役路径清除、`npm test` 全绿，触及真实执行链路时跑 InDesign E2E。

## Scope

纳入本轮：

- 8 条护栏 G1–G8 全部落地，含护栏自测（人造违规样本必须被抓住）与豁免基线机制。
- W0 急症：门禁假通过修复、hi_executor legacy 分支删除、孤儿模块删除、AGENTS.md 文档同步。
- W1 模型方言统一：registry 裁定登记、两侧 adapter 对齐、出口强制校验、剥除多路径兜底、format 专有字段迁入 extensions 命名空间。
- W2 注册表源头化：常量导出、三处漂移收编、共享工具收敛、47 个文件字面量迁移。
- W3 链路归位：反向流水线上移 src、conversion-gate 算法入 src、拆双向直连、e2e 脚本审计函数迁移。
- W4 卫生项与全部文档收口。

不纳入本轮：

- 任何行为性新功能；搬迁类改动（W3）不得附带行为变更，发现需要行为变更时单独立项。
- `extract_blueprint.jsx` 的实际退役（仅列入观察清单）。
- 可编辑性基准计划本身（独立计划，唯一交叉点：本计划任务 8 完成前不得跑基准首轮）。

执行纪律（来自 spec §6，每轮任务开工前复读）：

1. 每轮只领一个任务；搬迁 = 移动 + 改 require，不顺手重构。
2. 豁免基线只减不增；需要新增 = 停止并报告。
3. 修改护栏断言、扩大豁免、缩小扫描范围让测试变绿，视为造假。
4. 护栏失败信息必须含：规则、一句话理由、修复方向、spec 路径——这是每条护栏的验收项。

## Current Baseline

```powershell
git status --short --branch
npm test
```

预期：`npm test` 全绿。当前不存在 `test/architecture/`。审查报告中的违规清单（`docs/review/2026-07-06-架构健康度审查报告.md`）是各护栏初始基线的数据来源，动工时以实际扫描结果为准重新采集，不直接照抄报告。

## Target Metrics

硬门槛：

- 8 条护栏全部随 `npm test` 运行；每条护栏的自测（正样本通过、人造违规样本失败）全绿。
- 每条护栏失败输出含四要素（规则/理由/修复方向/spec 路径），作为护栏任务的验收断言。
- 阶段验收以豁免基线归零为准：任务 8 后 G4/G5(代码部分)/G7/G8 归零；任务 9 后 G3 归零；任务 10 后 G2/G6 归零；任务 11 后 G1 归零。
- 过期豁免强制删除机制生效（基线条目匹配不到实际违规时测试失败）。
- 全程 `npm test` 全绿；W1、W3 完成时各跑一次真实 InDesign E2E 回归无退化。

## Planned File Changes

新增文件：

- `test/architecture/helpers/require-graph.js`：解析 `src/`、`scripts/` 的 require 依赖图（静态字符串 require，忽略 node 内置与 node_modules）。
- `test/architecture/helpers/baseline-ratchet.js`：通用棘轮——实际违规 ⊄ 基线则 fail（新违规）；基线条目无匹配则 fail（过期豁免）。
- `test/architecture/helpers/guardrail-report.js`：统一失败信息格式（规则/理由/修复方向/spec 路径四段）。
- `test/architecture/dependency-direction.test.js`（G1）
- `test/architecture/protocol-literals.test.js`（G2）
- `test/architecture/model-contract.test.js`（G3）
- `test/architecture/audit-fail-safety.test.js`（G4）
- `test/architecture/retired-naming.test.js`（G5）
- `test/architecture/single-implementation.test.js`（G6）
- `test/architecture/docs-sync.test.js`（G7）
- `test/architecture/orphan-modules.test.js`（G8）
- `test/architecture/baselines/G1.json` … `G8.json`（按需，条目含 rule/file/detail/reason/cleanupRef）
- `src/protocol/constants.js`（或按现有 protocol 结构落位）：由 fields 数据生成的属性名常量表、role 值枚举、样式 kind 枚举导出面。
- `src/shared/text.js`：文本归一化家族（按语义命名拆分，见任务 10）。
- `src/writers/html/reverse-pipeline.js`（或执行者按 index 导出习惯选定的编排模块）：反向流水线组装。
- `src/writers/html/audit/conversion-gate.js`：门禁算法（自 scripts 迁入）。

修改文件（主要）：

- `src/writers/html/audit/content-inventory.js`、`structure-signature.js`、`src/adapters/indesign/audit/reverse-snapshot-structure.js`、`parent-page-furniture.js`（W0 反假成功）。
- `scripts/audit-effective-diff.js`（CLI 出口 exitCode）。
- `_indesign_scripts/lib/hi_executor.jsxinc`、`test/indesign-executor/executor-script-static.test.js`（W0 legacy）。
- `src/adapters/html/normalizer/snapshot-to-model.js`、`src/adapters/indesign/normalizer/snapshot-to-model.js`（W1 方言对齐 + 出口校验）。
- `src/protocol/fields/*.js` 与生成的 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`（W1/W2 登记）。
- `src/semantic-reconstruction/reconstruct.js`、`object-graph/node-facts.js` 等三选一读取点（W1 剥兜底）。
- `scripts/indesign-reverse-export.js`、`src/indesign-cli-plugin/tools/reverse-export.js`、`tools/authoring-lint.js`、`scripts/audit-conversion-gate.js`、`scripts/audit-reverse-visual.js`、`scripts/indesign-e2e.js`、`src/writers/indesign/instructions-compiler.js`、`graphic-instructions.js`（W3）。
- `AGENTS.md`（W0 补登目录与命令；W3 后边界描述同步）。
- 删除：`src/adapters/html/reader/stacking.js`、`style-reader.js`。

约束：

- 护栏辅助器只进 `test/architecture/helpers/`，不进 `src/`。
- `src/protocol/constants.js` 必须从 fields 数据派生，不得手抄第二份属性名清单。
- W1 顺序不可颠倒：registry 登记 → adapter 对齐 → 出口校验强制 → 收 G3 豁免 → 最后才剥 writers 兜底。
- W3 搬迁提交不含行为变更；diff 审查以"测试不改、行为不变"为准。

## Implementation Tasks

### 0. 准备执行环境

- [x] `git status --short --branch` 记录起点；`npm test` 确认全绿。
- [x] 通读 spec 与审查报告；确认理解 §6 治理规则。

### 1. 护栏基础设施

进度：已完成（Task 1 审核通过；focused helper suite 14/14 通过；`npm test` 已纳入 `test/architecture/**/*.test.js`，2026-07-07）。

- [x] 实现 `require-graph.js`：给定根目录集合返回边列表 `{from, to}`（解析静态 `require('...')` 相对路径；动态 require 记录为观察项不参与断言）。
- [x] 实现 `baseline-ratchet.js`：输入实际违规集合与基线 JSON，输出新违规清单与过期豁免清单，两者任一非空即 fail。
- [x] 实现 `guardrail-report.js`：格式化四段失败信息；缺任一段抛错（保证后续护栏不偷工）。
- [x] 三个 helper 各配单测（含人造样本）。

验收命令：

```powershell
node --test test/architecture/
```

预期：helpers 单测全绿；此时尚无护栏测试。

### 2. G1 依赖方向护栏

进度：已完成（提交 `5fdc397`、`c9f347b`、`c121d9b`、`d35fdd5`、`7870948`；复审未发现阻断问题；`node --test test/architecture/dependency-direction.test.js` 10/10 通过，`npm test` 783/783 通过，2026-07-07）。

- [x] 实现 spec §3 G1 六条规则的断言；扫描采集当前实际违规写入 `baselines/G1.json`（预期与审查报告 §5 一致：adapters/html→writers/indesign、writers/indesign→adapters/html ×2、plugin→scripts、plugin 绕过 authoring 入口；以实扫为准）。
- [x] 自测：在 fixture 中人造一条 adapters→writers require，断言护栏抓住且失败信息含四段。

验收命令：

```powershell
node --test test/architecture/dependency-direction.test.js
npm test
```

### 3. G3 / G4 / G5 / G7 / G8 护栏

进度：已完成（提交 `d6de355`、`c10098d`、`e1cb881`、`08f6051`、`57fd390`、`1c6fd4c` 等；最终复审未发现阻断问题；当前 baseline：G3=549、G4=9、G5=6、G7=5、G8=2；`node --test test/architecture/` 51/51 通过，`npm test` 809/809 通过，2026-07-07）。

- [x] G3 模型出口契约：三条断言（出口调用 validateSemanticModel 的静态断言、非法输入行为断言、双 adapter 同构断言）；已知方言差异写入 `baselines/G3.json` 豁免。同构断言的字段面清单由 registry 生成，不手抄。
- [x] G4 门禁反假成功：枚举审计模块清单，断言对应测试文件存在"invalid-input 必须 fail"命名约定的用例；`scripts/audit-*.js` 子进程冒烟断言"无法判定时 exitCode 非 0"。当前不满足项入 `baselines/G4.json`。
- [x] G5 退役命名：禁用标识符扫描（`legacy` / `pagedHtml` / `paged-html`，白名单：`legacy-label` 观察标签、protocol lifecycle 词表、`docs/legacy/`）；现状入 `baselines/G5.json`（hi_executor、两个 test 目录名）。
- [x] G7 文档-代码同步：src 顶层目录 ⊆ AGENTS.md §4 表格；`audit:*`/`benchmark:*` scripts ⊆ AGENTS.md §9 表格。现状入 `baselines/G7.json`。
- [x] G8 孤儿模块：src 下无人 require 的文件 fail；现状入 `baselines/G8.json`（stacking.js、style-reader.js）。
- [x] 每条护栏各配人造违规自测。

验收命令：

```powershell
node --test test/architecture/
npm test
```

预期：全部护栏带基线通过；自测能抓住人造违规。

### 4. G2 / G6 护栏（先立规则 + 全量豁免）

进度：已完成（提交 `588cb67`、`a026c0b`、`00c6396`、`d200263`；最终复审未发现阻断问题；G2 baseline 337 条 / 47 文件，G6 baseline 16 条；`node --test test/architecture/protocol-literals.test.js test/architecture/single-implementation.test.js` 6/6 通过，`node --test test/architecture/` 57/57 通过，`npm test` 815/815 通过，2026-07-07）。

- [x] G2 协议字面量：扫描 src（protocol 除外）与 scripts 中裸 `data-id-` 字面量；当前 47 个文件（以实扫为准）全量入 `baselines/G2.json`。
- [x] G6 单一实现：spec §3 G6 函数名清单在 `src/shared/` 之外的重复定义扫描；现状全量入 `baselines/G6.json`。
- [x] 各配自测。

验收命令：

```powershell
node --test test/architecture/
npm test
```

**阶段 0 至此完成：架构停止恶化。提交护栏后再进入修复。**

### 5. W0-1 门禁反假成功修复

进度：已完成（提交 `090782b`、`bdc59e4`；最终复审未发现阻断问题；G4 baseline 9 条收缩到 6 条；`node --test test/indesign-reverse/content-inventory.test.js test/indesign-reverse/structure-signature.test.js test/indesign-reverse/reverse-snapshot-structure.test.js` 48/48 通过，`node --test test/indesign-reverse/effective-diff-audit.test.js test/indesign-reverse/parent-page-furniture-audit.test.js` 13/13 通过，`node --test test/architecture/audit-fail-closed.test.js` 6/6 通过，`npm test` 828/828 通过，2026-07-07）。

- [x] `content-inventory.js`：空/缺失 `pages` 显式 fail（原因码 `CONTENT_INVENTORY_INPUT_INVALID`）；`readAssetAliases` 解析失败记 warning。
- [x] `structure-signature.js`、`reverse-snapshot-structure.js`（矢量双侧缺失）、`parent-page-furniture.js`（bounds 缺失）同模式逐一排查修复；裁定基准：空输入永远是错误，不存在"两边都空所以相等"。
- [x] `scripts/audit-effective-diff.js` CLI 出口：无法判定时 exitCode 非 0。
- [x] 每处修复补"invalid-input 必须 fail"回归用例；收 `baselines/G4.json` 对应条目。

验收命令：

```powershell
node --test test/indesign-reverse/ test/architecture/audit-fail-safety.test.js
npm test
```

预期：G4 基线显著收缩（audit 模块部分归零）；新增用例证明空输入 fail。

### 6. W0-2 legacy 死分支与孤儿模块

进度：已完成（提交 `588cc60`；最终复审未发现阻断问题；删除 executor 退役路径与 `stacking.js` / `style-reader.js` 孤儿模块；baseline G5 6→2、G8 2→0、G6 16→15；`node --test test/indesign-executor/executor-script-static.test.js` 41/41 通过，`node --test test/architecture/retired-naming.test.js test/architecture/orphan-modules.test.js test/architecture/single-implementation.test.js` 11/11 通过，`node --test "test/indesign-executor/*.test.js" "test/architecture/*.test.js"` 104/104 通过，`npm test` 829/829 通过，2026-07-07）。

- [x] 删除 `hi_executor.jsxinc` 的 `runLegacyBuildInstructions` 与 legacy schema 分支；`runPagedHtmlBuildInstructions` 改名（如 `runBuildInstructions`），错误提示文本不再引用不存在的 `pagedHtml.compileInstructions`。
- [x] 同步修正 `executor-script-static.test.js` 断言（删除对 legacy API 必须存在的断言，改为断言其不存在）。
- [x] 删除 `src/adapters/html/reader/stacking.js`、`style-reader.js`。
- [x] 收 `baselines/G5.json` 代码部分与 `baselines/G8.json` 全部条目。

验收命令：

```powershell
node --test test/indesign-executor/ test/architecture/
npm test
```

### 7. W0-3 文档同步

进度：已完成（提交 `b32b92c`、`c923521`、`6b8a94a`；最终复审未发现阻断问题；AGENTS.md §4 / §9 已同步，G7 baseline 5 条清零；实际文件 `node --test test/architecture/docs-code-sync.test.js` 2/2 通过，`node --test test/architecture/` 57/57 通过，`npm run audit:synthesized-styles -- -- --model test/workspace/task7-minimal-semantic-model.json` 已跑通，2026-07-07）。

- [x] AGENTS.md §4 补登 `src/authoring`、`src/semantic-preset`、`src/shared`（含一句话边界规则）；§9 补登 `audit:synthesized-styles`。
- [x] 收 `baselines/G7.json` 全部条目。

验收命令：

```powershell
node --test test/architecture/docs-sync.test.js
```

### 8. W0 收口检查点

进度：已完成（提交 `919632e`、`921fd2f`、`36b2c23`；最终复审未发现阻断问题；G4=0、G7=0、G8=0，G5 仅剩 W4 test path 2 条；`node --test test/indesign-reverse/conversion-gate-cli.test.js test/architecture/audit-fail-closed.test.js test/architecture/` 72/72 通过，`npm test` 843/843 通过，2026-07-07）。

- [x] 确认 G4（audit 部分）/G5（代码部分）/G7/G8 基线归零；G5 剩余条目应只剩 test 目录改名（W4）。
- [x] `npm test` 全绿。**此检查点后可编辑性基准计划方可跑首轮。**

### 9. W1 模型方言统一

进度：已完成（9f 已完成：实现提交 `b93f5cd`，style-atoms 修复 `e5fbc50`；最终复审未发现 P0/P1/P2；`style-atoms` current synthesized style atom 已改为只由 canonical `role` 驱动，sourceType-only 不再生成 current synthesized refs；`npm test` 883/883 通过；9g 首轮真实 E2E 暴露 `indesign-cli` 当前 JSON schema 解析问题，已由提交 `509b667` 修复并以 `npm test` 884/884 验证；随后暴露 `metrics-area-table` 原生表格 text frame overset，`c137914` 的 frame slack 修复不足，实施子 agent `Hume` 已提交 `dc95801` 改为从 cell geometry 计算 presentation native table row/column sizing，普通真实 E2E `npm run e2e:indesign` 已通过且 `oversetTextFrames: 0`；审核子 agent `Arendt` 对 9g 表格修复判定无 P0、表格修复可接受，但提示后续需补 2pt table reserve / width delta 边界说明；实施子 agent `Boyle` 已提交 `c7d084a` 收口 reverse strict field registry gaps，复现 `compileReverseSnapshotToHtml` 通过且 `npm test` 886/886；实施子 agent `Wegener` 已提交 `d77a7af` 修复可信 `data-id-semantic` 写回，focused tests 118/118、architecture semantic model 12/12、`npm test` 889/889 通过；实施子 agent `Descartes` 已提交 `0d250f1`，通过跳过结构化 group shape 容器重复 summary text 解决 `site-legend-text` overset，并补充 table reserve 注释与 width delta 边界测试；完整真实 E2E `npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip` 已通过，runDir `test/workspace/indesign-e2e-20260708-064317`，build/export `oversetTextFrames: 0`，canonical content inventory 与 structure signature 均 ok，warnings 仅剩 `CANONICAL_SOURCE_DRIFT_ADVISORY` 格式漂移提示；最终审核 agent `Noether` 发现 P1：grouped shape 文本去重条件过宽，任意结构化子项都会 suppress 容器文本，可能吞掉带非文本子项的合法 shape 自身文本；实施子 agent `Laplace` 已提交 `827f05c`，将 suppress 条件收窄为“结构化 text 子项承载同一段父文本”才跳过容器 text，并新增非文本子项保留父文本的 RED/GREEN 回归；子 agent 验证 `node --test test/semantic-model/to-instructions.test.js` 30/30、`node --test test/paged-html/instructions-compiler.test.js` 33/33、`npm test` 892/892、`git diff --check` 均通过；控制器复核 `node --test test/semantic-model/to-instructions.test.js test/paged-html/instructions-compiler.test.js` 63/63、`npm test` 892/892、`git diff --check`、真实 E2E `npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip` 均通过，最新 runDir `test/workspace/indesign-e2e-20260708-070341`，build/export `oversetTextFrames: 0`，canonical content inventory 与 structure signature 均 ok；最终 re-review `Noether` 判定 `SPEC: PASS` / `QUALITY: PASS`，未发现新的 P0/P1/P2；2026-07-08）。

按 spec §4 W1 裁定表执行，顺序不可颠倒：

- [x] **9a registry 裁定登记**：`items[].role` + `items[].sourceType` 双字段定案（HTML 侧未登记 `type` 判退役）；`semantic` 缺省 canonical 为 `null`；`styleRefs` 允许键枚举登记；`bounds` 契约（绝对页面坐标、pt）写入字段描述；format 专有字段 canonical path 迁移方案登记（`items[].extensions.indesign.*`）。重新生成 `PROTOCOL_FIELD_REGISTRY.md`。
- [x] **9b HTML adapter 对齐**：列出全部 `items[].type` 读取点后删除该字段产出；styleRefs 键收敛进枚举。
- [x] **9c InDesign adapter 对齐**：`semantic` 的 `'unknown'` 哨兵改 `null`，下游（`reconstruct.js:129-133` 等）判空收敛；styleRefs 键收敛；`effects`/`textFrameStyle` 迁入 `extensions.indesign.*`（工作量过大时允许作为 9f 独立提交，不得停在半途）。
- [x] **9d 出口强制校验**：两个 normalizer 出口接入 `validateSemanticModel`（strict，失败即抛）；G3 静态与行为断言豁免收口。
- [x] **9e 收 G3 同构豁免**：`baselines/G3.json` 归零。
- [x] **9f 剥兜底**：消灭 `role || type || sourceType` 三选一读取（`node-facts.js:21`、`author-audit.js:162` 及全量搜索所得）；writers 中因方言存在的双路径读取逐点剥除，每剥一处配测试。
- [x] **9g 真实 E2E 回归**：`npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip` 无退化（内容库存、结构签名、二轮稳定全过）。

验收命令：

```powershell
node --test test/architecture/model-contract.test.js
npm test
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip
```

预期：G3 基线归零；registry 文档与代码一致；E2E 回归通过。

### 10. W2 注册表源头化

进度：已完成（10a 已完成：实施子 agent `Gauss` 已提交 `8f9fb69`，审核 agent `Nash` 通过；10b 已完成：实施子 agent `Erdos` 提交 `7fa270c` 与修复提交 `3c559a4`，审核 agent `Pauli` 复审通过；10c 已完成：实施子 agent `Sagan` 提交 `a4ccfb9` 与修复提交 `de4ac73`，审核 agent `Galileo` 复审通过；10d 已完成：实施子 agent `Euler` 提交 `f1ff021` 与修复提交 `2ff6908`，审核 agent `Anscombe` 复审判定 `SPEC: PASS` / `QUALITY: PASS` 且无 P0/P1/P2；10e residual 已完成：实施子 agent `Euler` 提交 `03814ff`，审核 agent `Anscombe` 复审判定 `SPEC: PASS` / `QUALITY: PASS` 且无 P0/P1/P2；控制器验证 `node --test test/shared/style-utils.test.js test/architecture/single-implementation.test.js` 8/8、`node --test test/architecture/protocol-literals.test.js test/architecture/single-implementation.test.js` 6/6、`npm test` 912/912、`git diff --check HEAD~1..HEAD` 通过；G2/G6 baseline 均已归零；2026-07-08）。

- [x] **10a 常量导出**：`src/protocol/constants.js` 由 fields 数据生成属性名常量表、role 值枚举（含 background/decoration/annotation 全值域）、样式 kind 枚举。
- [x] **10b 三处漂移收编**（裁定方法见 spec §4 W2）：svg 角色以 writers/indesign 实际编译行为取证后定案，分类逻辑收敛为单一共享函数，adapter 与 audit 同源引用；`authoring-validator.js` 的 role 子集改引用枚举（作者可写子集若小于全集，在 registry 显式声明）；SAFE_TAGS 合并或改名（禁止同名异义），取证两份清单的真实用途后处置。
- [x] **10c 共享工具收敛**：`src/shared/text.js` 按语义拆分命名（如 `normalizeLineEndings` / `collapseWhitespace` / NBSP 变体）；`safeClass` 族收敛到 `shared/style-utils.js`（合并前先确认 synth token → CSS class 链路行为不变，有差异的实现先取证再定统一行为）；单位换算收敛（`authoring-validator.js` 的动态换算属不同概念，命名区分不强并）；NAS 路径逻辑复用 `shared/nas-paths.js`。逐点替换引用并收 `baselines/G6.json`。
- [x] **10d 字面量迁移**：47 个文件的 `data-id-` 字面量机械替换为常量引用；每迁移一批收 `baselines/G2.json` 对应条目，直至归零。

验收命令：

```powershell
node --test test/architecture/protocol-literals.test.js test/architecture/single-implementation.test.js
npm test
```

预期：G2/G6 基线归零；三处漂移有单一实现与取证记录（写入提交信息或 docs/review/ 附记）。

### 11. W3 链路归位

进度：11a 已完成，11b 待实施（11a：实施子 agent `Euler` 提交 `fbf5f50`，审核 agent `Anscombe` 判定 `SPEC: PASS` / `QUALITY: PASS` 且无 P0/P1/P2；`compileReverseSnapshotToHtml` 已迁入 `src/reverse-pipeline/` 独立编排入口，脚本保留薄 CLI wrapper，插件 `reverse-export` 改调 src pipeline，插件 `authoring-lint` 改走 `src/authoring` 公共入口；G1 baseline 从 5 条降到 3 条，只保留 11d 的三条 adapter/writer 双向直连；控制器验证 `node --test test/indesign-reverse/cli.test.js test/paged-html/authoring-lint-cli.test.js test/architecture/dependency-direction.test.js` 26/26、旧 plugin require 扫描无输出、active `compileReverseSnapshotToHtml` 定义仅 `src/reverse-pipeline/index.js` 一处、`npm test` 914/914、`git diff --check HEAD~1..HEAD` 通过；2026-07-08）。

- [x] **11a 反向流水线上移**：`compileReverseSnapshotToHtml` 编排逻辑迁入 `src/writers/html/reverse-pipeline.js`（或选定编排模块）；`scripts/indesign-reverse-export.js` 与 `src/indesign-cli-plugin/tools/reverse-export.js` 改调 src 入口；`tools/authoring-lint.js` 改走 `src/authoring` 公共入口（authoring/index.js 需要则扩导出面）。
- [ ] **11b conversion-gate 入 src**：门禁算法迁 `src/writers/html/audit/conversion-gate.js`，脚本保留薄 CLI；现有测试同步指向 src 模块。
- [ ] **11c 平行捕获合并**：`scripts/audit-reverse-visual.js` 的浏览器几何捕获合并回 `src/adapters/html/reader/`，消除与 `browser-snapshot.js` 的平行实现。
- [ ] **11d 拆双向直连**：`adapters/html/normalizer` 调用的样式编译逻辑按 spec 裁定下沉（shared 或 semantic-model 层）；`instructions-compiler.js` 的组合入口上移编排层，writer 不再 require adapter；`graphic-instructions.js` 的 placement 信息改由模型字段承载（如需新字段，先走 registry）。
- [ ] **11e e2e 审计函数迁移**：`indesign-e2e.js` 中无 src 对应的审计函数迁入对应 audit 模块，脚本只留编排。
- [ ] 收 `baselines/G1.json` 至归零。搬迁提交不含行为变更。
- [ ] **11f 真实 E2E 回归**：同任务 9g 命令，无退化。

验收命令：

```powershell
node --test test/architecture/dependency-direction.test.js
npm test
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip
```

### 12. W4 卫生与文档收口

- [ ] `test/paged-html/`、`test/indesign-reverse/` 及 fixtures 目录改名对齐现行架构（收 G5 剩余条目至归零）。
- [ ] `instructionItemFor` 按五角色拆函数；`compareVisualGeometry` 拆两级；重复 `bordersAreUniform` 上提 `box-model.js`。
- [ ] `SEMANTIC_CONTAINER_CLASSES` 与语义 preset 对齐（单一来源）。
- [ ] `extract_blueprint.jsx` 列入 blueprint 退役观察清单（docs 记录，不删代码）。
- [ ] spec 状态行"提案"→"已实施"，补记实施偏差；本计划在 plans README 保持登记；AGENTS.md 边界描述与 W3 后的实际结构核对一遍。
- [ ] 全基线归零终检：`test/architecture/baselines/*.json` 除注释性空壳外无条目。

验收命令：

```powershell
node --test test/architecture/
npm test
rg "legacy|pagedHtml|paged-html" src scripts _indesign_scripts test --iglob "!docs/**"
```

## Commit Plan

按阶段分段提交，护栏与修复不混在同一提交：

1. `test: add architecture guardrail infrastructure`（任务 1）
2. `test: add dependency-direction guardrail with baseline`（任务 2）
3. `test: add model/audit/naming/docs/orphan guardrails`（任务 3）
4. `test: add protocol-literal and single-implementation guardrails`（任务 4）
5. `audit: fail on empty or corrupt gate inputs`（任务 5）
6. `executor: remove legacy build branch and orphan readers`（任务 6）
7. `docs: register hidden shared layers and missing commands`（任务 7）
8. `protocol+adapters: unify semantic model dialect`（任务 9，按 9a–9f 可再分）
9. `protocol: export field constants and consolidate drifted allowlists`（任务 10）
10. `arch: move reverse pipeline and gate logic into src`（任务 11，按 11a–11e 可再分）
11. `chore: rename fossil test dirs and hygiene splits`（任务 12）

每次提交前：`git diff --check` + 受影响测试；阶段收口时完整 `npm test`。

## Risks And Controls

| 风险 | 控制 |
| ---- | ---- |
| 护栏误报挡路 | 每条护栏有人造样本自测；误报的处置是"报告并修护栏"，不是放宽（spec §6.3） |
| W1 改字段牵动面大 | 顺序锁死（先契约后剥兜底）；小步提交；9g 真实 E2E 回归 |
| 执行者顺手扩大重构范围 | 每轮一个任务；W3 搬迁提交"测试不改、行为不变"审查基准 |
| 豁免清单停摆 | 过期豁免强制删除机制；阶段验收=基线归零，不接受"还剩几条不影响" |
| svg/SAFE_TAGS 裁定与深层预期不符 | 裁定方法是取证（以 writer 实际行为为准），取证结果与 spec 预期不符时停止报告 |
| 与可编辑性基准计划抢跑 | 任务 8 检查点是基准首轮的前置门槛，两计划其余部分可并行 |

## Completion Criteria

- [ ] 8 条护栏落地、自测通过、失败信息四要素齐全、随 `npm test` 运行。
- [ ] W0 完成：门禁空输入必 fail 有回归用例；legacy 分支与孤儿模块清除；AGENTS.md 同步。
- [x] W1 完成：registry 裁定落地、两侧 adapter 同构、出口强制校验、三选一读取消灭、E2E 回归通过。
- [x] W2 完成：常量导出、三处漂移单一实现、共享工具收敛、47 文件迁移完毕。
- [ ] W3 完成：src 不 require scripts、双向直连拆除、门禁算法在 src、E2E 回归通过。
- [ ] 全部豁免基线归零；`npm test` 全绿；spec 状态更新为已实施。
