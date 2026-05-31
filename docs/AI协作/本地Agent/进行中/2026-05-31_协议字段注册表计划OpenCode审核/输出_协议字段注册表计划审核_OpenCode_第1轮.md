# 审核结论

结论：**不通过**

## 必改问题

### 必改 1：15+ 个既有源文件未被移动计划覆盖，导致阶段 8 无法删除旧目录

计划 section 4.2（模块移动表）和 step 8.3-8.5（git mv 命令）合计后，以下真实存在的文件没有被分配目标位置，也未标注为"退役删除"或"留在原位"：

`src/paged-html/` 下未被覆盖的文件：

- `layout.js`
- `stacking.js`
- `style-reader.js`
- `style-utils.js`

`src/indesign-reverse/` 下未被覆盖的文件：

- `blueprint-migration.js`
- `author-audit.js`
- `source-roundtrip-diff.js`
- `asset-reference-policy.js`
- `author-asset-packager.js`
- `author-css-writer.js`
- `author-source-css.js`
- `css-blend-mode.js`
- `reveal-presentation-writer.js`
- `semantic-candidates.js`
- `visual-geometry-audit.js`

**证据**：`src/paged-html/` 实有 13 文件（browser-snapshot、page-detector、asset-detector、source-metadata、authoring-validator、instructions-compiler、instructions-validator、style-compiler、**layout、stacking、style-reader、style-utils**、index），计划 section 4.2 只列出其中 5 个的迁移路径，step 8.5 追加 3 个（instructions-compiler、instructions-validator、style-compiler）。粗体部分 4 个无去向。

`src/indesign-reverse/` 实有 21 文件（snapshot-reader、reverse-model、label-whitelist、html-writer、author-package-writer、author-html-tree、author-attribute-writer、author-style-attrs、vector-svg、**blueprint-migration、author-audit、source-roundtrip-diff、asset-reference-policy、author-asset-packager、author-css-writer、author-source-css、css-blend-mode、reveal-presentation-writer、semantic-candidates、visual-geometry-audit**、index），section 4.2 列出 3 个，step 8.5 追加 6 个。粗体部分 11 个无去向。

**后果**：阶段 8 的门禁要求 "删除 `src/paged-html/` 和 `src/indesign-reverse/`"（见计划 3.2 节："不允许保留旧目录作为长期 facade"），并写有旧路径不存在测试（step 8.12）。但如果 15+ 个文件没有迁移、退役或标记原因，"删除旧目录"这一操作要么不可执行（需要保留目录而违反门禁），要么可执行但丢失功能（引发回归）。无论哪种结果，计划都不能通过其自身的完成标准。

此外，`scripts/` 目录中多条 `require('../src/indesign-reverse/...')` 引用了 `author-audit.js`、`source-roundtrip-diff.js`、`visual-geometry-audit.js`（见 `scripts/indesign-e2e.js:343-344,632`、`scripts/audit-reverse-visual.js:5`、`scripts/audit-reverse-author-roundtrip.js:6`），计划 section 4.3 只说了 "Modify: scripts" 但没有给出这些关键路径函数的归宿。阶段 8 删除源目录后，这些脚本引用必然断链。

### 必改 2：section 4.2 移动表与 step 8.3-8.5 命令清单不一致

计划有两处应互相一致的资源：section 4.2 是 "需要新增、移动、删除或改造的模块" 正式清单，step 8.3-8.5 是具体 git mv 执行命令。以下文件只出现在其中一个：

| 文件（当前位置） | section 4.2 | step 8.x |
|---|---|---|
| `src/paged-html/instructions-compiler.js` | **无** | step 8.5 有 |
| `src/indesign-reverse/author-attribute-writer.js` | **无** | step 8.5 有 |
| `src/indesign-reverse/author-style-attrs.js` | **无** | step 8.5 有 |
| `src/indesign-reverse/vector-svg.js` | **无** | step 8.5 有 |

