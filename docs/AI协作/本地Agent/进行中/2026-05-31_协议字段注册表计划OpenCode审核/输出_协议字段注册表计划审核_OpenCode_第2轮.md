# 审核结论

结论：**通过**

## 必改问题

- 无

## 建议问题

### 建议 1：`compileStyles` 函数未出现在新 `writers/indesign/index.js` 中

当前 `src/paged-html/index.js` 导出 `compileStyles`（来自 `style-compiler.js`）。阶段 8 将 `style-compiler.js` 移动到 `src/writers/indesign/style-compiler.js`，目标目录 3.1 和目标 index（步骤 8.6）中 `writers/indesign/index.js` 只导出 `semanticModelToInstructions`、`compileInstructions`、`validateInstructions`，未包含 `compileStyles`。

`scripts/indesign-e2e.js:10` 以解构方式从 `../src/paged-html` 导入，如果它使用 `compileStyles`（当前 `paged-html/index.js` 确实导出此函数），则阶段 8 迁移后在 `writers/indesign/index.js` 中找不到该导出。执行 Agent 需要在阶段 8 迁移时确认哪些 scripts 引用了 `compileStyles`，并在 `writers/indesign/index.js` 中补充该导出或让调用者直接从 `style-compiler.js` 引用。

此问题在阶段 8 执行中会被发现并修复，不构成计划结构性缺陷。

### 建议 2：`blueprintMigrationToSemanticModel` 未在新的 `adapters/indesign/index.js` 中重导出

当前 `src/indesign-reverse/index.js` 导出 `blueprintMigrationToSemanticModel`（来自 `blueprint-migration.js`）。阶段 8 将其移动到 `src/adapters/indesign/normalizer/blueprint-migration.js`，但新的 `adapters/indesign/index.js`（步骤 8.6）仅导出 `readReverseSnapshot`、`reverseSnapshotToSemanticModel`、`validateReverseLabel`，不包含 `blueprintMigrationToSemanticModel`。

若 `scripts/indesign-reverse-export.js`（`require('../src/indesign-reverse')`）解构该函数，迁移后需直接从 `normalizer/blueprint-migration` 导入。同上，执行阶段会发现并修复。

### 建议 3：阶段 9 拆分清单中的目标文件名与移动后的实际模块名不完全对应

阶段 9 建议从 `src/writers/indesign/instruction-writer.js` 拆分出 `item-instructions.js`、`graphic-instructions.js` 等，但该文件原始名为 `to-instructions.js`，阶段 8 才重命名为 `instruction-writer.js`。拆分清单是在阶段 9 执行时有效的（文件已更名），但计划评审阶段无法验证拆分的合理性，因为当前仓库中不存在该文件路径下的代码。不算错误，但提醒执行 Agent 在阶段 9 前自行核对内容。

## 证据

### 第 1 轮必改 1 修复确认：文件全覆盖

`src/paged-html/` 共 13 文件（含 index.js facade），section 4.2（第 324-352 行）覆盖了除 index 之外的 12 个文件，index.js 在 section 3.3 作为临时 facade 处理：

| 文件 | section 4.2 目标 | 匹配 |
|---|---|---|
| `asset-detector.js` | `src/adapters/html/reader/asset-detector.js` (第 330-331 行) | ✓ |
| `authoring-validator.js` | `src/adapters/html/validators/authoring-validator.js` (第 339-340 行) | ✓ |
| `browser-snapshot.js` | `src/adapters/html/reader/browser-snapshot.js` (第 324-325 行) | ✓ |
| `instructions-compiler.js` | `src/writers/indesign/instructions-compiler.js` (第 372-373 行) | ✓ |
| `instructions-validator.js` | `src/writers/indesign/instructions-validator.js` (第 375-376 行) | ✓ |
| `layout.js` | `src/semantic-model/layout.js` (第 348-349 行) | ✓ |
| `page-detector.js` | `src/adapters/html/reader/page-detector.js` (第 327-328 行) | ✓ |
| `source-metadata.js` | `src/adapters/html/reader/source-metadata.js` (第 333-334 行) | ✓ |
| `stacking.js` | `src/adapters/html/reader/stacking.js` (第 342-343 行) | ✓ |
| `style-compiler.js` | `src/writers/indesign/style-compiler.js` (第 369-370 行) | ✓ |
| `style-reader.js` | `src/adapters/html/reader/style-reader.js` (第 345-346 行) | ✓ |
| `style-utils.js` | `src/shared/style-utils.js` (第 351-352 行) | ✓ |

`src/indesign-reverse/` 共 21 文件（含 index.js facade），section 4.2（第 354-424 行）覆盖了除 index 之外的 20 个文件，index.js 在 section 3.3 作为临时 facade 处理：

