# Agent 可编辑性基准（Editability Benchmark）设计

- 日期：2026-07-06
- 状态：提案（未实施）
- 类型：方案设计（过程文档，不自动等同长期规范）
- 关联：`docs/规范/REVERSE_EXPORT.md`、`docs/规范/SEMANTIC_RECONSTRUCTION.md`、`src/writers/html/audit/author-editability.js`、`scripts/audit-conversion-gate.js`

## 1. 背景与问题

当前反向导出（InDesign → 语义 HTML 作者包）的"对 Agent 可编辑性"迭代方式是：让 LLM 给方案 → 实现 → 让 LLM 阅读导出 HTML 并主观评价 → 根据意见改进。这个循环有三个结构性缺陷：

1. **评价没有操作定义。** "可编辑性好不好"没有客观判据，LLM 每轮评价标准漂移，同一份 HTML 两次评价可能矛盾，改进信号是嘈杂的一比特。
2. **没有棘轮。** 上一轮确认的进步没有固化成门禁，下一轮算法改动可能悄悄回退。
3. **评价对象错位。** LLM 读 HTML 给意见，评的是"读起来顺不顺"；真正关心的是"Agent 拿到它之后，改一个标题、换一张图的真实摩擦有多大、会不会改坏"。读和改是两种能力。

现有的 `audit:author-editability` 已提供静态代理指标（语义容器覆盖率、散落对象、内联样式、低层几何字段等），但这些指标的合法性从未被行为事实校准过：指标全绿不等于 Agent 真能顺利编辑。

## 2. 第一性原理：可编辑性的操作定义

对 Agent 而言，一份作者包可编辑性好，**当且仅当**以下行为事实成立，且全部机器可判定：

| 性质 | 定义 | 判定基础 |
| ---- | ---- | ---- |
| 可定位 | 给定编辑意图，Agent 能找到唯一正确的编辑点 | 编辑任务成功率 |
| 可局部修改 | 完成意图所需 diff 是最小的，不连带调整无关内容 | diff 局部性（改动文件数 / 行数预算） |
| 改不坏 | 编辑后重新组装、lint、编译指令全部通过，未触碰页面逐字节不变 | 复用现有门禁 |
| 稳定 | 空编辑走一遍回环，结果收敛 | 既有 second-pass roundtrip（前置条件，不在本基准内重复） |

因此本设计的核心动作是：**把"LLM 评价"替换为"Agent 编辑任务基准测试"**——让 Agent 当被试而不是当评委，评价变成可复现、可回归、可棘轮收紧的数字。

## 3. 目标与非目标

目标：

- 建立一组固定的、机器可判定的编辑任务基准，度量反向作者包对 Agent 的真实可编辑性。
- 判定器完全确定性、不依赖任何 LLM，可进 `npm test`。
- 基准结果可作为语义重建算法迭代的目标函数和回归门禁。
- 用基准结果校准 `audit:author-editability` 的代理指标。

非目标：

- 不做单一综合评分。指标保持向量，预算显式，符合"严禁为了过门禁扩大预算或隐藏差异"的既有原则。
- 不度量 Agent 模型本身的能力优劣（通过对照组隔离，见 §5.3）。
- 不进入 InDesign CLI 插件 `tools/list`。本基准是仓库内部测试工具，与二轮回环、结构 diff 同类。
- v1 不覆盖真实 InDesign 执行层（放入 L2 扩展，见 §15）。

## 4. 总体架构：三层测量金字塔

```text
第一层（真值，贵，算法升级时跑）
  Agent 编辑任务基准：真实 Agent 在作者包上执行编辑任务
  → 任务成功率、diff 局部性、编辑成本
        │ 校准（§11）
        ▼
第二层（代理指标，便宜，每次改动都跑）
  audit:author-editability 静态指标
  → 合法性来自对第一层的预测力，预测失败就补指标
        │ 接入
        ▼
第三层（棘轮门禁，自动，挡回退）
  audit:conversion-gate + baseline 预算
  → 成功率不得下降，预算只许单调收紧
```