**后果**：如果 Agent 以 section 4.2 为主要执行参考（章节标题明确为 "需要新增、移动、删除或改造的模块"），会遗漏 `instructions-compiler.js` 等 4 个文件；如果以 step 8.5 为准，则 section 4.2 作为正式记录已过时。两者不一致违反计划自身的执行原则 "每个阶段开始前必须用当前仓库实际导出、文件名、测试命令核对一次"。

### 必改 3：退役字段 grep 测试使用将被移动的硬编码文件路径

Step 6.5 写了一个 grep 测试验证 "source code does not read data-id-page as PDF page number fallback"，测试硬编码路径：
- `src/paged-html/asset-detector.js`
- `src/indesign-reverse/author-html-tree.js`
- `src/indesign-reverse/html-writer.js`

这些路径在阶段 8 文件移动后会过期。但计划没有要求在阶段 8 完成后重新运行 step 6.5 的验证，也没有说明在阶段 8 后这些验证应该指向新路径。

**证据**：step 6.5 测试代码第 1846-1850 行，文件路径为旧目录位置。

**后果**：阶段 6 "退役字段清理" 是阶段 8 "目录重构" 的前置依赖（顺序 6→8）。按 `AGENTS.md` "退役代码必须当场清除" 的要求，如果在阶段 6 清除了 `data-id-page` 的读取逻辑，阶段 8 又移动了包含相同字段（如 `author-html-tree.js` 中删除 `data-id-page` 的行，见 `src/indesign-reverse/author-html-tree.js:507`）的文件，执行 Agent 无法仅凭现有 checklist 保证移动后退役逻辑未被新路径重新引入。

## 建议问题

### 建议 1：未声明 `rg` 为外部依赖

Section 9.11 和 9.12 使用 `rg`（ripgrep）命令作为门禁，但计划未声明 `rg` 需要预先安装。`AGENTS.md` 第 8 节只列出了 `node --test`、`npm`、Playwright、`indesign-cli` 等依赖，`rg` 不在其中。在干净的 Windows 环境执行时可能因 `rg` 不存在而误报门禁失败或门禁通过（PowerShell 中命令不存在会抛非零 exit code 但错误原因不同于预期）。

### 建议 2：阶段 9 文件拆分清单指向尚未存在的文件

Stage 9 建议拆分目标文件如 `src/adapters/html/reader/browser-snapshot.js`、`src/writers/indesign/style-compiler.js`。这些文件在阶段 9 执行前才通过阶段 8 创建。计划阶段 9 可以只是方向性的，但若执行 Agent 严格按照 checklist 执行，在文件尚未就位时会发现拆分计划与实际不符（比如建议拆分出的 `effect-style-mapping.js` 对应的代码可能在当前大文件中结构不同）。

### 建议 3：计划标题/来源声明可能误导上下文

计划第 3 行写 "来源：GPT Pro 外部审查回复，经本地仓库核对后整理为正式执行版"，section 0 也重申了这一来源。虽然已声明 "不再作为外部回复原文保存"，但 "外部审查回复" 的措辞可能让执行 Agent 疑惑此文件是 "回复" 还是 "计划"。建议更清晰地标注为 "正式实施计划，基于外部审查建议重构"。

### 建议 4：阶段 0 baseline 测试对 `api.semanticModel.snapshotToSemanticModel` 的断言位置有语义歧义

Step 0.3 的 baseline imports 测试断言 `api.semanticModel.snapshotToSemanticModel`。当前此函数由 `src/semantic-model/` 导出，同时在 `src/paged-html/index.js` 中通过 `require('../semantic-model')` 重导出为 `api.pagedHtml.snapshotToSemanticModel`。这意味着两个公开入口导出同一函数。阶段 8 步骤 8.7 只打算让 `semanticModel` 暴露 `validateSemanticModel`，但 `snapshotToSemanticModel` 被移到了 `adapters/html/normalizer/`。阶段 8 后 `api.semanticModel.snapshotToSemanticModel` 会消失——这符合设计意图（normalizer 不应在 semantic model 包中），但计划未在任何步骤中明确标注这个 API 变更，可能让执行者误以为这是回归。

## 证据

以下是具体路径和引用位置：

