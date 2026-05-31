# 审核结论

结论：**通过**

## 必改问题

- 无

## 建议问题

### 建议 1：`>` 重定向在 PowerShell 5.1 下默认输出 UTF-16LE，可能导致生成文档编码异常

计划在步骤 11.5、11.8 和验证命令 9.5（第 2698、2740、3232 行）使用：

```bash
node src/protocol/docs/generate-field-docs.js > docs/规范/PROTOCOL_FIELD_REGISTRY.md
```

本仓库在 Windows / PowerShell 环境执行（计划第 19 行确认）。PowerShell 5.1 的 `>` 重定向运算符底层使用 `Out-File`，默认编码为 UTF-16LE。若 `generate-field-docs.js` 通过 `console.log()` 输出中文（字段名、原因说明等），生成的 `.md` 文件可能因编码错误在文本编辑器中显示为乱码。

这不构成必改问题，因为：命令在 PowerShell 中可正常执行；Node stdout 的字节流本身是 UTF-8，PowerShell 截获后会按 UTF-16LE 写出，但如果后续用现代编辑器（VS Code 等）打开，编辑器通常能自动检测并修正编码；执行 Agent 可以改用 `cmd /c "node ... > ...` 或用 `Out-File -Encoding UTF8` 规避。建议计划在对应步骤中添加编码提醒。

### 建议 2：阶段 4 的"强校验按阶段 6 逐域打开"引用了错误的计划阶段编号

第 1619 行写："强校验按阶段 6 逐域打开"。但在本计划中，阶段 6 是"退役字段集中登记与清理"（第 1788 行），阶段 7 才是"按域接入强校验"（第 1966 行）。该引用应指向"阶段 7"。此文本出现在阶段 4 的实现策略注释中，不影响实际执行顺序（阶段 4→5→6→7 本身排列正确），只是叙述性交叉引用过时。

### 建议 3：阶段 6 退役字段扫描目录不包含 `src/shared/`

步骤 6.5 的 `collectRuntimeFiles`（第 1928-1936 行）扫描的根路径列表为：

```
src/paged-html, src/indesign-reverse,
src/adapters/html, src/adapters/indesign,
src/writers/html, src/writers/indesign,
src/semantic-model
```

阶段 8 会将 `style-utils.js` 从 `src/paged-html/` 移至 `src/shared/style-utils.js`（第 2148 行），其路径 `src/shared/` 不在扫描列表内。虽然 `style-utils.js` 极不可能包含 `data-id-page` 读写逻辑（当前的 `src/paged-html/style-utils.js` 经探索确认不涉及该字段），但扫描列表如果与移动目标目录集不完全匹配，可能引入长期盲区。建议将 `src/shared` 加入扫描根路径。

## 证据

### 1. 规格覆盖

| 规格要求 | 计划覆盖 | 位置 |
|---|---|---|
| 字段注册表（canonicalPath/currentPaths/fieldClass/lifecycle/capabilities） | 阶段 1-2 | 第 617-1289 行 |
| 能力矩阵（native/lossless/approximate/fallback/observe-only/unsupported） | 阶段 3 | 第 1292-1466 行 |
| 字段分类（canonical/sourceMetadata/formatExtension/observation） | 阶段 2（fields/） | 第 1011-1289 行 |
| 生命周期门禁（active/candidate/deprecated/retired） | 阶段 3 | 第 1292-1466 行 |
| 观察字段（observation fieldClass） | 阶段 2（observation.js） | 第 1209-1230 行 |
| 退役字段（retired lifecycle, readPolicy/writePolicy） | 阶段 6 | 第 1788-1963 行 |
| PPTX 预留（Reader/Writer contract, custom data carrier） | 阶段 10 | 第 2469-2590 行 |
| 文档生成（registry → Markdown） | 阶段 11 | 第 2593-2742 行 |

### 2. AGENTS.md 硬规则合规

| 规则 | 计划如何遵守 | 证据 |
|---|---|---|
| "协议字段必须集中登记" | 建立 `src/protocol/` 作为唯一字段事实源 | 阶段 1-2，section 3.1 |
| "格式能力必须显式声明" | 实现 `capabilityFor`/`assertWritable` API | 阶段 3，`capability.js`/`field-query.js` |
| "退役代码必须当场清除" | 阶段 6 清理退役代码，阶段 8 删除旧目录，不保留 facade 或 legacy 双路径 | 第 1788-1963 行，section 3.2 |
| "兜底默认有害" | `unsupported` 作为显式默认值，`validateFieldEntry` 拒绝无效值 | 第 722-758 行 |
| "失败要早于假成功" | 每个阶段有 STOP 条件，strict mode 下 unknown 字段报 error | 各阶段回退条件 |
| "语义库是白名单" | label whitelist 接入 registry，observation 字段不进入 structured writer | 阶段 5 |
| "可验证才算完成" | TDD 流程（RED → GREEN），阶段 12 跑 E2E | 第 47-48 行，阶段 12 |

### 3. 阶段顺序合理性

