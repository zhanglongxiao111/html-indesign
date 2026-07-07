# 架构加固与护栏体系设计

- 日期：2026-07-06
- 状态：提案（未实施）
- 类型：方案设计（过程文档）
- 依据：`docs/review/2026-07-06-架构健康度审查报告.md`（下称审查报告，全部 file:line 证据在其中）
- 关联：`AGENTS.md` §2/§5、`src/protocol/`、`src/semantic-model/`

## 1. 背景与根因诊断

审查报告结论：本仓库小尺度纪律优秀（无巨型文件、无深嵌套、无循环依赖），但三个核心架构承诺——统一语义模型、协议注册表唯一事实源、adapters→semantic-model→writers 单向分层——**只存在于文档，没有任何机器强制**，且已发生真实病变（模型两种方言、三处白名单漂移、双向直连、门禁假通过路径）。

根因不是执行者水平差，而是：**规则只写在 AGENTS.md 里，对无记忆、局部视野的执行者（GPT/任何 Agent）等于不存在。** 文档约束不了下一个执行者；测试可以。

因此本方案由两部分组成，**护栏是主体，修复是随行**：

1. **护栏体系（§3）**：把每条架构规则变成 `npm test` 里会变红的静态测试，带豁免基线和棘轮机制。
2. **修复工作包（§4）**：按审查报告修掉已知病变，每修一处收掉一条豁免。

## 2. 核心理念（执行者必读）

- **护栏先行。** 先立护栏（用豁免基线圈住现有违规），再动手修复。这样修复过程中不可能引入新违规——护栏立起来的那一刻，架构就停止恶化。
- **豁免基线只许收缩。** 每条护栏配一份 JSON 基线文件，列出当前已知违规。修掉一处，必须同轮删掉对应豁免条目；新增豁免条目视为架构回退，需要用户明确批准并在条目里写明原因和收口计划。
- **失败信息必须自带"泰山"。** 每条护栏测试失败时的输出必须包含三段：违反了什么规则、为什么有这条规则（一句话）、修复方向和本文档路径。执行者看到红测试的那一刻就能拿到全局上下文，不需要它自己"想起来"去读架构文档。
- **严禁为过护栏放宽护栏。** 修复的定义是让代码符合规则，不是修改断言、扩大豁免或调整扫描范围让测试变绿。发现护栏本身有误报，停止并报告，不自行放宽。
- **架构裁定已在本文档做完。** §4 每个工作包都给出了裁定结果或裁定方法，执行者照裁定落地，不重新发明方案；对裁定有异议时停止并报告，不擅自改道。

## 3. 护栏体系设计

护栏全部放 `test/architecture/*.test.js`，基线放 `test/architecture/baselines/*.json`，随 `npm test` 运行（现有 glob `test/**/*.test.js` 自动覆盖）。护栏测试自身必须有正反自测（构造一个违规样本，断言护栏能抓住它）。

### 通用棘轮机制

每条带基线的护栏遵循同一逻辑：

- 实际违规集合 ⊄ 基线 → **fail**（出现新违规）。
- 基线条目在实际违规中已不存在 → **fail**（过期豁免，强制删除条目——保证清单诚实收缩）。
- 基线条目格式：`{ "rule": "...", "file": "...", "detail": "...", "reason": "既有违规待收口", "cleanupRef": "对应工作包编号" }`。

### G1 依赖方向护栏（对应审查报告 §5）

规则（解析 `src/` 与 `scripts/` 全部 require 语句构建依赖图后断言）：

1. `src/adapters/**` 不得 require `src/writers/**`；反之亦然。
2. `src/semantic-model/`、`src/protocol/`、`src/shared/` 不得 require adapters / writers / scripts / semantic-reconstruction。
3. `src/**` 不得 require `scripts/**`（方向只能是 scripts → src）。
4. `src/semantic-reconstruction/**` 只得 require semantic-model / protocol / shared。
5. `src/indesign-cli-plugin/**` 只得 require 各模块的公共入口（`src/<module>/index.js` 或其导出面），不得深入内部文件路径。
6. 依赖图无环。

初始基线：审查报告 §5 的已知违规（adapters/html→writers/indesign 的 style-compiler、writers/indesign→adapters/html 的两处、plugin→scripts、plugin 绕过 authoring 入口）。

### G2 协议字面量护栏（对应审查报告 §4）

规则：`src/`（`src/protocol/` 除外）与 `scripts/` 中不得出现裸 `data-id-` 字符串字面量；属性名必须从 `src/protocol/` 导出的常量表引用。同理适用于 `html_indesign` payload 字段名。

