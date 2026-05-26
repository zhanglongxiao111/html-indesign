# 语义 Preset 与项目语义库设计

## 1. 背景

当前项目已经把 HTML 的 `data-id-*`、样式 token、图层 token 和 InDesign `html_indesign` 标签连接起来。但语义 token 的事实源还不够清楚：

- 一部分通用映射写在代码里，例如 E2E 脚本中的中文样式名映射。
- 一部分 token 写在 HTML、CSS 和测试 fixture 里。
- Skill 里会提醒 Agent 使用稳定 token，但没有一个可读、可 diff、可校验的项目语义库。

这会造成两个问题：

- Agent 可能临时发明 token，导致 HTML 能预览但不能稳定双向转换。
- 项目想覆盖中文样式名、图层名或新增业务语义时，没有明确入口。

因此需要把“标准语义库”和“项目语义库”做成显式 preset 文件。

## 2. 目标

建立两层语义库：

| 层级 | 用途 | 修改规则 |
| ---- | ---- | -------- |
| 标准语义库 | 本库内置默认词表，供新项目初始化或无项目 preset 时使用 | 随工具版本发布，不由业务项目直接修改 |
| 项目语义库 | 当前项目自己的 token、中文显示名、图层、样式和枚举扩展 | 跟项目源码一起提交，由 Agent 或人类维护 |

核心规则：

```text
没有项目 semanticPreset:
  使用标准语义库

配置了项目 semanticPreset:
  只使用项目语义库
  标准语义库不再参与合并
```

这叫 snapshot 覆盖模式。项目语义库通常由标准语义库初始化而来，但初始化之后就是项目自己的完整事实源。

## 3. 非目标

本设计不做：

- 不做标准库和项目库的隐式继承合并。
- 不允许 Agent 静默修改内置标准语义库。
- 不把未知 token 自动当成稳定语义。
- 不把中文显示名当作反向恢复语义的唯一依据。
- 不把页面结构模板、组件库和视觉设计系统全部塞进语义 preset。

语义 preset 只描述“哪些 token 是稳定协议词，以及它们如何映射到 InDesign 和 HTML”。具体 CSS 仍在 `styles/*.css` 中维护。

## 4. 文件结构

标准语义库放在仓库内：

```text
presets/
  architecture-report/
    semantic-preset.json
```

项目作者包中可以配置自己的语义库：

```text
project-report/
  deck.config.json
  semantic-preset.json
  pages/
  styles/
  assets/
```

`deck.config.json` 示例：

```json
{
  "schemaVersion": 1,
  "id": "project-report",
  "profile": "architecture-report",
  "semanticPreset": "semantic-preset.json",
  "entry": "deck.html",
  "styles": [
    "styles/tokens.css",
    "styles/layout.css",
    "styles/components.css",
    "styles/pages.css"
  ],
  "pages": [
    { "id": "cover", "file": "pages/00-cover.html" }
  ]
}
```

规则：

- `profile` 只说明项目类型和默认标准库候选。
- `semanticPreset` 一旦存在，就完全替代该 `profile` 的标准语义库。
- `semanticPreset` 路径必须在作者包根目录内。
- 项目可以删除标准 token，也可以改名、改中文显示名或新增 token。

## 5. 初始化命令

新增命令：

```powershell
npm run preset:init -- --profile architecture-report --out semantic-preset.json
```

行为：

1. 从 `presets/architecture-report/semantic-preset.json` 读取标准库。
2. 复制完整内容到指定 `--out`。
3. 可选更新 `deck.config.json`，写入 `"semanticPreset": "semantic-preset.json"`。
4. 不创建继承关系，不写 `extends`。

可选参数：

| 参数 | 含义 |
| ---- | ---- |
| `--profile <name>` | 标准库名称 |
| `--out <path>` | 输出项目语义库路径 |
| `--package <deck.config.json>` | 同步更新作者包配置 |
| `--force` | 覆盖已有项目语义库 |

已有输出文件时，默认失败，避免覆盖项目已维护的语义库。

## 6. Preset Schema

项目语义库示例：