1. **`src/paged-html/` 完整文件清单 vs 计划覆盖**：
   - 实有文件（13）：`browser-snapshot.js`、`page-detector.js`、`asset-detector.js`、`source-metadata.js`、`authoring-validator.js`、`instructions-compiler.js`、`instructions-validator.js`、`style-compiler.js`、`layout.js`、`stacking.js`、`style-reader.js`、`style-utils.js`、`index.js`
   - Section 4.2 覆盖（5）：`browser-snapshot.js` → adapters、`page-detector.js` → adapters、`asset-detector.js` → adapters、`source-metadata.js` → adapters、`authoring-validator.js` → adapters、`style-compiler.js` → writers、`instructions-validator.js` → writers
   - Step 8.3-8.5 追加（3）：`instructions-compiler.js`、`instructions-validator.js`、`style-compiler.js`
   - **未覆盖（4）**：`layout.js`、`stacking.js`、`style-reader.js`、`style-utils.js`
   - 证据：`src/paged-html/` 目录 listing

2. **`src/indesign-reverse/` 完整文件清单 vs 计划覆盖**：
   - 实有文件（21）：见上方列出的全部文件
   - Section 4.2 覆盖（3）：`snapshot-reader.js`、`reverse-model.js`、`label-whitelist.js`、`html-writer.js`、`author-package-writer.js`、`author-html-tree.js`
   - Step 8.5 追加（6）：`author-attribute-writer.js`、`author-style-attrs.js`、`vector-svg.js`、`html-writer.js`、`author-package-writer.js`、`author-html-tree.js`
   - **未覆盖（11）**：`blueprint-migration.js`、`author-audit.js`、`source-roundtrip-diff.js`、`asset-reference-policy.js`、`author-asset-packager.js`、`author-css-writer.js`、`author-source-css.js`、`css-blend-mode.js`、`reveal-presentation-writer.js`、`semantic-candidates.js`、`visual-geometry-audit.js`
   - 证据：`src/indesign-reverse/` 目录 listing

3. **Scripts 对未规划文件的依赖**：
   - `scripts/indesign-e2e.js:343` — `require('../src/indesign-reverse/author-audit')`
   - `scripts/indesign-e2e.js:344` — `require('../src/indesign-reverse/source-roundtrip-diff')`
   - `scripts/indesign-e2e.js:632` — `require('../src/indesign-reverse/source-roundtrip-diff')`
   - `scripts/audit-reverse-visual.js:5` — `require('../src/indesign-reverse/visual-geometry-audit')`
   - `scripts/audit-reverse-author-roundtrip.js:6` — `require('../src/indesign-reverse/source-roundtrip-diff')`
   - `scripts/indesign-reverse-export.js:11-12` — `require('../src/indesign-reverse')` + `require('../src/indesign-reverse/author-audit')`

4. **Section 4.2 vs Step 8.5 不一致**：
   - `src/paged-html/instructions-compiler.js` 不在 section 4.2（行 322-367），但在 step 8.5（行 2069-2080）
   - `src/indesign-reverse/author-attribute-writer.js`、`author-style-attrs.js`、`vector-svg.js` 同理
   - 对照：section 4.2 第 322-367 行 vs step 8.5 第 2069-2080 行

5. **Step 6.5 硬编码路径**：
   - 计划第 1846-1850 行：`'src/paged-html/asset-detector.js'`、`'src/indesign-reverse/author-html-tree.js'`、`'src/indesign-reverse/html-writer.js'`
   - 这些路径指向阶段 8 会被移动的目标文件

6. **规范覆盖验证**：
   - Spec section 5（字段分类）：canonical/sourceMetadata/formatExtension/observation/retired — 计划阶段 2、3、6 覆盖 ✓
   - Spec section 6（能力矩阵）：计划阶段 3 覆盖 ✓
   - Spec section 7（标签载体）：计划阶段 5 覆盖 ✓
   - Spec section 8（生命周期门禁）：计划阶段 3、4、7 覆盖 ✓
   - Spec section 9（迁移计划）：计划阶段 0-12 对应 ✓
