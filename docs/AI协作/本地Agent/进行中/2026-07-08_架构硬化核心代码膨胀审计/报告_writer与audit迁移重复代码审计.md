# writer 与 audit 迁移重复代码审计报告

## 审计方式

- 只读静态审计；未运行会写 `test/workspace/` 的测试或真实 InDesign。
- 已完整阅读任务文件：`docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/任务_writer与audit迁移重复代码审计.md`。
- 主要命令摘要：
  - `git diff --numstat 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/writers scripts`
  - `git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- scripts/... src/writers/...`
  - `rg -n "function |module\\.exports|require\\(|fallback|default|try|catch|process\\.exit\\(0\\)|warning" scripts src/writers/...`
  - `rg -n "compareVisualGeometry\\(|auditReverseAuthorPackage|compileReverseSnapshotToHtml" scripts src test`

## 当前结论

结论：**不存在 script 和 src 各保留一整份同算法的大面积重复实现，但迁移没有完全收口；仍存在旧算法残留和双路径门禁。**

- `scripts/audit-conversion-gate.js`、`scripts/indesign-reverse-export.js` 已基本变成薄 CLI。
- 仍有两处没有达到“脚本只做 CLI、核心算法全在 src”的目标：
  1. `reverse export` 与 `e2e reverse-roundtrip` 形成强弱不同的 author audit 双路径。
  2. `audit-reverse-visual` 仍把关键证据补全逻辑留在脚本里。

风险等级：**P1**

## 关键 findings

### 1. [P1] reverse export 与 e2e reverse-roundtrip 仍是两套强弱不同的 author audit 路径

**结论**

`src/reverse-pipeline/` 只接了低阶 `author-audit`，而更强的 `sourceRoundtrip/contentInventory/structureSignature/canonicalStability` 仍只在 `scripts/indesign-e2e.js` 的回环路径里组合执行。结果是：**同样带 `sourceRoot` 的 reverse export，非 E2E 路径可能提前成功，E2E 路径才会失败。**

**证据**

- `src/reverse-pipeline/index.js:34-41`
  - 写出 author package 后，只调用 `src/writers/html/audit/author-audit.js` 的低阶 `auditReverseAuthorPackage(outDir, { model })`。
- `src/writers/html/audit/reverse-roundtrip.js:47-140`
  - 这里才有高阶 author audit：
    - `sourceRoundtrip`：`66-78`
    - `contentInventory` / `structureSignature`：`79-95`
    - advisory/hard gate 汇总：`96-140`
- `scripts/indesign-e2e.js:353-399`
  - 先 `compileReverseSnapshotToHtml(...)`，再额外调用高阶 `auditReverseAuthorPackage({... sourceRoot ...})`，并在 `398-399` 对 second-pass stability 失败直接抛错。
- `test/indesign-to-html/cli.test.js:13-15, 83-105`
  - 证明 `scripts/indesign-reverse-export.js` 直接复用 `src/reverse-pipeline`，且断言只覆盖 `result.report.authorAudit.ok`。
- `test/indesign-e2e-runner.test.js:316-464`
  - 高阶 author audit、source roundtrip、content inventory、structure signature、canonical stability 的断言全部在 E2E runner 测试里。

**风险**

- 违反“失败要早于假成功”和“禁止兼容双路径”。
- `reverse export` 调用者即使提供 `sourceRoot`，仍拿不到与 E2E 相同的硬门禁。
- 这不是简单命令行包装差异，而是**验证强度差异**。

### 2. [P2] `audit-reverse-visual` 仍把关键证据补全逻辑留在脚本里，`src` audit 不是自洽入口

**结论**

`compareVisualGeometry()` 的“表格高度差异可接受”规则依赖注册过的 `sourceCsv/sourceXml` 证据，但把 reverse model 里的这组证据补进 capture 的逻辑仍放在 `scripts/audit-reverse-visual.js`。这意味着脚本不是纯 CLI，它仍承载了核心审计前处理。

**证据**

- `scripts/audit-reverse-visual.js:70-145`
  - `loadReverseHtmlEvidence`
  - `enrichCaptureWithReverseModelSourceMetadata`
  - `reverseModelSourceMetadataByKey`
  - `collectReverseModelSourceMetadata`
- `scripts/audit-reverse-visual.js:194-196`
  - 先做 `enrichCaptureWithReverseModelSourceMetadata(reference, evidence.reverseModel)`，再调用 `compareVisualGeometry(...)`。
- `src/writers/html/audit/visual-geometry-audit.js:277-288, 334-353`
  - `AUTHOR_VISUAL_TABLE_HEIGHT_ACCEPTED` 明确依赖已注册的 table source metadata 完整匹配。
- `test/indesign-to-html/visual-geometry-cli.test.js:51-90`
  - 专门测试的是脚本里的 `enrichCaptureWithReverseModelSourceMetadata(...)`，不是 `src` 公共 helper。
- `test/indesign-to-html/visual-geometry-cli.test.js:17-18`
  - 只断言 `captureHtmlGeometry` 已复用 `src`，没有对同等级的 `src` 证据补全入口做断言。

**风险**

