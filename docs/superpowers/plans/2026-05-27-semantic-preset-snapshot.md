# 语义 Preset 快照实现计划

> **给执行 Agent 的要求：** 必须使用 `subagent-driven-development`（推荐）或 `executing-plans` 按任务执行本计划。执行过程中实时更新本文件 checkbox 进度，不能到最后一次性补勾。

**目标：** 实现“项目语义库快照”能力。作者包可以在 `deck.config.json` 中声明自己的 `semanticPreset`；声明后只使用项目语义库，标准语义库不再参与合并。该能力同时要为未来作为 `indesign-cli` 插件提供稳定的库级 API。

**架构：** 新增 `src/semantic-preset/` 作为语义库加载、校验、映射和审计层。标准语义库落在 `presets/architecture-report/semantic-preset.json`。作者包、规则检查、语义模型、构建指令和真实 E2E 都通过这层读取当前激活的语义库，不再散落硬编码映射。

**技术栈：** Node.js CommonJS、Node test runner、现有作者包组装器、现有浏览器快照、现有 InDesign 指令编译链路、JSON preset。

---

## 0. 执行前基线

- [ ] 查看工作区状态，不回退用户或既有会话改动。

```powershell
git status --short
```

- [ ] 确认相关 spec 存在。

```powershell
Test-Path docs\superpowers\specs\2026-05-26-semantic-preset-snapshot-design.md
Test-Path docs\superpowers\specs\2026-05-27-indesign-cli-plugin-integration-design.md
```

预期输出：

```text
True
True
```

- [ ] 后续每完成一个任务块，立即更新本计划 checkbox。

---

## 1. 新增标准语义库和核心模块

**新增文件：**

- `presets/architecture-report/semantic-preset.json`
- `src/semantic-preset/index.js`
- `src/semantic-preset/errors.js`
- `src/semantic-preset/schema.js`
- `src/semantic-preset/loader.js`
- `src/semantic-preset/maps.js`
- `test/semantic-preset/semantic-preset.test.js`

**标准语义库内容：**

创建 `presets/architecture-report/semantic-preset.json`。内容来自当前 `scripts/indesign-e2e.js` 中硬编码的建筑汇报中文样式名。

```json
{
  "schemaVersion": 1,
  "id": "architecture-report",
  "name": "建筑汇报标准语义库",
  "description": "html-indesign 建筑设计汇报默认语义库。项目声明 semanticPreset 后，此文件只作为初始化副本，不再自动合并。",
  "styleNameMap": {
    "paragraphStyles": {
      "eyebrow": "眉题",
      "cover-title": "封面标题",
      "cover-subtitle": "封面副标题",
      "metric-value": "指标数值",
      "metric-label": "指标标签",
      "page-title": "页面标题",
      "body-copy": "正文",
      "caption": "说明文字",
      "annotation": "标注文字",
      "callout": "引出说明",
      "table-cell": "表格正文",
      "table-head": "表头文字",
      "axis-label": "轴线标签",
      "legend-label": "图例文字",
      "footer-note": "页脚注释"
    },
    "characterStyles": {
      "emphasis": "重点强调",
      "muted": "弱化文字",
      "pdf-reference": "PDF 置入提示",
      "asset-reference": "资产引用",
      "number": "编号字符",
      "unit": "单位字符",
      "label": "标签字符"
    },
    "objectStyles": {
      "cover-image": "封面图像",
      "cover-overlay": "封面渐变遮罩",
      "metric-card": "指标卡片",
      "chapter-card": "章节卡片",
      "timeline": "时间轴线",
      "timeline-dot": "时间节点",
      "summary-frame": "总图图框",
      "callout-line": "标注引线",
      "callout-label": "标注标签",
      "legend": "图例框",
      "swatch": "色块",
      "image-frame": "图片图框",
      "caption-frame": "图解对象",
      "strategy-card": "策略卡片",
      "drawing-frame": "图纸图框",
      "material-board": "材料图框",
      "plan-frame": "平面图框",
      "info-panel": "说明面板",
      "table-frame": "表格框"
    },
    "frameStyles": {
      "image-frame": "图片图框",
      "drawing-frame": "图纸图框",
      "summary-frame": "总图图框",
      "plan-frame": "平面图框",
      "caption-frame": "图解对象"
    },
    "tableStyles": {
      "area-schedule": "面积指标表",
      "material-schedule": "材料清单表",
      "program-matrix": "功能矩阵表",
      "asset-index": "资产索引表"
    },
    "cellStyles": {
      "table-head": "表头单元格",
      "table-cell": "正文单元格",
      "table-number": "数字单元格",
      "table-total": "合计单元格"
    },
    "layers": {
      "guides": "参考线",
      "annotations": "标注组",
      "annotation": "标注",
      "text": "文字",
      "tables": "表格",
      "overlay": "遮罩",
      "content": "内容",
      "graphics": "图形",
      "drawing": "图纸",
      "image": "图片",
      "background": "背景"
    }
  },
  "tokens": {
    "semantic": [
      "cover",
      "contents",
      "masterplan",
      "drawing-sheet",
      "analysis",
      "strategy",
      "materials",
      "schedule"
    ],
    "assets": [
      "image",
      "pdf",
      "svg",
      "ai",
      "psd"
    ],
    "fits": [
      "cover",
      "contain",
      "fill"
    ],
    "crops": [
      "media",
      "trim",
      "bleed",
      "art",
      "crop"
    ]
  }
}
```