```json
{
  "schemaVersion": 1,
  "profile": "architecture-report",
  "presetKind": "project-snapshot",
  "sourcePreset": {
    "profile": "architecture-report",
    "version": "1.0.0",
    "generatedAt": "2026-05-26"
  },
  "layers": {
    "text": { "displayName": "文字", "order": 80 },
    "drawing": { "displayName": "图纸", "order": 40 }
  },
  "styles": {
    "paragraphStyles": {
      "page-title": {
        "displayName": "页面标题",
        "htmlClass": "page-title"
      }
    },
    "characterStyles": {
      "term-accent": {
        "displayName": "术语强调",
        "htmlClass": "term-accent"
      }
    },
    "objectStyles": {
      "metric-card": {
        "displayName": "指标卡片",
        "htmlClass": "metric-card"
      }
    },
    "frameStyles": {
      "drawing-frame": {
        "displayName": "图纸框架",
        "htmlClass": "drawing-frame"
      }
    },
    "tableStyles": {
      "area-table": {
        "displayName": "面积指标表",
        "htmlClass": "area-table"
      }
    },
    "cellStyles": {}
  },
  "semantics": {
    "page": {
      "agenda": { "displayName": "目录页" }
    },
    "item": {
      "page-title": { "role": "text", "displayName": "页面标题" },
      "drawing-frame": { "role": "graphic", "displayName": "图纸图框" }
    }
  },
  "assets": {
    "kinds": ["raster", "pdf", "psd", "ai", "svg"],
    "fitModes": ["cover", "contain", "fill", "none"],
    "cropBoxes": ["media", "crop", "bleed", "trim", "art"]
  }
}
```

字段规则：

- `schemaVersion` 必须存在。
- `presetKind` 可以是 `standard` 或 `project-snapshot`。
- `sourcePreset` 只用于追溯，不产生继承关系。
- `layers.*.displayName` 是 InDesign 面板名。
- `styles.*.<token>.displayName` 是 InDesign 样式名。
- `styles.*.<token>.htmlClass` 是推荐 HTML class，不强制必须相同。
- `assets.kinds`、`assets.fitModes`、`assets.cropBoxes` 是枚举边界。

## 7. Token 边界

`data-id-*` 字段名是协议，token 是受控词表。

| 类型 | 来源 | 是否可临时新增 |
| ---- | ---- | -------------- |
| `data-id-paragraph-style` | preset `styles.paragraphStyles` | 否 |
| `data-id-character-style` | preset `styles.characterStyles` | 否 |
| `data-id-object-style` | preset `styles.objectStyles` | 否 |
| `data-id-frame-style` | preset `styles.frameStyles` | 否 |
| `data-id-table-style` | preset `styles.tableStyles` | 否 |
| `data-id-cell-style` | preset `styles.cellStyles` | 否 |
| `data-id-layer` | preset `layers` | 否 |
| `data-id-semantic` | preset `semantics` | 否 |
| `data-id-asset-kind` | preset `assets.kinds` | 否 |
| `data-id-fit` | preset `assets.fitModes` | 否 |
| `data-id-crop` | preset `assets.cropBoxes` | 否 |

Agent 需要新 token 时，必须先修改项目 `semantic-preset.json`，再在 HTML/CSS 中使用。只写 HTML 或 CSS 不算登记。

## 8. 加载规则

新增 `src/semantic-preset/` 模块，提供：

| 函数 | 责任 |
| ---- | ---- |
| `loadStandardPreset(profile)` | 读取内置标准库 |
| `loadProjectPreset(configPath)` | 从 `deck.config.json` 读取项目语义库 |
| `resolveSemanticPreset(configPath, options)` | 根据配置返回最终语义库 |
| `presetToStyleNameMap(preset)` | 生成当前转换器消费的 `styleNameMap` |
| `validateSemanticPreset(preset)` | 校验 preset schema 和重复项 |
| `knownTokensFromPreset(preset)` | 给 lint 使用的 token 索引 |

`resolveSemanticPreset` 规则：