迭代循环变为：

```text
跑基准 → 失败任务聚类（定位失败？diff 扩散？改坏门禁？）
→ 每个聚类指向一个具名的重建层缺陷
→ 针对缺陷改 src/semantic-reconstruction / src/writers/html
→ 代理指标 + 门禁重跑，baseline 棘轮收紧
→ 回到第一步
```

LLM 给方案的位置从"评价整体好坏"移到"针对具名缺陷怎么修"，那里它才真正高效。

## 5. 被测对象与固定输入

### 5.1 关键设计：snapshot 作为固定输入，作者包现生成

`scripts/indesign-reverse-export.js --snapshot <reverse-snapshot.json>` 是纯 Node 链路：

```text
reverse-snapshot.json（固定 fixture，落库）
  → src/adapters/indesign（观察模型）
  → src/semantic-reconstruction（当前算法）
  → src/writers/html（作者包写出）
  → 被测作者包（每次基准运行时现生成）
```

这带来三个性质：

- **离线可复现。** 基准不需要真实 InDesign，可在任何环境运行。
- **对算法变化敏感。** 每次运行用当前代码重建作者包，算法改进直接反映在基准结果上；snapshot 固定不变，跨版本结果可比。
- **fixture 更新时机明确。** snapshot fixture 只在 snapshot schema 演进或 fixture 页面内容大改时重新生成（走 `npm run e2e:indesign -- -- --reverse-roundtrip` 后人工复核落库）；**不因算法迭代而更新**——算法迭代恰恰要在固定输入上对比。

### 5.2 fixture 来源与位置

| 文件 | 来源 | 说明 |
| ---- | ---- | ---- |
| `test/fixtures/editability-benchmark/snapshots/architecture-report.reverse-snapshot.json` | 由 `test/fixtures/e2e/architecture-report/` 正向构建 + 真实 InDesign 反向导出生成，人工复核后落库 | 固定输入，无客户内容 |
| `test/fixtures/editability-benchmark/cases/*.case.json` | 手写 | 任务定义（§6） |
| `test/fixtures/editability-benchmark/baseline.json` | 首轮基准运行产出 | 棘轮基线（§10） |

### 5.3 对照组（控制实验设计）

同一套任务同时在两个包变体上运行：

| 变体 | 来源 | 角色 |
| ---- | ---- | ---- |
| `forward-control` | 正向作者 fixture `test/fixtures/e2e/architecture-report/` 的副本 | 对照上限：Agent 手写的包天然可编辑 |
| `reverse-author` | §5.1 链路现生成的反向作者包 | 真实被测对象 |

判读规则：

- 任务在 `forward-control` 上失败 → 任务定义或 Agent 驱动有问题，**不计入**导出算法缺陷；先修任务。
- 任务在 `forward-control` 通过、在 `reverse-author` 失败 → 这就是导出算法的可编辑性缺陷，是迭代要消灭的目标。
- 两个变体的差距（成功率差、diff 局部性差）是"反向导出离手写作者包还差多远"的直接量化。

两个变体是同一份文档内容，任务指令引用的内容在两侧都存在。

## 6. Case 格式

每个任务一个 JSON 文件，命名 `T<两位序号>-<kebab-slug>.case.json`。

```json
{
  "kind": "EditabilityBenchmarkCase",
  "schemaVersion": 1,
  "id": "T01-edit-cover-title",
  "title": "修改封面主标题",
  "category": "text-edit",
  "instruction": "把封面页主标题改为「滨江文化中心设计汇报（修订版）」。不要改动其他任何页面和内容。改完后重新运行组装命令。",
  "target": { "page": "00-cover" },
  "expected": {
    "assertions": [
      { "type": "text-changed", "page": "00-cover", "toContains": "滨江文化中心设计汇报（修订版）" },
      { "type": "pages-byte-identical", "except": ["00-cover"] }
    ],
    "diffBudget": { "maxChangedFiles": 1, "maxChangedLines": 4 },
    "gates": { "assemble": true, "lint": true, "compileInstructions": true }
  }
}
```

