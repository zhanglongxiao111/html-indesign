# 作者检查失败反馈设计

## 1. 目标

让 `html.authoring_lint` 失败时，Agent 只读返回值的首条消息就能判断三件事：错误规模、错误性质（是零散多处还是单一系统性成因）、下一步去哪里看完整清单。

本设计不新增诊断字段体系，不改检查规则本身，不改判定严格程度。它只处理**失败时反馈信息的组织方式**。

## 2. 背景与证据

### 2.1 生产失败现场

2026-08-12，某工位（`indesign-cli` 0.5.9 / `html-indesign` 0.2.8）手写作者包
`C20260806_小院组团\00_agent\亮马西院_高端餐饮_INDD作者包`，`strict: true`，两次调用 `html.authoring_lint`：

| 时刻（UTC） | 结果 | error_count | warning_count | compatibility_normalized |
| --- | --- | --- | --- | --- |
| 05:37:45 | 失败 | 91 | 23 | 14 |
| 05:43:29 | 失败 | 91 | 23 | 14 |

两次之间 Agent 修改了 `pages/02、03、04` 和 `deck.html`，**三项计数完全没有变化**。第三次修改 `pages/01` 后作者包被弃置，当日后续交付改用其他工具链完成。

Agent 当时收到的首条消息全文：

```
Authoring lint reported errors; fix the package before compiling.
```

`error_count=91` 只存在于遥测 `plugin_metrics`，属于上报通道，不在返回给 Agent 的消息里。

### 2.2 离线复现实测（2026-08-15）

原作者包复制到临时目录、`strict: true` 重跑，`indesign-cli` 0.5.9 / `html-indesign` 0.2.8：

**第一次运行（保持原样）** —— `errorCount = 1`：

```json
{"level":"error","code":"AUTHOR_GENERATED_ENTRY_DIRTY",
 "message":"AUTHOR_GENERATED_ENTRY_DIRTY: generated deck.html is out of date: ...",
 "entryPath":"...\\deck.html",
 "hint":"重新组装作者包后重试：& \"<runtime_root>\\node\\node.exe\" \"...\\assemble-authoring.js\" --package \"...\\deck.config.json\""}
```

`lint.js:42-53` 在入口文件过期时**直接短路返回**，真实的规则检查根本没有执行。作者包最后一次修改 `pages/01`（13:44:40）之后从未重新组装，`deck.html` 停在 13:43:24 的版本。

**第二次运行（先按 hint 重新组装）** —— 真实结果：

| 指标 | 值 |
| --- | --- |
| `errorCount` | 73 |
| `warningCount` | 23 |
| `issueCount` | 96 |
| 返回体总长 | 52,678 字符 |

错误分类：

| code | 条数 | 占比 |
| --- | --- | --- |
| `GRID_ALIGNMENT_OFF` | 73 | **100%** |

按页分布：`page-4` 31、`page-2` 27、`page-3` 15、`page-1` 0。
按边分布：`top` 59、`left` 58、`right` 57、`bottom` 0。

告警分类：`HTML_ROLE_INFERRED` 13、`SEMANTIC_TOKEN_MISSING` 9、`HTML_INLINE_SVG_NORMALIZED` 1。

单条错误结构完整，定位充分，但**73 条无一自带 `hint`**：

```json
{"level":"error","code":"GRID_ALIGNMENT_OFF",
 "message":"Item edges do not align to the declared authoring grid.",
 "pageId":"page-2","itemId":"p2-el1","edges":["right"]}
```

（08-12 是 91、本次是 73，差异来自 `deck.html` 版本不同——08-12 那次 `pages/01` 的最后一次改动尚未进入 `deck.html`。量级与性质一致，不影响本设计结论。）

### 2.3 实测推翻的两个先前判断

**先前判断一（错误）**：作者包用 CSS Grid + 自定义属性间接定位，几何无法解析，属于结构性不可读。

**实测**：`dataIdAudit.valid = true`、`sourceFormat.valid = true`、`semanticAudit.valid = true`，`data-id-grid-ignore` 也在 `accepted` 列表内。**几何完全解析成功**，唯一问题是算出的元素边不落在声明的 12×8 网格线上。