前置：本护栏依赖 W2 提供常量导出，因此初始基线为当前全部 47 个文件；W2 每迁移一个文件删一条。

### G3 模型出口契约护栏（对应审查报告 §3）

规则：

1. 静态断言：`src/adapters/html/normalizer/snapshot-to-model.js` 与 `src/adapters/indesign/normalizer/snapshot-to-model.js` 的模型出口路径上必须调用 `validateSemanticModel`（strict）。
2. 行为断言：向任一 adapter 喂结构非法的输入，出口必须抛错或返回显式失败，不得产出"看起来能用"的模型。
3. 同构断言（方言探测器）：用共享 fixture 分别驱动两个 adapter，对产出模型做字段面比较——同一概念的字段名、缺省值表示法必须一致；`items[].bounds` 满足同一契约（绝对页面坐标、pt 单位），不论计算路径。字段面清单以 registry 为准生成，不在测试里手抄第二份。

初始基线：W1 完成前，同构断言对已知方言差异（type/sourceType、semantic null/'unknown'、styleRefs 键集）挂豁免。

### G4 门禁反假成功护栏（对应审查报告 §2.1）

规则：

1. 每个审计模块（`src/writers/html/audit/*`、`src/adapters/indesign/audit/*` 及后续新增）必须有"空输入 / 损坏输入必须 fail 且原因码明确"的测试用例族；护栏测试枚举审计模块清单并断言对应测试文件存在这类用例（按命名约定识别，如 `*-invalid-input` 测试名前缀）。
2. 所有 `scripts/audit-*.js` CLI 出口：无法判定 pass/fail 时（输出损坏、输入缺失）exitCode 必须非 0——用子进程冒烟测试断言。

这条护栏的意义：content-inventory 是"无丢失硬门槛"，它假通过则一切审计体系（包括可编辑性基准）都不可信。

### G5 退役命名护栏（对应审查报告 §2.2、§6）

规则：`src/`、`scripts/`、`_indesign_scripts/`、`test/` 中禁止出现退役架构标识符：`legacy`（作为代码路径/函数名/分支，观察标签 `legacy-label` 与 protocol lifecycle `deprecated/retired` 词表除外，白名单显式列出）、`pagedHtml`/`paged-html`（`docs/legacy/` 除外）。

初始基线：`hi_executor.jsxinc` 的 legacy 分支、`test/paged-html/`、`test/indesign-reverse/` 目录（W0/W4 收口）。

### G6 单一实现护栏（对应审查报告 §4 重复工具）

规则：以下已裁定收敛到 `src/shared/` 的函数名，不得在 shared 之外重新定义（按 `function <name>` / `const <name> =` 扫描）：`normalizeText`、`safeClass`、`safeClassToken`、`sanitizeStyleName`、`cssLengthToMm`、`cssLengthToPx`、`cssLengthToPt`、`parseZIndex`。清单随 W2 收敛工作扩充。

初始基线：当前全部重复定义点。

### G7 文档-代码同步护栏（对应审查报告 §5 隐藏第三层、§6）

规则（纯机械断言，防文档漂移）：

1. `src/` 每个顶层目录必须出现在 AGENTS.md §4 仓库地图表格中。
2. `package.json` 每条 `audit:*`/`benchmark:*` script 必须出现在 AGENTS.md §9 执行基线表中。

初始基线：`src/authoring`、`src/semantic-preset`、`src/shared` 未登记；`audit:synthesized-styles` 未登记（W0 顺手收口）。

### G8 孤儿模块护栏

规则：`src/**` 中每个 `.js` 文件必须被至少一处 require（同模块 index、跨模块、scripts 或 test 均可）；完全无人引用的文件 fail。

初始基线：`stacking.js`、`style-reader.js`（W0 删除后清空）。

## 4. 修复工作包与架构裁定

### W0 急症（先做，1-2 天量级）

1. **门禁假通过**：`content-inventory.js` 的 `comparePageCounts` / 主循环对空 `pages` 显式 fail（新增原因码 `CONTENT_INVENTORY_INPUT_INVALID`）；`readAssetAliases` 解析失败记录 warning 而非静默空表；`structure-signature.js`、`reverse-snapshot-structure.js` 矢量比对、`parent-page-furniture.js` 同模式逐一排查；`scripts/audit-effective-diff.js` CLI 出口 catch 改为 exitCode 非 0。**裁定：空输入永远是错误，不存在"两边都空所以相等"的合法情形。**
2. **legacy 死分支**：删除 `hi_executor.jsxinc` 的 `runLegacyBuildInstructions` 与 legacy schema 分支，`runPagedHtmlBuildInstructions` 改名为符合当前架构的名称（如 `runBuildInstructions`），同步修正 `executor-script-static.test.js` 断言与错误提示文本。
3. **孤儿模块**：删除 `src/adapters/html/reader/stacking.js`、`style-reader.js`。
4. **文档同步**：AGENTS.md 补登 `src/authoring`、`src/semantic-preset`、`src/shared`（地图 + 边界规则一句话）与 `audit:synthesized-styles`。