字段约定：

| 字段 | 说明 |
| ---- | ---- |
| `instruction` | 交给 Agent 的自然语言指令，是工作区里 Agent 唯一能看到的任务信息 |
| `target` | 判定器用的定位提示，**不进入 Agent 工作区** |
| `expected` | 全部判定内容，**不进入 Agent 工作区**（防应试，见 §8.4） |
| `expected.assertions` | 声明式断言列表（§7），全部通过才算语义正确 |
| `expected.diffBudget` | diff 局部性预算；只统计 `pages/*.html` 与 `styles/*.css`（`deck.html` 是组装生成物，不计入） |
| `expected.gates` | 编辑后必须通过的确定性门禁 |
| `category` | `text-edit` / `resource-edit` / `structure-edit` / `style-edit`，用于失败聚类 |

`diffBudget.maxChangedLines` 由 case 作者按"理论最小改动"手工声明，v1 不自动推导。预算在两个包变体上分别记录实际值，棘轮只约束 `reverse-author` 变体。

## 7. 断言词汇表（v1）

判定器对"编辑前工作区快照"与"编辑后工作区"分别计算 `content-inventory`、`structure-signature` 与文件级 diff，然后逐条评估断言。全部复用现有审计模块，不发明新协议字段。

| 断言类型 | 参数 | 判定基础 |
| ---- | ---- | ---- |
| `text-changed` | `page`, `fromContains?`, `toContains` | content-inventory 文本摘要：目标页出现 `toContains`；`fromContains` 提供时原文本消失 |
| `text-added` | `page`, `contains` | 目标页文本条目新增且包含 `contains` |
| `text-removed` | `page`, `contains` | 目标页含 `contains` 的文本条目消失 |
| `resource-replaced` | `page`, `to` | content-inventory 资源摘要：目标页出现指向 `to` 的资源，被替换资源消失 |
| `object-removed` | `page`, `role?`, `contains?` | 目标页对象条目减少，且匹配 `role`/`contains` 的条目消失 |
| `order-swapped` | `page`, `first`, `second` | structure-signature：两个兄弟容器在页内顺序对调，其余顺序不变 |
| `style-token-changed` | `file`, `token`, `to` | 目标 CSS 文件中 token 声明值变为 `to`（正则/CSS 解析级，不做视觉渲染判定） |
| `pages-byte-identical` | `except` | `except` 之外的所有 `pages/*.html` 与全部 `styles/*.css` 逐字节等于编辑前快照 |

设计约束：

- 词汇表刻意保持小。一个任务表达不了的复杂期望，优先拆成多个断言组合；组合仍不够时才在后续版本扩词汇，并同步补判定器单测。
- 断言只消费现有报告结构；如未来需要新 `data-id-*` 字段支撑判定，必须先走 `src/protocol/` 注册表，再接入本基准。

## 8. 执行流程：prepare / edit / verify 三阶段解耦

判定器不依赖任何 LLM。Agent 只出现在中间阶段，且可以是任何被试（Claude 子代理、Codex、人类）。

### 8.1 prepare（确定性）

```powershell
npm run benchmark:editability -- -- --prepare --suite test/fixtures/editability-benchmark --workspace test/workspace/editability-benchmark-<时间戳>
```

1. 从 snapshot fixture 现生成 `reverse-author` 作者包；复制 `forward-control` 作者包。
2. 为每个（任务 × 变体）建立独立工作区目录，内含：作者包副本 + `TASK.md`（只有 `instruction` 文本和组装命令说明）。
3. 对每个工作区留存编辑前快照（用于 byte-identical 与 diff 统计）。
4. `expected`、`target`、case 文件本体**不进入工作区**。

