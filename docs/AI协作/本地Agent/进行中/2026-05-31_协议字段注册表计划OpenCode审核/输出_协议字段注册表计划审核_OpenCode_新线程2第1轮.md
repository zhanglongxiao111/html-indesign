# 审核结论

结论：通过

## 必改问题

- 无

## 建议问题

- **S1. 阶段 0 基线测试覆盖偏窄：** `baseline-imports.test.js` 只断言 4 个函数（`renderSnapshot`、`compileInstructions`、`snapshotToSemanticModel`、`reverseSnapshotToSemanticModel`），但当前 `index.js` 实际导出 17 个公开函数（含 `compileStyles`、`validateAuthoringRules`、`semanticModelToInstructions`、`semanticModelToHtml`、`validateInstructions` 等）。如果迁移过程中某个导出悄然断裂，此基线测试无法发现。建议补充覆盖全部当前公开导出，或者至少按第 8.1 节的目标 API 覆盖每一项。

- **S2. 阶段 1 伪代码 `validateFieldEntry` 的 `capabilities` 检查存在逻辑漏洞：** 步骤 1.3 的 `validateFieldEntry` 对 capabilities 的检查只遍历 `input.capabilities` 的已知 key，但如果 `capabilities` 里传入一个未在 `FORMATS` 里声明的格式名（如 `{ pdf: { read: 'native' } }`），会被静默忽略而不会报错。当前 FORMATS 仅为 `['html', 'indesign', 'pptx']`，不算严重问题，但如果未来扩展格式名，这个静默行为可能遗漏错误。建议对 capability key 做未知格式名 warning。

- **S3. Section 4.2 移动映射表里 `src/paged-html/layout.js → src/semantic-model/layout.js` 落在 `semantic-model/` 而非 `adapters/`：** 这与第 8.3 步的 `git mv` 命令一致，但与第 3.1 节目标目录树中 `semantic-model` 仅包含 `index.js`、`validator.js`、`layout.js` 的表述一致，没有矛盾。但如果语义模型未来只保留 schema/validator，应考虑 `layout.js` 将来是否应归入 shared 或 adapters。当前不算错误，只是可标记为后续关注。

- **S4. `rg` 门禁的正则表达式在 PowerShell 双引号内的 `""` 转义依赖 .NET 转义行为：** 第 9.12 节命令 `rg -n "src[/\\]paged-html|src[/\\]indesign-reverse|require\(['""]..."` 中的 `""` 是 PowerShell 双引号字符串里对 `"` 的转义。在 PowerShell 5.1 中这个行为稳定，但如果命令被复制到其他 shell 或环境执行，`""` 可能被误解。当前在 Windows PowerShell 5.1 环境下可以工作，但建议在门禁步骤旁加注"已在 PowerShell 5.1 的双引号解析下验证"。

- **S5. 阶段 9 文件拆分清单偏大但无强制门禁：** 拆分清单覆盖 5 个超大文件的目标拆分，但没有拆分后每个子文件的测试覆盖要求。如果执行时对某个子文件拆分后没有独立测试，undo 旧行为的回归可能被漏掉。建议补充"每个拆出的新文件必须伴随至少一个 focused test 或确认已有 focused test 覆盖"的明确要求（第 9.2 节已有类似精神但措辞偏软）。

- **S6. `test/indesign-executor/` 目录的 4 个 .test.js 文件需要路径迁移但未在 8.9 节显式列出：** 这些文件在 `test/indesign-executor/compiler-executor-workspace.test.js`、`executor-fixture-writer.test.js` 中直接 `require('../../src/paged-html')`。计划在 8.9 节用 `test/**/*.test.js` 通配覆盖了它们，但没有像脚本一样显式列出。如果执行者遗漏 grep，可能产生漏迁。建议在 8.9 节增加一个 `test/indesign-executor/` 的显式条目。

## 证据

### 1. 文件覆盖完整性验证

**计划 Section 4.2 列出 32 个文件移动映射。** 对比当前实际目录：

- `src/paged-html/`：13 个文件。计划覆盖 12 个（全部非 index.js 文件），`index.js` 随目录删除。✓
- `src/indesign-reverse/`：21 个文件。计划覆盖 21 个（全部非 index.js 文件），`index.js` 随目录删除。✓
- `src/semantic-model/`：4 个文件。计划覆盖 2 个移动（`from-snapshot.js`、`to-instructions.js`），1 个保留不动（`validator.js`），1 个修改（`index.js`）。✓

通过 `Read(src/paged-html)`、`Read(src/indesign-reverse)`、`Read(src/semantic-model)` 实盘目录后确认。

### 2. 依赖链与阶段间完整性

**阶段 8.1 → 8.2 → 8.8 形成完整 TDD 循环：**
- 步骤 8.1：写新 API RED 测试（`test/protocol/baseline-imports.test.js`）
- 步骤 8.2：确认 RED（FAIL，因为根 `index.js` 仍是旧 API）
- 步骤 8.3-8.9：移动文件、创建新 index、更新导入、更新根 `index.js`、更新 scripts 和 tests
- 步骤 8.10：运行 `node --test test/protocol/baseline-imports.test.js` 确认 GREEN
- 步骤 8.11：删除旧目录
- 步骤 8.12：运行旧路径不存在测试确认