### W1 模型方言统一（最高杠杆）

裁定结果：

| 分歧 | 裁定 |
| ---- | ---- |
| `items[].type`（HTML 侧，未登记） vs `items[].sourceType`（InDesign 侧，已登记） | canonical 为 `role`（语义角色）+ `sourceType`（来源格式观察事实）双字段；HTML 侧未登记的 `type` 退役删除。执行者先列出全部 `type` 读取点再迁移，三选一读取（`role \|\| type \|\| sourceType`）随之消灭 |
| `semantic` 缺省 | canonical 为 `null`。InDesign 侧 `'unknown'` 哨兵串退役；`semantic-reconstruction/reconstruct.js` 等下游判断同步收敛为单一判空 |
| `styleRefs` 键集 | 在 registry 为 `items[].styleRefs` 登记允许键的枚举（paragraphStyle/characterStyle/objectStyle/frameStyle/tableStyle/各 DisplayName/synthesizedToken/synthesizedName/layer），两侧 adapter 只产出枚举内的键 |
| `bounds` | 契约统一为"绝对页面坐标、pt 单位、同一数组形状"；两侧计算路径可以不同，但必须通过 G3 的同一契约断言 |
| format 专有字段（`effects`、`textFrameStyle` 等） | 迁入 `items[].extensions.indesign.*` 结构命名空间，registry 同步改 canonical path。工作量大时允许拆为 W1 第二阶段，但不得半途停在"部分平铺部分隔离" |

步骤纪律：先在 registry 裁定并登记 → 两侧 adapter 对齐产出 → 两个出口接入 `validateSemanticModel(strict)` → G3 豁免逐条收口 → 最后一步才允许剥除 writers 的防御式多路径读取（每剥一处配测试，兜底剥除必须在契约强制之后，顺序不得颠倒）。

### W2 注册表升级为源头

1. `src/protocol/` 新增常量导出面：属性名常量表（由 fields 数据生成，不手抄第二份）、`data-id-role` 合法值枚举、语义样式 kind 枚举。
2. 收编三处已漂移清单，裁定如下：
   - **svg 角色**：以 `src/writers/indesign` 对 svg 项的实际编译行为为准裁定（vector 指令走哪个 role 分支，那就是 canonical 答案），把分类逻辑收敛为一个共享分类函数，audit 侧调用同一函数。执行者先取证再改，两边必须引用同一实现。
   - **role 枚举**：registry 登记完整值域（含 background/decoration/annotation），`authoring-validator.js` 的过期子集改为引用枚举（其"作者可写子集"如确实小于全集，须在 registry 里作为显式声明，而不是本地手抄）。
   - **SAFE_TAGS**：两份清单若服务同一概念则合并为 shared 单一定义；若确属两种不同策略（作者包 vs 视觉 HTML），必须改成不同名字并各自写明用途注释——禁止同名异义。
3. `normalizeText` / `safeClass` 族 / 单位换算 / NAS 路径逻辑收敛到 `src/shared/`：同名不同义的先按语义拆成不同名字（如 `normalizeLineEndings` vs `collapseWhitespace`），再逐点替换引用。`authoring-validator.js` 的动态 px→mm 换算语义与固定 96dpi 不同，属两个概念，命名区分，不强行合并。
4. 47 个文件的 `data-id-` 字面量机械迁移为常量引用，G2 基线逐文件收口。

### W3 链路归位

1. 反向流水线组装（snapshot → 观察模型 → semantic-reconstruction → 作者包 → 审计落盘）从 `scripts/indesign-reverse-export.js` 上移为 src 模块（建议 `src/writers/html/reverse-pipeline.js` 或独立编排模块，执行者按现有 index 导出习惯落位）；脚本与 `indesign-cli-plugin/tools/reverse-export.js` 都改调 src 入口，解除 plugin→scripts 依赖倒置。
2. `scripts/audit-conversion-gate.js` 的门禁算法迁入 src 审计层（脚本保留薄 CLI）；`scripts/audit-reverse-visual.js` 的浏览器几何捕获合并回 `src/adapters/html/reader/`，消除平行实现。
3. 拆双向直连：`adapters/html/normalizer` 对 `writers/indesign/style-compiler` 的调用——被共用的纯样式编译逻辑下沉 `src/shared/` 或移入 semantic-model 层（它产出的是模型的 `styles` 字段，本就属于归一化职责）；`writers/indesign/instructions-compiler.js` 的"快照→模型→指令"组合入口上移到编排层（可与本条 1 的编排模块同层），writer 内部不再 require adapter；`graphic-instructions.js` 所需的 placement 信息改由模型字段承载。
4. `indesign-e2e.js` 中无 src 对应的审计函数（二次回环稳定审计等）迁入对应 audit 模块，脚本只保留流程编排。