### 8.2 edit（被试执行）

被试 Agent 进入工作区，按 `TASK.md` 完成编辑并重新组装。驱动方式不限：

- 本仓库内用 Agent 工具派子代理逐工作区执行（推荐默认）；
- 或外部 Agent CLI；
- 或人工编辑（用于调试任务定义）。

驱动方可选地在工作区写 `driver-report.json`（tokens、耗时、重试次数）；判定器把它作为可选成本指标透传，不参与 pass/fail。

### 8.3 verify（确定性）

```powershell
npm run benchmark:editability -- -- --verify --workspace test/workspace/editability-benchmark-<时间戳> [--baseline test/fixtures/editability-benchmark/baseline.json] [--out report.json]
```

对每个工作区依次执行：

1. `gates.assemble`：重新运行组装并检查产物一致性（`assemble:authoring --check` 语义）。
2. `gates.lint`：`lint:authoring`。
3. `gates.compileInstructions`：HTML → InDesign 指令静态编译成功（不调真实 InDesign）。
4. 断言评估（§7）。
5. diff 局部性统计与预算比对。

单任务判定 = 门禁全过 ∧ 断言全过 ∧ diff 预算内。

### 8.4 防应试

- `expected` 与 case 文件不出现在工作区，Agent 无法针对断言应试。
- 判定器与被试完全解耦，判定结果不受 Agent 自述影响——只看文件系统里的最终状态。

## 9. 报告格式与指标

### 9.1 单任务判定 `EditTaskVerdict`

```json
{
  "kind": "EditTaskVerdict",
  "caseId": "T01-edit-cover-title",
  "variant": "reverse-author",
  "ok": false,
  "gates": { "assemble": true, "lint": true, "compileInstructions": true },
  "assertions": [
    { "type": "text-changed", "ok": true },
    { "type": "pages-byte-identical", "ok": false, "violations": ["pages/03-design-strategy.html"] }
  ],
  "diff": { "changedFiles": 3, "changedLines": 41, "budget": { "maxChangedFiles": 1, "maxChangedLines": 4 }, "ok": false },
  "cost": { "durationMs": 182000, "tokens": null, "retries": 0 }
}
```

### 9.2 套件报告 `EditabilityBenchmarkReport`

```json
{
  "kind": "EditabilityBenchmarkReport",
  "suite": "test/fixtures/editability-benchmark",
  "algorithmRev": "<git rev>",
  "variants": {
    "forward-control": { "total": 8, "passed": 8, "successRate": 1.0 },
    "reverse-author": { "total": 8, "passed": 5, "successRate": 0.625 }
  },
  "tasks": [ "…EditTaskVerdict 列表…" ],
  "failureClusters": [
    { "category": "structure-edit", "failed": ["T05", "T06"], "dominantSignal": "diff-budget-exceeded" }
  ]
}
```

### 9.3 指标向量（不合成单一分数）

| 指标 | 定义 | 方向 |
| ---- | ---- | ---- |
| 任务成功率 | `reverse-author` 变体通过任务数 / 总数 | 越高越好，棘轮不得下降 |
| diff 局部性 | 每任务 changedLines 实际值（预算内为过） | 预算只许收紧 |
| 对照差距 | `forward-control` 与 `reverse-author` 成功率之差 | 趋零 |
| 编辑成本 | driver-report 透传（耗时/tokens/重试） | 只记录，v1 不门禁 |

## 10. 棘轮与基线

- 首轮完整运行产出 `baseline.json`（含每任务 verdict 摘要与各指标值），人工复核后落库。
- `--baseline` 提供时，verify 阶段额外判定：成功率不得低于基线；基线里已通过的任务不得转为失败；diff 预算不得放宽。违反即整体 fail。
- 算法升级使某任务从失败转为通过时，更新 baseline 并可同步收紧该任务 `diffBudget`——预算单调收紧，禁止回摆。
- 后续（Phase 3）把套件报告作为可选输入接进 `audit:conversion-gate`，与 effective-diff、editability 并列成为门禁维度。