**先前判断二（错误）**：`details` 可能在 CLI 到 Agent 之间被截断，所以 Agent 拿不到明细。

**实测**：73 条错误完整出现在 `error.details.errors` 中，返回体 52,678 字符，**没有截断**。

结论随之改变：信息一直在返回值里，问题纯粹是**顶层 `message` 是写死常量，把下层已有的信息全部抹掉**，而 Agent 首先读的是 `message`。

### 2.4 一个更强的对照：好 hint 被上层抹掉

`AUTHOR_GENERATED_ENTRY_DIRTY` 那条错误自带一条**可直接执行的完整修复命令**（见 2.2）。但同一次返回里：

- 顶层 `error.message` = `Authoring lint reported errors; fix the package before compiling.`
- 顶层 `error.hint` = `null`

**下层已经写好了 hint，上层把它丢了。** 这不是"没有信息"，是"有信息但没往上传"。

### 2.5 这是既有 spec 的落地缺口

`2026-08-03-html-authoring-compatibility-and-agent-feedback-design.md` §4.3 已规定：

> CLI 的第一条错误消息保持简短，但报告 artifact 必须包含全部问题。Agent 能从返回值直接知道下一步，不需要先打开源码寻找错误含义。

`html.authoring_lint` 的失败路径没有落地这一条。本设计是该条款在单独检查入口的补齐，不是新方向。

### 2.6 四处具体缺口

| 缺口 | 位置 | 现状 |
| --- | --- | --- |
| 首条消息写死 | `src/indesign-cli-plugin/tools/authoring-lint.js:27` | 常量字符串，不引用 `result` |
| 同能力已存在但未共用 | `src/indesign-cli-plugin/tools/build-indesign.js:172` `lintFailureMessage()` | 能拼出计数与首条定位，仅 `build` 路径使用 |
| 顶层 hint 恒为 null | 同 `authoring-lint.js:23-31` | 下层 `details.errors[].hint` 有值时也不上浮 |
| 无报告 artifact | `src/indesign-cli-plugin/tool-catalog.js:23,26` | `produces_artifacts: false`；`failure_example` 示例本身即无信息量 |

## 3. 核心原则

1. **同一批检查结果，两个入口首条消息同口径。** `html.authoring_lint` 与 `html.build_indesign` 对同一份 lint 结果必须给出信息量等价的首条消息。
2. **首条消息必须承载规模与性质。** 只给总数不足以区分「多处独立问题」和「单一系统性成因」；必须按 rule code 给出分类计数，并在高度集中时显式点明。
3. **下层 hint 必须上浮。** 任一错误自带 `hint` 时，顶层 `hint` 不得为 `null`。
4. **短路失败必须自我说明。** 入口文件过期这类前置短路，必须让 Agent 知道「真实检查尚未执行」，否则 `errorCount: 1` 会被误读成「只剩一个问题」。
5. **失败也落报告。** 成功与失败都产出报告 artifact。
6. **不新增第二套诊断系统。** 分类计数由既有 `errors[].code` 聚合得到，复用 08-03 spec §4.2 的 `compatibility` 汇总视图约定。

## 4. 首条消息口径

### 4.1 结构

```
Strict authoring checks found <N> errors (<code>: <n>[, <code>: <n>...]).
[集中提示]
First issue at <pageId> / <itemId>: <message>
```

- `<N>` 取 `errorCount`；分类按 `errors[].code` 计数降序，最多列三类，其余归 `other`。
- **集中提示**：当单一 code 占比 ≥ 80% 时追加，措辞随集中度分两种——

  100%：`All <N> errors share code <code> — this is one systemic cause, not <N> independent fixes.`

  80%–99%：`<n> of <N> errors share code <code> — treat those as one systemic cause, then handle the remaining <N-n> separately.`

  本案 100% 集中，这句话是 Agent 判断「该调整网格/容差」而非「逐个改 73 处」的关键。

  **两种措辞不可合并。** 阈值是 80%，但 `All errors share code X` 只在 100% 时成立；9:1 的情况下沿用该措辞，Agent 会以为调一次容差就能清零，漏掉剩下那一条——本设计的主题恰恰是不许首条消息误导 Agent，在这里说假话等于自伤。