```text
if deck.config.json has semanticPreset:
  return loadProjectPreset(...)
else:
  return loadStandardPreset(profile || "architecture-report")
```

不得在这里做标准库与项目库合并。

## 9. 正向转换使用方式

HTML -> InDesign 时：

1. 如果入口 HTML 来自作者包，读取 `data-id-source-package-config` 找到 `deck.config.json`。
2. 根据配置解析最终语义库。
3. 把语义库转换为 `styleNameMap`、图层显示名、枚举边界和校验词表。
4. 编译 instructions。
5. 把语义库来源写入 Document 标签。

Document 标签增加：

```json
{
  "kind": "document",
  "profile": "architecture-report",
  "semanticPreset": {
    "mode": "project-snapshot",
    "path": "semantic-preset.json",
    "profile": "architecture-report",
    "schemaVersion": 1
  }
}
```

如果没有项目语义库：

```json
{
  "semanticPreset": {
    "mode": "standard",
    "profile": "architecture-report",
    "schemaVersion": 1
  }
}
```

## 10. Lint 规则

`npm run lint:authoring -- --package <deck.config.json>` 应加载最终语义库。

新增检查：

| 检查 | 普通模式 | strict 模式 | 说明 |
| ---- | -------- | ----------- | ---- |
| `SEMANTIC_PRESET_MISSING` | error | error | `semanticPreset` 指向的文件不存在 |
| `SEMANTIC_PRESET_INVALID` | error | error | preset 结构无效 |
| `SEMANTIC_TOKEN_UNKNOWN` | warning | error | HTML 使用了未登记 token |
| `SEMANTIC_ENUM_UNKNOWN` | error | error | 枚举字段使用了不支持值 |
| `SEMANTIC_TOKEN_UNUSED` | info | warning | preset 中 token 未被当前项目使用，可作为清理提示 |

unknown token 不能被静默当作普通 class。普通开发阶段可以 warning，交付或严格模式必须失败。

## 11. 反向导出候选语义

InDesign -> HTML 时，不应自动写回项目语义库。

反向导出遇到以下情况时，生成候选文件：

- InDesign 样式有中文显示名，但没有可回读 token。
- 图层有面板名，但 preset 中不存在对应 token。
- 页面对象有 `semantic`，但项目 preset 未登记。
- 观察模式从视觉结构推断出潜在语义。

输出：

```text
reverse-html/
  author/
    reports/
      semantic-candidates.json
```

示例：

```json
{
  "schemaVersion": 1,
  "source": "indesign-reverse",
  "candidates": [
    {
      "kind": "paragraphStyles",
      "tokenSuggestion": "risk-note",
      "displayName": "风险提示",
      "evidence": {
        "styleName": "风险提示",
        "usedByItems": ["p3-note-01"]
      },
      "confidence": 0.78
    }
  ]
}
```

只有人类确认或显式命令执行时，候选才可以合并进项目 preset。

## 12. 合并候选命令

后续可以新增命令：

```powershell
npm run preset:merge-candidates -- --package deck.config.json --candidates reverse-html/author/reports/semantic-candidates.json
```

默认行为：

- 打印将要新增或覆盖的 token。
- 不自动覆盖已有 token，除非传 `--force`.
- 合并后运行 preset 校验。
- 不修改标准语义库。

该命令是可选增强。第一阶段可以只生成候选文件，不实现自动合并。

## 13. Agent 使用规则

Agent 编写 HTML 时：

1. 先读取项目 `semantic-preset.json`。
2. 优先使用已有 token。
3. 需要新语义时，先改项目 preset，再写 HTML 和 CSS。
4. 写完运行 `lint:authoring --strict`。
5. 不改 `presets/` 下标准库，除非用户明确要求修改工具默认语义。

Skill 应明确：

- 项目语义库是当前项目事实源。
- 标准语义库只是初始化模板或无项目库时的 fallback。
- 配置项目库后，不再隐式继承标准库。
- 未登记 token 不算稳定语义。

## 14. 插件化实现约束

本设计先在 `html-indesign` 仓库内实现，不要求本阶段实现 `indesign-cli` 插件宿主。但实现必须为后续插件化保留清晰调用边界。