在整个阶段 8 内部没有测试执行穿插在文件移动中，依赖链不会产生 `MODULE_NOT_FOUND`。唯一产生不一致的窗口是步骤 8.3-8.9 之间（`semantic-model/index.js` 的 `require('./from-snapshot')` 在文件移动后尚未更新），但无 Node 进程在此期间运行。

**根 `index.js` 在阶段 8.8 创建新 API 时不包含 PPTX：** 计划在 `src/adapters/pptx/contracts.js` 注释中明确："PPTX 入口不得在阶段 8 提前写入根 index.js，因为 src/adapters/pptx/contracts.js 在阶段 10 才创建。"阶段 10.4 单独接入 `adapters.pptx`。✓

根据 `Read(index.js)` 和计划第 8.8 节、第 10.4 节交叉核对。

### 3. 现有退役字段行为验证

**`data-id-page` 已按退役策略处理：**
- 写侧：`src/indesign-reverse/author-html-tree.js:507` 在输出时对 PDF/AI 资产主动 `delete attrs['data-id-page']` ✓
- 读侧：`src/paged-html/asset-detector.js:92` 的 `placementFromAttributes` 只读 `attributes['data-id-pdf-page']`，不使用 `data-id-page` ✓
- grep 检查 `data-id-page` 在 src/ 下的出现：仅 1 处（即上述删除行），无读侧兜底路径 ✓

通过 `Read(src/paged-html/asset-detector.js:77-101)`、`Read(src/indesign-reverse/author-html-tree.js:504-511)`、`grep("data-id-page", path="src/", include="*.js")` 确认。

### 4. PowerShell 命令适用性

**所有门禁命令使用 PowerShell / Node 原生语法：**
- `git mv`：在 Windows PowerShell 中可用 ✓
- `New-Item -ItemType Directory -Force`：PowerShell 原生命令 ✓
- `node --test`、`npm test`：跨平台 Node 命令 ✓
- `rg`：作为 ripgrep Windows 版，`rg --version` 实测返回 `ripgrep 15.1.0` ✓
- `npm run assemble:authoring -- -- --package ...`：npm 脚本转发参数用双 `--`，符合 Windows 环境 ✓

无 Unix-only 命令（`grep`、`test`、`mkdir -p`、`mv`）出现在最终门禁中。

### 5. 关键禁止项检查

对照 AGENTS.md 硬规则逐条检查计划：

| 规则 | 计划是否遵守 | 证据 |
| ---- | ----------- | ---- |
| 退役代码必须当场清除 | ✓ 阶段 6 专门清理退役字段，禁止保留 legacy 双路径 | Section 6.5 grep 测试、3.2 节禁止双入口 |
| 兜底默认有害 | ✓ 能力矩阵要求显式声明 `native/lossless/approximate/fallback/observe-only/unsupported`，无隐式兜底 | Section 5 节 capability levels |
| 失败早于假成功 | ✓ 强校验逐域打开，未注册字段报 error 而非 warning 放行 | Section 7 节按域强校验 |
| 语义库白名单 | ✓ label whitelist 接入 registry，unknown 字段只能 observation/report | Section 5 节 label validator |
| 事务所素材原位引用 | ✓ 不在计划范围内改动，asset 路径保留 UNC 引用 | 未触及 asset 路径处理逻辑 |
| 禁止保留 facade / 双路径 | ✓ 第 3.2 节明确禁止，阶段内允许临时 facade 但阶段结束前必须删除 | Section 3.2 "允许的大规模目录重组" |
| 不允许新增 legacy 命名 | ✓ 第 3.2 节明确禁止 | Section 3.2 |
| 可验证才算完成 | ✓ 每阶段有验证命令和回退条件 | Section 5 各阶段 checklist |

### 6. 计划内一致性检查

- 阶段 0-12 顺序合理：先冻结事实 → 建注册表 → 接入门禁 → 目录重构 → 拆分文件 → PPTX 预留 → 文档生成 → E2E 验证 ✓
- 阶段 8（目录重构）与阶段 10（PPTX 预留）入口不冲突：阶段 10 前根 `index.js` 不引用 PPTX ✓
- 伪代码与实际文件结构对照：`placementFromAttributes` 在 `asset-detector.js:77` 导出，与计划 0.1 节测试一致 ✓
- 第 4.2 节移动映射与第 8.3-8.5 节 `git mv` 命令一致 ✓
- 退役字段 `data-id-page` 在字段注册表 `retiredAttrs` 中声明，与现有代码行为一致 ✓

### 7. 测试覆盖评估

计划新增 12 个 protocol 专项测试文件（`test/protocol/*.test.js`），覆盖 entry、registry、capability、lifecycle、validators、scanners、docs generation、pptx contracts。加上阶段 12 的 7 个 E2E 门禁（`npm test`、`lint:authoring`、`assemble:authoring --check`、`e2e:indesign`、`--reverse-roundtrip`、`--second-pass-roundtrip`、`audit:roundtrip`），测试覆盖完整。

唯一的担忧（已列入建议 S6）是 `test/indesign-executor/` 下的 4 个测试文件未在 8.9 节显式列出，但 `test/**/*.test.js` 通配在概念上覆盖了它们。