| 阶段 | 前置依赖 | 是否满足 | 说明 |
|---|---|---|---|
| 0 基线测试 | 无 | ✓ | 不改行为，先冻结事实 |
| 1-2 注册表 | 阶段 0 基线通过 | ✓ | 先有 registry 才能登记 |
| 3 能力/生命周期 | 阶段 1-2 注册表存在 | ✓ | 查询 API 依赖 registry |
| 4 警告门禁 | 阶段 3 查询 API 可用 | ✓ | warn-only，不阻断 |
| 5 语义模型接入 | 阶段 4 验证器可用 | ✓ | 接入 registry 字段校验 |
| 6 退役清理 | 阶段 2-3 退役字段已在 registry 登记 | ✓ | 先登记再清理，清理后 registry 仍记录 |
| 7 域强校验 | 阶段 5-6 语义模型已接入、退役已清理 | ✓ | 逐域 error，不造 false positive |
| 8 目录重构 | 阶段 1-7 registry 和协议层稳定 | ✓ | 文件移动不改行为 |
| 9 文件拆分 | 阶段 8 目录结构已确定 | ✓ | 在新边界内拆分 |
| 10 PPTX 契约 | 阶段 3 能力矩阵可用 | ✓ | 契约引用能力矩阵 |
| 11 文档生成 | 阶段 1-10 字段事实已完整 | ✓ | 生成覆盖全字段的文档 |
| 12 E2E | 所有阶段完成 | ✓ | 最终验证 |

### 4. 文件移动全覆盖确认

**`src/paged-html/` 所有 .js 文件（13 个）分配去向：**

| 文件 | 移动目标 | section 4.2 | step 8.x |
|---|---|---|---|
| `asset-detector.js` | `adapters/html/reader/asset-detector.js` | 第 330-331 行 | 第 2141 行 |
| `authoring-validator.js` | `adapters/html/validators/authoring-validator.js` | 第 339-340 行 | 第 2144 行 |
| `browser-snapshot.js` | `adapters/html/reader/browser-snapshot.js` | 第 324-325 行 | 第 2139 行 |
| `instructions-compiler.js` | `writers/indesign/instructions-compiler.js` | 第 372-373 行 | 第 2169 行 |
| `instructions-validator.js` | `writers/indesign/instructions-validator.js` | 第 375-376 行 | 第 2170 行 |
| `layout.js` | `semantic-model/layout.js` | 第 348-349 行 | 第 2147 行 |
| `page-detector.js` | `adapters/html/reader/page-detector.js` | 第 327-328 行 | 第 2140 行 |
| `source-metadata.js` | `adapters/html/reader/source-metadata.js` | 第 333-334 行 | 第 2142 行 |
| `stacking.js` | `adapters/html/reader/stacking.js` | 第 342-343 行 | 第 2145 行 |
| `style-compiler.js` | `writers/indesign/style-compiler.js` | 第 369-370 行 | 第 2168 行 |
| `style-reader.js` | `adapters/html/reader/style-reader.js` | 第 345-346 行 | 第 2146 行 |
| `style-utils.js` | `shared/style-utils.js` | 第 351-352 行 | 第 2148 行 |
| `index.js` | 临时 facade → 阶段 8 完成后删除 | section 3.3 | — |

**`src/indesign-reverse/` 所有 .js 文件（21 个）分配去向：**

| 文件 | 移动目标 | section 4.2 | step 8.x |
|---|---|---|---|
| `snapshot-reader.js` | `adapters/indesign/reader/snapshot-reader.js` | 第 354-355 行 | 第 2157 行 |
| `reverse-model.js` | `adapters/indesign/normalizer/snapshot-to-model.js` | 第 357-358 行 | 第 2158 行 |
| `label-whitelist.js` | `adapters/indesign/normalizer/label-whitelist.js` | 第 360-361 行 | 第 2159 行 |
| `blueprint-migration.js` | `adapters/indesign/normalizer/blueprint-migration.js` | 第 363-364 行 | 第 2160 行 |
| `html-writer.js` | `writers/html/visual-html-writer.js` | 第 378-379 行 | 第 2172 行 |
| `author-package-writer.js` | `writers/html/author-package-writer.js` | 第 381-382 行 | 第 2173 行 |
| `author-html-tree.js` | `writers/html/author-html-tree.js` | 第 384-385 行 | 第 2174 行 |
| `author-attribute-writer.js` | `writers/html/author-attribute-writer.js` | 第 387-388 行 | 第 2175 行 |
| `author-style-attrs.js` | `writers/html/author-style-attrs.js` | 第 390-391 行 | 第 2176 行 |
| `vector-svg.js` | `writers/html/vector-svg.js` | 第 393-394 行 | 第 2177 行 |
| `css-blend-mode.js` | `writers/html/css-blend-mode.js` | 第 396-397 行 | 第 2178 行 |
| `asset-reference-policy.js` | `writers/html/asset-reference-policy.js` | 第 399-400 行 | 第 2179 行 |
| `author-asset-packager.js` | `writers/html/author-asset-packager.js` | 第 402-403 行 | 第 2180 行 |
| `author-css-writer.js` | `writers/html/author-css-writer.js` | 第 405-406 行 | 第 2181 行 |
| `author-source-css.js` | `writers/html/author-source-css.js` | 第 408-409 行 | 第 2182 行 |
| `reveal-presentation-writer.js` | `writers/html/reveal-presentation-writer.js` | 第 411-412 行 | 第 2183 行 |
| `semantic-candidates.js` | `writers/html/semantic-candidates.js` | 第 414-415 行 | 第 2184 行 |
| `author-audit.js` | `writers/html/audit/author-audit.js` | 第 417-418 行 | 第 2185 行 |
| `source-roundtrip-diff.js` | `writers/html/audit/source-roundtrip-diff.js` | 第 420-421 行 | 第 2186 行 |
| `visual-geometry-audit.js` | `writers/html/audit/visual-geometry-audit.js` | 第 423-424 行 | 第 2187 行 |
| `index.js` | 临时 facade → 阶段 8 完成后删除 | section 3.3 | — |