## 11. 代理指标校准回路

第二层静态指标的合法性来自对第一层的预测力：

1. 每轮基准运行后，把 `audit:author-editability` 报告与基准结果并排比对。
2. **代理全绿但基准失败** → 代理指标漏维度。定位失败任务的根因（例如"图注与图未配对导致 Agent 无法定位编辑点"），把该维度补进 `author-editability.js` 的指标与预算，使代理层今后能廉价捕获同类缺陷。
3. **代理告警但基准全过** → 该代理指标可能过严或不相关，复核后调整或降级为 warning。
4. 每次校准结论记录到 `docs/review/`（按日期命名）；形成长期规则后沉淀到 `docs/规范/`。

## 12. v1 任务套件（8 个任务）

任务全部基于 architecture-report fixture 的实际内容（cover / agenda / site-analysis / design-strategy / drawing-sheet / material-system / metrics-table 七页），覆盖四类编辑意图。每个任务标注它主要探测的缺陷类别。

| ID | 类别 | 任务 | 主要断言 | 探测的缺陷类别 |
| ---- | ---- | ---- | ---- | ---- |
| T01 | text-edit | 修改封面主标题 | text-changed + byte-identical | 最低可定位门槛；标题语义是否可辨识 |
| T02 | text-edit | 修改 site-analysis 正文中一句话 | text-changed + byte-identical | 长文本块内定位；文本是否被切碎成难以编辑的片段 |
| T03 | resource-edit | 替换 material-system 页一张图片 | resource-replaced + byte-identical | 资源引用是否可读可换；图对象是否被几何字段缠绕 |
| T04 | structure-edit | metrics-table 表格加一行 | text-added ×N + byte-identical | 表格是否保持 table 语义而非退化为散落文本框 |
| T05 | structure-edit | design-strategy 页对调两个图块顺序 | order-swapped + byte-identical | 语义容器边界是否成立；顺序是否由 DOM 而非绝对几何表达 |
| T06 | structure-edit | 删除一个图+图注对 | object-removed ×2 + byte-identical | 图文配对是否成立；删除是否牵连无关对象 |
| T07 | style-edit | 修改一个样式 token（如主色） | style-token-changed + pages 全部 byte-identical | 样式是否收敛到 token/CSS 层，还是散落为内联样式 |
| T08 | text-edit | 修改 drawing-sheet 页一条图注 | text-changed + byte-identical | 图注可定位性；figure/figcaption 结构是否保留 |

预期失败模式与算法缺陷的映射（用于失败聚类）：

- 断言失败（找不到/改错地方）→ 语义容器缺失、命名不可辨识、文本切碎。
- diff 预算超标 → 内联样式泄漏、低层几何字段泄漏、组装产物不确定性。
- byte-identical 违例 → 组装或写出层的非确定性输出（本身就是缺陷）。
- 门禁失败 → 导出的包"能看不能改"，编辑触发即碎。

v2 候选（本版不做）：新增一页（复制模板页改内容）、跨页移动对象、无标注 snapshot 变体（程序化剥离 `html_indesign` 标签走观察模式重建，度量纯语义重建的可编辑性下限）。

## 13. 代码落点与命名

| 路径 | 职责 |
| ---- | ---- |
| `src/writers/html/audit/edit-task-verdict.js` | 判定器纯函数：输入（case、编辑前快照、编辑后工作区、门禁结果）→ `EditTaskVerdict`；与现有审计模块同层，复用 content-inventory / structure-signature |
| `scripts/benchmark-editability.js` | 编排 CLI：`--prepare` / `--verify` / `--suite` / `--workspace` / `--baseline` / `--out`；参数风格与现有 audit 脚本一致（同时支持空格与 `=` 形式） |
| `test/fixtures/editability-benchmark/` | cases、snapshot fixture、baseline |
| `test/editability-benchmark/edit-task-verdict.test.js` | 判定器单测（§15 Phase 1） |
| `test/workspace/editability-benchmark-<时间戳>/` | 运行产物，不进版本库 |