**核心 API：**

`src/semantic-preset/index.js` 导出：

```js
module.exports = {
  SemanticPresetError,
  loadSemanticPreset,
  loadStandardSemanticPreset,
  loadProjectSemanticPreset,
  resolveSemanticPreset,
  validateSemanticPreset,
  presetToStyleNameMap,
  collectKnownSemanticTokens,
};
```

`src/semantic-preset/errors.js` 定义带错误码的异常：

```js
class SemanticPresetError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'SemanticPresetError';
    this.code = code;
    this.details = details || {};
  }
}
```

**测试要求：**

- 标准语义库能按 `architecture-report` 加载。
- 校验器能拒绝缺少 `schemaVersion`、`id`、`styleNameMap` 的文件。
- `presetToStyleNameMap()` 输出现有中文样式名。
- `collectKnownSemanticTokens()` 同时收集样式 token 和 `tokens` 数组。

验证命令：

```powershell
node --test test\semantic-preset\semantic-preset.test.js
```

---

## 2. 实现项目语义库覆盖规则

**修改文件：**

- `src/semantic-preset/loader.js`
- `src/semantic-preset/schema.js`
- `src/authoring/source-package.js`
- `test/semantic-preset/semantic-preset.test.js`

**行为规则：**

- `deck.config.json` 没有 `semanticPreset`：使用标准语义库。
- `deck.config.json` 有 `semanticPreset`：只使用项目语义库。
- 项目语义库不能逃出作者包目录。
- 不能做标准语义库和项目语义库的隐式合并。

**加载 API：**

`resolveSemanticPreset(options)` 需要支持：

```js
resolveSemanticPreset({
  rootDir,
  config,
  profile,
  presetPath,
});
```

返回结构：

```js
{
  ok: true,
  source: 'standard' | 'project' | 'file',
  profile: 'architecture-report',
  rootDir: 'D:/AI/html-indesign/test/fixtures/e2e/architecture-report',
  relativePath: 'semantic-preset.json',
  filePath: 'D:/AI/html-indesign/test/fixtures/e2e/architecture-report/semantic-preset.json',
  preset: {},
  warnings: []
}
```

项目路径越界时抛出：

```js
new SemanticPresetError('SEMANTIC_PRESET_OUTSIDE_PACKAGE', 'Project semantic preset must stay inside the author package root', {
  rootDir,
  filePath,
});
```

**作者包集成：**

`src/authoring/source-package.js`：

- 读取并校验 `config.semanticPreset`。
- 返回 `semanticPreset: { relativePath, filePath }`。
- `assembleAuthorPackage()` 在 `<main class="deck">` 上写入：

```html
data-id-semantic-preset="semantic-preset.json"
```

**测试要求：**

- 没有 `semanticPreset` 时能回到标准语义库。
- 项目 preset 路径越界时报 `SEMANTIC_PRESET_OUTSIDE_PACKAGE`。
- 有项目 preset 时，标准 token 不再自动可用。

---