| 文件 | section 4.2 目标 | 匹配 |
|---|---|---|
| `snapshot-reader.js` | `src/adapters/indesign/reader/snapshot-reader.js` (第 354-355 行) | ✓ |
| `reverse-model.js` | `src/adapters/indesign/normalizer/snapshot-to-model.js` (第 357-358 行) | ✓ |
| `label-whitelist.js` | `src/adapters/indesign/normalizer/label-whitelist.js` (第 360-361 行) | ✓ |
| `blueprint-migration.js` | `src/adapters/indesign/normalizer/blueprint-migration.js` (第 363-364 行) | ✓ |
| `html-writer.js` | `src/writers/html/visual-html-writer.js` (第 378-379 行) | ✓ |
| `author-package-writer.js` | `src/writers/html/author-package-writer.js` (第 381-382 行) | ✓ |
| `author-html-tree.js` | `src/writers/html/author-html-tree.js` (第 384-385 行) | ✓ |
| `author-attribute-writer.js` | `src/writers/html/author-attribute-writer.js` (第 387-388 行) | ✓ |
| `author-style-attrs.js` | `src/writers/html/author-style-attrs.js` (第 390-391 行) | ✓ |
| `vector-svg.js` | `src/writers/html/vector-svg.js` (第 393-394 行) | ✓ |
| `css-blend-mode.js` | `src/writers/html/css-blend-mode.js` (第 396-397 行) | ✓ |
| `asset-reference-policy.js` | `src/writers/html/asset-reference-policy.js` (第 399-400 行) | ✓ |
| `author-asset-packager.js` | `src/writers/html/author-asset-packager.js` (第 402-403 行) | ✓ |
| `author-css-writer.js` | `src/writers/html/author-css-writer.js` (第 405-406 行) | ✓ |
| `author-source-css.js` | `src/writers/html/author-source-css.js` (第 408-409 行) | ✓ |
| `reveal-presentation-writer.js` | `src/writers/html/reveal-presentation-writer.js` (第 411-412 行) | ✓ |
| `semantic-candidates.js` | `src/writers/html/semantic-candidates.js` (第 414-415 行) | ✓ |
| `author-audit.js` | `src/writers/html/audit/author-audit.js` (第 417-418 行) | ✓ |
| `source-roundtrip-diff.js` | `src/writers/html/audit/source-roundtrip-diff.js` (第 420-421 行) | ✓ |
| `visual-geometry-audit.js` | `src/writers/html/audit/visual-geometry-audit.js` (第 423-424 行) | ✓ |

### 第 1 轮必改 2 修复确认：section 4.2 与 step 8.3-8.5 一致

逐一比对 section 4.2（第 324-424 行）与 step 8.3-8.5 的 git mv 命令（第 2137-2185 行），两者覆盖的源文件集合完全一致，无遗漏、无多余。`instructions-compiler.js`、`author-attribute-writer.js`、`author-style-attrs.js`、`vector-svg.js` 等上一轮只在 step 8.x 出现的文件现已补入 section 4.2。

### 第 1 轮必改 3 修复确认：退役字段扫描使用目录递归 + 新老路径双覆盖

Step 6.5（第 1895-1949 行）的测试改为使用 `collectRuntimeFiles()` 函数递归扫描目录树，扫描根路径列表同时包含旧路径（`src/paged-html`、`src/indesign-reverse`）和新路径（`src/adapters/html`、`src/adapters/indesign`、`src/writers/html`、`src/writers/indesign`、`src/semantic-model`）。关键防护措施：

- 第 1908 行：`if (!fs.existsSync(absoluteRoot)) continue;` — 防止已删除目录导致误判。
- 第 1938 行：`assert.notEqual(files.length, 0, ...)` — 防止空扫通过假阳性。
- 第 1948 行注释：明确说明 "不能因为旧目录已删除而空扫通过"。

### 第 8.9 节 Scripts 依赖映射确认

步骤 8.9（第 2281-2311 行）显式列出了 5 个 scripts 的旧路径到新路径映射，覆盖了上一轮指出的所有脚本依赖：

| Script | 旧路径 | 新路径 | 
|---|---|---|
| `indesign-e2e.js` | `../src/paged-html` | `../src/adapters/html + ../src/writers/indesign` |
| `indesign-e2e.js` | `../src/indesign-reverse/author-audit` | `../src/writers/html/audit/author-audit` |
| `indesign-e2e.js` | `../src/indesign-reverse/source-roundtrip-diff` | `../src/writers/html/audit/source-roundtrip-diff` |
| `indesign-reverse-export.js` | `../src/indesign-reverse` | `../src/adapters/indesign + ../src/writers/html` |
| `indesign-reverse-export.js` | `../src/indesign-reverse/author-audit` | `../src/writers/html/audit/author-audit` |
| `audit-reverse-visual.js` | `../src/indesign-reverse/visual-geometry-audit` | `../src/writers/html/audit/visual-geometry-audit` |
| `audit-reverse-author-roundtrip.js` | `../src/indesign-reverse/source-roundtrip-diff` | `../src/writers/html/audit/source-roundtrip-diff` |
| `lint-authoring.js` | `../src/paged-html` | `../src/adapters/html` |

### `rg` 依赖声明确认

第 20 行新增：`rg` 是本计划的显式执行依赖；阶段 0 前必须运行 `rg --version` 确认可用。

### Windows/PowerShell 命令检查

所有 git mv 命令使用反斜杠路径，New-Item 命令为合法 PowerShell，rg 正则模式使用 `[/\\]` 兼容 Windows 路径分隔符。未发现 Unix 专属命令残留。