npm script：`"benchmark:editability": "node scripts/benchmark-editability.js"`。

## 14. 边界约束（与 AGENTS.md 硬规则的对齐）

- **内部测试工具。** 不进入插件 `tools/list`，与二轮回环、结构 diff、P0/P1 门禁同类。
- **不私造协议字段。** 断言只消费现有 content-inventory / structure-signature / CSS 事实；需要新字段先改 `src/protocol/` 注册表。
- **失败要早于假成功。** 判定器对无法评估的断言（页面缺失、报告损坏）显式 fail 并给出原因码，不静默跳过。
- **兜底默认有害。** 无 baseline 时只输出报告不做棘轮判定，并在输出中显式标注 `baseline: null`；不隐式用当前值当基线。
- **fixture 卫生。** 全部素材源自 architecture-report 自有 fixture，无客户内容、无真实项目路径。
- **可验证才算完成。** 判定器自身必须可测（§15 Phase 1 的脚本化正/负样本），不允许"判定器对不对靠肉眼"。

## 15. 实施阶段与验证清单

### Phase 1：判定器与最小闭环

- 落地 `edit-task-verdict.js` + 断言词汇（§7 全部类型）。
- 落地 `benchmark-editability.js` 的 `--prepare` / `--verify`。
- 生成并落库 snapshot fixture。
- 写 T01（text-edit）、T03（resource-edit）两个 case。
- **判定器自测（无 LLM）**：单测中用脚本模拟"完美编辑"（必须 pass）和至少三种"坏编辑"（改错页、全局重排格式、改对内容但组装失败——必须 fail 且原因码正确）。
- 验证：`npm test` 全绿；手工在 `forward-control` 上人工完成 T01 走通全流程。

### Phase 2：全套件与首个基线

- 补齐 T02–T08 共 8 个 case。
- 用子代理跑通 `forward-control` 全绿（任务定义 sanity check），再跑 `reverse-author` 得到首个真实成功率。
- 产出并落库 `baseline.json`；首份基准报告与失败聚类分析进 `docs/review/`。

### Phase 3：棘轮与校准制度化

- `--baseline` 棘轮判定接入 verify。
- 套件报告作为可选维度接入 `audit:conversion-gate`。
- 执行 §11 校准回路至少一轮，把发现的缺失维度补进 `author-editability.js`。

### Phase 4（可选扩展）

- 无标注 snapshot 变体（观察模式重建的可编辑性下限）。
- L2 真实 InDesign 层：编辑后的包走 `e2e:indesign --reverse-roundtrip`，接 conversion-gate 全量门禁（只在触及执行层时跑）。
- 编辑成本（tokens/耗时）纳入趋势跟踪。

## 16. 开放问题

| 问题 | v1 处理 | 后续方向 |
| ---- | ---- | ---- |
| Agent 随机性导致任务偶发失败 | 单次运行；失败任务允许一次复跑并在报告中标注 `reruns` | 3 次多数决；把波动率本身作为指标 |
| `maxChangedLines` 的"理论最小"如何确定 | case 作者手工声明，在 `forward-control` 上实测校准 | 依据编辑前后 AST diff 自动推导下界 |
| 被试 Agent 的选型是否影响跨版本可比性 | 报告记录被试标识；棘轮比较要求同被试 | 固定一个廉价被试作为标尺被试 |
| 编辑后的包是否要求二次回环稳定 | 不要求（L0 只到指令静态编译） | Phase 4 L2 接入 |