## 3. 增加项目语义库初始化命令

**新增或修改文件：**

- `src/semantic-preset/init.js`
- `scripts/preset-init.js`
- `package.json`
- `test/semantic-preset/preset-init-cli.test.js`
- `AGENTS.md`

**命令：**

```powershell
npm run preset:init -- -- --package test\fixtures\e2e\architecture-report\deck.config.json
npm run preset:init -- -- --package test\fixtures\e2e\architecture-report\deck.config.json --profile architecture-report --out semantic-preset.json --force --json
```

**脚本入口：**

`package.json` 增加：

```json
{
  "scripts": {
    "preset:init": "node scripts/preset-init.js"
  }
}
```

**库级 API：**

`src/semantic-preset/init.js` 导出：

```js
function initProjectSemanticPreset(options) {
  const opts = options || {};
  const packagePath = path.resolve(opts.packagePath);
  const loadedPackage = loadAuthorPackageConfig(packagePath);
  const rootDir = loadedPackage.rootDir;
  const outRelative = opts.out || 'semantic-preset.json';
  const outPath = path.resolve(rootDir, outRelative);

  const standard = loadStandardSemanticPreset(opts.profile || loadedPackage.config.profile || 'architecture-report');
  fs.writeFileSync(outPath, `${JSON.stringify(standard.preset, null, 2)}\n`, 'utf8');

  const config = Object.assign({}, loadedPackage.config, {
    semanticPreset: path.relative(rootDir, outPath).replace(/\\/g, '/'),
  });
  writeAuthorPackageConfig(packagePath, config);

  return {
    ok: true,
    files: {
      configPath: packagePath,
      presetPath: outPath,
    },
    preset: {
      source: 'project',
      id: standard.preset.id,
      relativePath: config.semanticPreset,
    },
  };
}
```

如果 `src/authoring/source-package.js` 还没有写配置函数，增加：

```js
function writeAuthorPackageConfig(configPath, config) {
  fs.writeFileSync(path.resolve(configPath), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
```

**命令行为：**

- 默认输出 `semantic-preset.json`。
- 文件已存在且没有 `--force` 时失败，错误码 `SEMANTIC_PRESET_EXISTS`。
- `--json` 输出结构化结果。
- 普通模式输出一行成功信息。

**测试要求：**

- 能复制标准语义库。
- 能写回 `deck.config.json` 的 `semanticPreset`。
- 无 `--force` 不覆盖已有文件。
- `--json` 输出可解析 JSON。

更新 `AGENTS.md` 执行基线：

```markdown
| 初始化项目语义库 | `npm run preset:init -- -- --package <deck.config.json>` |
```

---

## 4. 把语义库接入作者侧规则检查

**新增或修改文件：**

- `src/semantic-preset/audit-authoring.js`
- `scripts/lint-authoring.js`
- `test/authoring/lint-authoring-package-cli.test.js`

**检查范围：**

扫描作者包 `pages/*.html` 中的这些字段：

- `data-id-paragraph-style`
- `data-id-character-style`
- `data-id-object-style`
- `data-id-frame-style`
- `data-id-table-style`
- `data-id-cell-style`
- `data-id-layer`
- `data-id-semantic`
- `data-id-asset-kind`
- `data-id-fit`
- `data-id-crop`

**严重级别：**

- 非严格模式：未知样式 token 是 warning。
- 严格模式：未知样式 token 是 error。
- 未知资源类型、适配方式、裁切方式始终是 error。

**输出格式：**

`npm run lint:authoring -- -- --package ... --strict --json` 增加：

```json
{
  "semanticPreset": {
    "source": "project",
    "id": "architecture-report",
    "relativePath": "semantic-preset.json"
  }
}
```

**测试要求：**

- 标准语义库下 `data-id-object-style="metric-card"` 通过。
- 项目语义库删除 `metric-card` 后，严格模式失败。
- 上一条同时证明项目 preset 没有和标准 preset 合并。
- `data-id-asset-kind="spreadsheet"` 在非严格模式也失败。

验证命令：

```powershell
node --test test\authoring\lint-authoring-package-cli.test.js
npm run lint:authoring -- -- --package test\fixtures\e2e\architecture-report\deck.config.json --strict --json
```

---