规则：

- 语义 preset 能力必须下沉为库 API，放在 `src/semantic-preset/` 这类职责明确的模块中。
- `scripts/preset-init.js`、`scripts/lint-authoring.js` 等 npm scripts 只能做薄 CLI 包装，不承载核心业务逻辑。
- 所有核心 API 必须接收显式路径，例如 `configPath`、`rootDir`、`outDir`、`presetPath`，不得隐式依赖当前工作目录。
- API 返回结构化对象，包含 `ok`、`errors`、`warnings`、`files`、`preset`、`summary` 等字段；CLI 包装层再负责 `console.log` 和 exit code。
- 错误必须有稳定 `code`，方便未来 `indesign-cli` JSON envelope 直接包装。
- 标准 preset 必须位于可打包路径，例如 `presets/architecture-report/semantic-preset.json`，不能藏在 `test/fixtures/`。
- 未来 `html-indesign` 插件入口应复用同一套库 API，而不是 shell 调 npm script。
- 本阶段不实现 `indesign-cli plugin`、`indesign-cli html ...` 或 Python entry point，只保证 API 边界能被这些入口调用。

与 `indesign-cli` 插件集成的长期边界见 `2026-05-27-indesign-cli-plugin-integration-design.md`。

## 15. 测试要求

需要新增测试：

| 测试 | 证明 |
| ---- | ---- |
| 标准 preset 能加载 | 无项目语义库时仍可转换 |
| 项目 preset 完全替代标准 preset | 标准库 token 在项目库缺失时不再可用 |
| `presetToStyleNameMap` 输出兼容现有转换器 | 迁移硬编码映射不改视觉行为 |
| `lint:authoring --strict` 拒绝未知 token | Agent 不能只在 HTML 中临时造词 |
| 枚举字段非法值直接失败 | 资源类型、裁切、适配不被误读 |
| 反向导出写候选文件 | 未登记样式不污染项目 preset |

现有架构汇报 fixture 应先通过 `preset:init` 生成项目语义库，再把 E2E 改为读取该项目语义库。

## 16. 迁移策略

第一阶段：

1. 新增标准 `architecture-report` preset。
2. 从 E2E 脚本迁出当前 `architectureStyleNameMap`。
3. 给现有 fixture 生成项目 `semantic-preset.json`。
4. `deck.config.json` 显式引用项目语义库。
5. `lint:authoring` 增加 unknown token 检查。
6. 核心逻辑全部通过 `src/semantic-preset/` API 暴露，npm scripts 保持薄包装。

第二阶段：

1. 让所有 HTML -> InDesign 编译入口读取 preset。
2. 把 preset 来源写入 InDesign Document 标签。
3. 反向导出生成 `semantic-candidates.json`。

第三阶段：

1. 增加候选合并命令。
2. 支持用户创建新的标准 profile。
3. 把长期规则沉淀到 `docs/规范/SEMANTIC_PROTOCOL.md` 和 Skill。

## 17. 成功标准

完成后应满足：

- Agent 能一眼看到当前项目允许使用的全部语义 token。
- 新 token 必须进入项目语义库，不能只散落在 HTML/CSS 中。
- 项目配置了 `semanticPreset` 后，转换结果不受标准库升级影响。
- 无项目语义库时，标准库仍提供可用默认行为。
- 反向导出不会静默污染语义库，只生成候选。
- InDesign 面板中文名来自 preset，而不是散落在脚本硬编码里。
- 语义 preset 能力可以被 npm scripts 和未来 `indesign-cli` 插件入口复用。

## 18. 关键决策

- 采用 snapshot 覆盖模式，不采用隐式继承合并。
- 项目语义库是项目事实源。
- 标准语义库是初始化模板和 fallback。
- Agent 可以维护项目语义库，但不能直接改标准语义库。
- 未登记 token 是错误或警告，不是稳定语义。
- 候选语义需要显式确认后才能进入项目语义库。
- 本阶段不实现 `indesign-cli` 插件宿主，但实现必须按可插件化 API 边界组织。