### 5. 新公共 API 与脚本迁移一致性

**步骤 8.1 目标 API 断言**（第 2108-2120 行）:

```
api.protocol.fieldRegistry.getByPath          → src/protocol/index.js ✓
api.adapters.html.renderSnapshot              → src/adapters/html/index.js ✓
api.adapters.html.snapshotToSemanticModel     → src/adapters/html/index.js ✓
api.adapters.indesign.reverseSnapshotToSemanticModel → src/adapters/indesign/index.js ✓
api.adapters.indesign.blueprintMigrationToSemanticModel → src/adapters/indesign/index.js ✓
api.writers.indesign.semanticModelToInstructions → src/writers/indesign/index.js ✓
api.writers.indesign.compileStyles            → src/writers/indesign/index.js ✓
api.writers.html.semanticModelToHtml          → src/writers/html/index.js ✓
```

**脚本实际导入（经仓库核实）**:

| 脚本 | 当前导入 | 新路径 | 覆盖 |
|---|---|---|---|
| `indesign-e2e.js:10` | `../src/paged-html` → `renderSnapshot`、`compileInstructions`、`validateInstructions` | `adapters/html` + `writers/indesign` | 第 2294-2295 行 |
| `indesign-e2e.js:343` | `../src/indesign-reverse/author-audit` | `writers/html/audit/author-audit` | 第 2296 行 |
| `indesign-e2e.js:344` | `../src/indesign-reverse/source-roundtrip-diff` | `writers/html/audit/source-roundtrip-diff` | 第 2297 行 |
| `indesign-reverse-export.js:11` | `../src/indesign-reverse` → 8 个导出函数 | `adapters/indesign` + `writers/html` | 第 2299-2302 行 |
| `audit-reverse-visual.js:5` | `../src/indesign-reverse/visual-geometry-audit` | `writers/html/audit/visual-geometry-audit` | 第 2304-2305 行 |
| `audit-reverse-author-roundtrip.js:6` | `../src/indesign-reverse/source-roundtrip-diff` | `writers/html/audit/source-roundtrip-diff` | 第 2307-2308 行 |
| `lint-authoring.js:4` | `../src/paged-html` → `renderSnapshot`、`validateAuthoringRules` | `adapters/html` | 第 2310-2311 行 |

已验证：各目标 index 文件导出的函数集合覆盖了上述脚本实际使用的函数。`compileStyles` 不在脚本中使用（`rg compileStyles scripts/` 零命中），但其存在于 `writers/indesign/index.js` 作为公共 API 完整性补充不影响功能。

### 6. Windows / PowerShell 兼容性

- 所有 git mv 命令使用反斜杠路径（如 `src\paged-html\browser-snapshot.js`） ✓
- New-Item 命令为合法 PowerShell ✓
- `rg` 已声明为显式依赖（第 20 行），需预先安装但计划有 `rg --version` 预检 ✓
- `node --test` 命令为合法 Node.js 命令 ✓
- `npm test` 和 `npm run` 命令沿用 AGENTS.md 执行基线 ✓
- 未发现 Unix 专属命令（`grep`、`test`、`mkdir -p`、`mv`）用作最终可运行命令 ✓

### 7. 无内部文本矛盾

- "必须删除" vs "保留 facade"：section 3.2 和 3.3 明确区分了阶段内临时 facade（允许）和长期 facade（禁止），阶段 8 完成前必须删除。无矛盾。
- "生成文档是事实源" vs "保留静态表"：第 41 行明确"不得在 registry 还不完整时删除现有静态事实说明"，阶段 11 步骤 11.6 说"保留架构/规则/示例"但不再手写字段表。生成文档只替换字段清单部分。无矛盾。
- 目标 API（步骤 8.1）与迁移清单一致性：经逐项比对，8 个断言均对应新 index 的实际导出。无矛盾。
- section 4.2 与 step 8.3-8.5 一致性：前轮已验证逐文件匹配，本轮重新核对无变化。无矛盾。