## 5. 迁移真实 E2E 的硬编码映射

**修改文件：**

- `scripts/indesign-e2e.js`
- `test/indesign-e2e-runner.test.js`
- `test/fixtures/e2e/architecture-report/deck.config.json`
- `test/fixtures/e2e/architecture-report/semantic-preset.json`

**fixture 改动：**

`test/fixtures/e2e/architecture-report/deck.config.json` 增加：

```json
"semanticPreset": "semantic-preset.json"
```

创建 `test/fixtures/e2e/architecture-report/semantic-preset.json`，内容复制标准语义库。它是 fixture 自己的项目副本，后续标准语义库变化不应隐式改变 fixture。

**E2E 编译规则：**

`scripts/indesign-e2e.js` 中正常编译必须从 preset 读取 `styleNameMap`，不再直接调用硬编码对象。

保留 `architectureStyleNameMap()` 作为兼容导出，但改为从标准 preset 生成：

```js
function architectureStyleNameMap() {
  const resolved = resolveSemanticPreset({ profile: 'architecture-report' });
  return presetToStyleNameMap(resolved.preset);
}
```

新增辅助逻辑：

```js
function loadStyleNameMapForHtml(htmlPath, options) {
  if (options && options.styleNameMap) return options.styleNameMap;

  const packageInfo = findAuthorPackageForHtml(htmlPath);
  if (packageInfo) {
    const resolved = resolveSemanticPreset({
      rootDir: packageInfo.rootDir,
      config: packageInfo.config,
    });
    return presetToStyleNameMap(resolved.preset);
  }

  const resolved = resolveSemanticPreset({ profile: 'architecture-report' });
  return presetToStyleNameMap(resolved.preset);
}
```

**测试要求：**

- 现有 E2E runner 测试通过。
- 项目 preset 改名某个对象样式时，生成 instructions 使用项目名。
- 删除项目 preset 配置时回到标准 preset。

验证命令：

```powershell
node --test test\indesign-e2e-runner.test.js
```

---

## 6. 把语义库元数据写入模型和标签

**修改文件：**

- `src/paged-html/source-metadata.js`
- `src/semantic-model/from-snapshot.js`
- `src/semantic-model/to-instructions.js`
- `src/authoring/source-package.js`
- `test/paged-html/source-metadata.test.js`
- `test/semantic-model/from-snapshot.test.js`

**HTML 元数据：**

作者包组装后的 `deck.html` 应包含：

```html
<main
  class="deck"
  data-id-document="architecture-report"
  data-id-profile="architecture-report"
  data-id-source-package-config="deck.config.json"
  data-id-source-package-schema="1"
  data-id-semantic-preset="semantic-preset.json"
>
```

**语义模型：**

模型 document 节点包含：

```js
semanticPreset: {
  source: 'project',
  id: 'architecture-report',
  relativePath: 'semantic-preset.json',
}
```

**InDesign 标签：**

写入 `html_indesign` 文档标签：

```json
{
  "html_indesign": {
    "kind": "document",
    "version": 1,
    "profile": "architecture-report",
    "sourcePackage": {
      "config": "deck.config.json",
      "schemaVersion": 1
    },
    "semanticPreset": {
      "source": "project",
      "id": "architecture-report",
      "relativePath": "semantic-preset.json"
    }
  }
}
```

不要把本机绝对路径写进 InDesign 标签。

**测试要求：**

- `deck.html` 写出 `data-id-semantic-preset`。
- source metadata 能读回。
- semantic model 能保留。
- instructions labels 能保留。

验证命令：

```powershell
node --test test\paged-html\source-metadata.test.js test\semantic-model\from-snapshot.test.js
```

---

## 7. 反向导出生成语义候选报告

**新增或修改文件：**

- `src/indesign-reverse/semantic-candidates.js`
- `src/indesign-reverse/author-package-writer.js`
- `test/indesign-reverse/semantic-candidates.test.js`
- `test/indesign-reverse/author-package-writer.test.js`

**目的：**

反向导出不能自动篡改项目语义库，但应该把 InDesign 中观察到、当前 preset 未登记的语义候选记录出来，方便 Agent 或人类后续加入项目 preset。

**输出文件：**

```text
reverse-html/author/reports/semantic-candidates.json
```