- 违反“脚本不得继续承载已迁入 src 的核心算法”。
- 将来如果别的入口直接复用 `compareVisualGeometry()`，很容易遗漏同一套证据补全，得到更弱或错误的结果。
- 当前不是整份重复实现，但属于**核心算法残留在脚本层**。

## 迁移干净的部分

这些迁移已经基本收口，不应误判为重复实现：

- `scripts/audit-conversion-gate.js`
  - `git diff` 显示脚本删除了大块 gate 算法，改为直接依赖 `src/writers/html/audit/conversion-gate.js`。
  - 证据：`test/indesign-to-html/conversion-gate-cli.test.js:15-26` 明确断言 CLI 与 `src` 复用同一实现。
- `scripts/indesign-reverse-export.js`
  - `git diff` 显示脚本内 `compileReverseSnapshotToHtml` 旧实现被删除，改为直接依赖 `src/reverse-pipeline`。
  - 证据：`test/indesign-to-html/cli.test.js:13-15`。
- `scripts/indesign-e2e.js`
  - 内联的 panel-name / overset / reverse-author audit helper 已移出脚本，进入：
    - `src/writers/indesign/audit/e2e-result-audit.js`
    - `src/writers/html/audit/reverse-roundtrip.js`
  - 证据：`test/indesign-e2e-runner.test.js:129-139` 明确断言这些 helper 不再从脚本导出。

## 可删候选

### 候选 A

- 删除位置：
  - `scripts/audit-reverse-visual.js:70-145`
- 删除前提：
  - 先把 reverse-model 证据补全逻辑迁入 `src/writers/html/audit/` 下的公共 helper，再让脚本只做参数解析、路径解析、打印和退出码。
- 原因：
  - 这段不是 CLI 噪音，而是视觉审计可接受性判定的前置算法。
- 风险：
  - 中；删除前若未迁入 `src`，会直接削弱 visual audit。
- 建议验证命令：
  - `node --test test/indesign-to-html/visual-geometry-audit.test.js test/indesign-to-html/visual-geometry-cli.test.js`

### 候选 B

- 删除位置：
  - `scripts/indesign-e2e.js:365-399` 的 script-side 高阶 reverse author gate 组合逻辑
- 删除前提：
  - 先把这段组合收进 `src/reverse-pipeline` 或新的 `src` 级 roundtrip orchestration，并让 `scripts/indesign-e2e.js` 与 `scripts/indesign-reverse-export.js` 共同复用。
- 原因：
  - 当前 strongest gate 只在 E2E 脚本里，形成强弱双路径。
- 风险：
  - 高；这是本报告最需要先收口的点，必须先迁移再删脚本分支。
- 建议验证命令：
  - `node --test test/indesign-to-html/cli.test.js test/indesign-e2e-runner.test.js`

### 候选 C

- 删除位置：
  - `scripts/indesign-e2e.js:330-340, 533-543` 的 pass-through wrapper / export
- 删除前提：
  - 测试改为直接导入 `src/indesign-cli-plugin/host-jsx` 与 script 内部真正需要保留的 helper。
- 原因：
  - 这是纯转发层，不是业务算法。
- 风险：
  - 低；属于清理型删除。
- 建议验证命令：
  - `node --test test/indesign-e2e-runner.test.js`

## 不可删理由

- `src/writers/html/audit/conversion-gate.js`
  - 这是 conversion gate 的 canonical 实现；脚本已复用它，不应回退到 script 版算法。
- `src/writers/html/audit/reverse-roundtrip.js`
  - 这里承载 source roundtrip、content inventory、structure signature、second-pass stability 的高阶门禁；问题不是它该删，而是它还没有成为所有入口的统一收口点。
- `src/writers/html/audit/visual-geometry-audit.js`
  - 这是视觉几何比较和 accepted normalization 规则本体；应继续保留为唯一判定核心。
- `src/writers/indesign/audit/e2e-result-audit.js`
  - panel name / overset 的拒绝逻辑已成功脱离脚本，正是应该保留的迁移成果。
- `src/reverse-pipeline/index.js`
  - 这是 reverse export 的 canonical pipeline 入口；问题不是删除，而是要补齐高阶 audit 接线，避免强弱双路径。

## 是否需要沉淀长期规范

**需要。**

建议沉淀一条长期规范，写入 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 或等价规范文档：

- 任何 `scripts/audit-*.js`、`scripts/indesign-*.js` 如果接受 `sourceRoot`、`reverse-model`、`baseline`、`trusted-source` 等会影响审计结论的输入，对应的证据补全、强门禁汇总、advisory/hard 级别判定必须落在 `src/`。
- 脚本只允许保留：
  - 参数解析
  - 路径解析
  - 人类输出格式
  - 退出码映射
- 禁止出现：
  - script stronger / src weaker
  - e2e stronger / reverse-export weaker
  - 只有脚本知道如何补齐证据，`src` 模块本身却不自洽

## 审计后判断

- 当前状态不应写成“迁移干净”。
- 更准确结论是：**大块重复实现已拆掉，但还有 1 个 P1 双路径门禁问题和 1 个 P2 脚本残留前处理问题。**