### W4 卫生（随手做，不单独立项）

`test/paged-html/`、`test/indesign-reverse/` 及对应 fixtures 目录改名对齐现行架构；`instructionItemFor` 按角色拆函数；`compareVisualGeometry` 拆两级；重复 `bordersAreUniform` 上提 `box-model.js`；`SEMANTIC_CONTAINER_CLASSES` 与语义 preset 对齐；`extract_blueprint.jsx` 列入 blueprint 路径退役观察清单。

## 5. 阶段顺序与依赖

```text
阶段 0：立全部护栏 G1–G8（豁免基线圈住现状）→ 架构从此刻起停止恶化
阶段 1：W0 急症（G4/G5/G7/G8 豁免清零）
阶段 2：W1 模型统一（G3 豁免清零）——可与可编辑性基准计划并行，但 W0 必须先于基准首轮运行
阶段 3：W2 注册表源头化（G2/G6 豁免收口）
阶段 4：W3 链路归位（G1 豁免清零）
阶段 5：W4 卫生随手收口
```

依赖关系：G2 依赖 W2 第 1 步的常量导出，故 G2 允许"先立规则+全量豁免"再随迁移收口；其余护栏立即生效。W1 与 W2/W3 无硬依赖，可按执行者带宽排列，但每个工作包内部顺序（先 registry 后代码、先契约后剥兜底）不得颠倒。

## 6. 治理规则（对执行者的元规则）

1. 动工前先读本文档与审查报告；每轮任务只领一个工作包。
2. 豁免基线只减不增。需要新增豁免 = 停止并报告，等待用户裁定。
3. 修复 = 让代码符合规则。修改护栏断言、扩大豁免、缩小扫描范围让测试变绿，视为造假。
4. 每完成一个修复点：删对应豁免条目 + 跑 `npm test` 全绿 + 在提交信息里引用工作包编号。
5. 护栏测试失败信息必须包含：规则、一句话理由、修复方向、本文档路径。写护栏时这是验收项，不是可选项。
6. 对本文档裁定有异议或发现裁定与代码事实冲突：停止并报告，附证据；不擅自改道。

## 7. 验收定义

- 全部 8 条护栏落地、自测（能抓住人造违规样本）通过、随 `npm test` 运行。
- 阶段 1 结束：W0 四项完成，对应豁免为零，content-inventory / effective-diff 对空输入 fail 有回归测试。
- 阶段 2 结束：G3 三条断言无豁免通过；`validateSemanticModel` 在两个 adapter 出口强制运行；registry 中方言字段裁定全部落地并重新生成 `PROTOCOL_FIELD_REGISTRY.md`。
- 阶段 3 结束：G2 基线归零；三处漂移收编且有单一实现；G6 基线归零。
- 阶段 4 结束：G1 基线归零；plugin 不再 require scripts；conversion-gate 逻辑在 src。
- 全程：`npm test` 全绿；真实 InDesign E2E 在触及执行链路的阶段（W1/W3）至少各跑一次回归。

## 8. 风险与开放问题

| 风险 | 控制 |
| ---- | ---- |
| W1 改模型字段牵动面大，回归风险高 | 先立 G3 契约测试再改；分字段小步提交；每步 `npm test` + 触及执行链路时跑真实 E2E |
| 护栏误报造成执行者绕路 | 护栏自测必须含正反样本；误报时的动作是"报告并修护栏"，写进治理规则 |
| 豁免基线变成永久停车场 | 过期豁免强制删除机制（§3 通用棘轮）+ 每个条目带 cleanupRef；阶段验收以"基线归零"为准 |
| svg 角色等裁定与深层下游预期不符 | 裁定方法是"以 writer 实际编译行为为准取证后统一"，不是拍脑袋定值；取证结果与本文档预期不符时停止报告 |
| 执行者在 W3 搬迁时顺手重构无关代码 | 治理规则限定每轮一个工作包；搬迁 = 移动 + 改 require，不附带行为变更，行为变更单独立项 |