**输出结构：**

```json
{
  "schemaVersion": 1,
  "presetId": "architecture-report",
  "candidates": [
    {
      "kind": "objectStyles",
      "token": "legacy-object-style-abc123",
      "suggestedName": "旧对象样式 abc123",
      "source": "reverse-export",
      "count": 3
    }
  ]
}
```

**测试要求：**

- 已知 preset token 不进入候选。
- 未知 reverse token 进入候选，并统计次数。
- `author-package-writer` 会创建 `reports/semantic-candidates.json`。

验证命令：

```powershell
node --test test\indesign-reverse\semantic-candidates.test.js test\indesign-reverse\author-package-writer.test.js
```

---

## 8. 更新文档和作者 Skill

**修改文件：**

- `.codex/skills/html-indesign-authoring/SKILL.md`
- `docs/规范/SEMANTIC_PROTOCOL.md`
- `docs/规范/LABEL_PROTOCOL.md`
- `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`
- `docs/superpowers/specs/README.md`
- `AGENTS.md`

**文档必须说明：**

- `data-id-*` 字段名是固定协议，不允许项目自造字段名替代。
- token 值来自当前激活的语义库。
- 未声明 `semanticPreset` 时使用标准语义库。
- 声明 `semanticPreset` 时只使用项目语义库，不再合并标准语义库。
- `preset:init` 是给项目创建标准副本并启用项目覆盖的入口。
- 未来 `indesign-cli` 插件必须调用 `src/semantic-preset/` API，不应通过 shell 调 npm scripts。
- `.codex/skills/html-indesign-authoring/SKILL.md` 保持中文，不能写成英文提示词。
- 网格示例只能是示例，不能写成所有项目都必须使用固定列数和固定 baseline。

验证命令：

```powershell
Select-String -Path .codex\skills\html-indesign-authoring\SKILL.md -Pattern "semanticPreset","标准语义库","项目语义库"
Select-String -Path AGENTS.md -Pattern "preset:init"
```

---

## 9. 完整验证

先跑目标测试：

```powershell
node --test test\semantic-preset\semantic-preset.test.js
node --test test\semantic-preset\preset-init-cli.test.js
node --test test\authoring\lint-authoring-package-cli.test.js
node --test test\indesign-e2e-runner.test.js
node --test test\paged-html\source-metadata.test.js test\semantic-model\from-snapshot.test.js
node --test test\indesign-reverse\semantic-candidates.test.js test\indesign-reverse\author-package-writer.test.js
```

再跑全量测试：

```powershell
npm test
```

预期：全部通过。测试数量可能因为新增用例增长，但失败数必须为 0。

作者包验证：

```powershell
npm run assemble:authoring -- -- --package test\fixtures\e2e\architecture-report\deck.config.json
npm run assemble:authoring -- -- --package test\fixtures\e2e\architecture-report\deck.config.json --check
npm run lint:authoring -- -- --package test\fixtures\e2e\architecture-report\deck.config.json --strict --json
```

预期：

- 组装成功。
- `--check` 成功。
- lint JSON 中 `"valid": true`。
- lint JSON 中包含 `"semanticPreset":{"source":"project"`。

真实 InDesign 验证：

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip --skip-preview
```

预期：

- 真实 InDesign 构建成功。
- `missingAssets` 为 0。
- 没有溢出文字框。
- 生成反向作者包。
- 二次回环门禁通过。

如果本机没有把 `indesign-cli` 加入 `PATH`，使用：

```powershell
$env:INDESIGN_CLI_BIN="<indesign-cli.exe 绝对路径>"
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip --skip-preview
```

不能回退到 `cli-anything-indesign`。

---

## 10. 清理和提交

- [ ] 删除临时脚本、调试 JSON、非 `test/workspace/` 的一次性产物。

- [ ] 查看最终状态：

```powershell
git status --short
```

- [ ] 审核最终 diff，确认没有 fixture 过拟合：

```powershell
git diff -- presets src scripts test docs .codex AGENTS.md package.json
```

- [ ] 验证通过后提交：

```powershell
git add presets src scripts test docs .codex AGENTS.md package.json package-lock.json
git commit -m "Add semantic preset project override support"
```

不要提交 `test/workspace/`。