- 首条定位沿用 `lintFailureMessage()` 既有逻辑。
- 非严格与严格模式共用结构，前缀词按 `strict` 取值区分。

### 4.2 实测对照

改造前（Agent 在 2026-08-12 实际收到的全部内容）：

```
Authoring lint reported errors; fix the package before compiling.
```

改造后（基于 2026-08-15 实测数据）：

```
Strict authoring checks found 73 errors (GRID_ALIGNMENT_OFF: 73).
All errors share code GRID_ALIGNMENT_OFF — this is one systemic cause,
not 73 independent fixes. Affected: page-2 (27), page-3 (15), page-4 (31);
edges top/left/right.
First issue at page-2 / p2-el1: Item edges do not align to the declared authoring grid.
Full report: <outDir>\authoring-lint-report.json
```

短路场景（第一次运行）改造后：

```
Authoring lint did not run: generated deck.html is out of date.
Reassemble the package and retry: & "<runtime_root>\node\node.exe" ... --package "...\deck.config.json"
```

要点：`errorCount: 1` 绝不能作为首条消息的主语——真实检查尚未执行。

### 4.3 实现约束

`lintFailureMessage()` 从 `build-indesign.js` 提取到 `src/indesign-cli-plugin/lint-feedback.js`，两入口共同引用；分类聚合与集中判定作为该模块新增函数，`build` 与 `lint` 同时受益。

## 5. 报告 artifact

`html.authoring_lint` 失败时写出 `authoring-lint-report.json`，内容为完整 lint 结果（含 `errors`、`warnings`、`compatibility`），不含浏览器快照。

- 落点：`args.outDir`；未提供时落作者包根目录下的 `.indesign-cli/`，不污染作者源码目录。
- `tool-catalog.js` 中 `produces_artifacts` 改为 `true`，`side_effects` 增加 `filesystem_write`。
- 成功路径保持现状。

优先级说明：实测已确认 `details` 不截断（2.3），故报告文件是**便利与事后审计**手段，不是唯一通道；但仍应实现——它是离线复盘的唯一材料来源（参见 SA-AIAPP#385 缺口三：放弃的会话不落存档）。

## 6. 错误返回结构

```json
{
  "status": "error",
  "error": {
    "code": "AUTHORING_LINT_FAILED",
    "message": "<§4.1 口径>",
    "stage": "lint",
    "hint": "完整错误清单见 error.details.errors（73 条）与报告文件 <path>。",
    "details": { "...": "既有 result + stage + metrics，结构不变" }
  }
}
```

`details` 结构不变。`hint` 由 `null` 改为显式指路；下层错误自带 `hint` 时，优先上浮该 hint。

`tool-catalog.js` 的 `failure_example` 同步替换为符合 §4.1 口径的示例——Agent 调用前读工具说明，示例本身即是对「失败时能拿到什么」的承诺。

## 7. 验证

1. 先写失败测试：用 2026-08-12 作者包作为 fixture，断言失败消息包含 `73`、`GRID_ALIGNMENT_OFF`、集中提示句、首条定位 `page-2 / p2-el1`。
2. 构造多类错误的 fixture，断言分类计数正确、集中提示**不**出现（占比 < 80%）。
3. 断言 `html.authoring_lint` 与 `html.build_indesign` 对同一 fixture 产出同口径首条消息。
4. 断言短路场景（入口文件过期）的消息明确表达「检查未执行」，且顶层 `hint` 上浮了下层的重组装命令。
5. 断言失败时 `hint` 非空且含报告路径，报告文件存在且可解析、不含浏览器快照。
6. 运行全量 `npm test`、插件校验与打包预检。
7. 更新统一 Skill 后做无答案泄漏的 Agent 前向测试：Agent 读到新消息后应识别为单一系统性成因，而非逐页试改。

## 8. 非目标

- 不改检查规则、判定阈值或严格模式语义。
- 不自动改写作者 HTML/CSS。
- 不在错误消息中提供修改教程或代码示例。
- 不为成功路径新增产物。
- 不解决 `GRID_ALIGNMENT_OFF` 本身——73 个元素为何整体偏移（`top`/`left`/`right` 三边普遍未对齐、`bottom` 全对齐）属于网格判定或容差问题，另行开单调查。
