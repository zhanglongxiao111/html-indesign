# 回复：协议字段注册表架构审核（GPT Pro）

时间：2026-05-31

来源：ChatGPT Pro / GitHub 连接器

仓库：`zhanglongxiao111/html-indesign`

分支：`main`

提交：`033da5c`

说明：这是外部模型意见。后续采纳前必须回到本地代码、测试和 `AGENTS.md` 核实。

## GPT Pro 回复原文

## 结论：局部调整后采纳

我建议**局部调整后采纳**，不需要推倒重写。

这份 spec 的核心方向是对的：以统一 Semantic Model 为中心，把 HTML、InDesign、未来 PPTX 都约束成“格式适配器 / writer + 统一字段注册表 + 能力矩阵”，这和 `AGENTS.md` 以及长期规范已经一致。`AGENTS.md` 明确说当前主线是 HTML/InDesign，未来 PPTX 只能通过统一语义模型和格式适配器接入，不能另起两两互转链路；长期库规范也把 PPTX 接入写成 `HTML Adapter <-> Semantic Model <-> InDesign Adapter`、`PPTX Adapter <-> Semantic Model` 的模式。

但这份 spec **还不能直接作为实现蓝图原样落地**。主要问题不是方向错，而是：字段分类还混了两个轴、字段路径示例与现有代码/长期静态表有不小差异、能力矩阵缺少读/写/持久化方向、迁移阶段 2 有变成大爆炸重构的风险。调整这些后，它很适合这个项目。

---

## 我实际查看到的关键文件、模块和数据流

我查看了以下关键文档：

`AGENTS.md`：确认项目硬规则、当前/计划中目录、PPTX 多格式边界、字段注册表“设计但未实现”的状态。它明确要求新增协议字段先纳入字段注册表；注册表实现前，现有静态字段表仍是临时事实源；格式能力差异要进入能力矩阵。

目标 spec：`docs/superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md`。我重点核对了目标架构、字段分类、注册表样例、能力矩阵、生命周期、迁移阶段、PPTX 预留边界。该 spec 把目标架构写成 `HTML/InDesign/PPTX Format Adapter -> Canonical Semantic Model -> Format Writer`，并明确不立即实现 PPTX、不一次性重写现有链路。

长期规范：`docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`、`SEMANTIC_PROTOCOL.md`、`LABEL_PROTOCOL.md`、`REVERSE_EXPORT.md`。这些文档已经把当前主线、固定语义 HTML、`html_indesign` 标签、反向导出观察模式、静态字段表事实源写清楚了。

文档引用链：`docs/README.md`、`docs/规范/README.md`、`docs/superpowers/specs/README.md`。这些引用总体准确，尤其 `docs/README.md` 已明确 `superpowers/specs/` 是“方案设计和边界分析，不自动等同长期规范”，并说明注册表落地前静态字段表仍是当前行为事实源。

我查看的当前代码主链路包括：

`src/paged-html/index.js`：当前正向入口暴露 `renderSnapshot`、`compileStyles`、`snapshotToSemanticModel`、`compileInstructions`、校验器，说明代码已经不是纯 instructions 直出，而是有 `src/semantic-model` 中间层。

`src/paged-html/browser-snapshot.js`：浏览器侧采集页面、元素、computed/authored style、`data-id-*`、source node、unsupported CSS effects、表格、资源候选等。

`src/semantic-model/from-snapshot.js` 与 `to-instructions.js`：当前正向数据流是 snapshot -> `DocumentModel` -> InDesign instructions。模型里已经包含 document/page/item labels、source metadata、style refs、grid、structure、assets 等。

`src/paged-html/asset-detector.js`：现有 PDF/AI/PSD/SVG 资源置入字段已经很具体，当前读取的是 `data-id-pdf-page`、`data-id-crop`、`data-id-artboard`、`data-id-visible-layers`、`data-id-hidden-layers`、`data-id-content-*` 等，不读取旧 `data-id-page`。

`src/indesign-reverse/reverse-model.js`、`label-whitelist.js`、`html-writer.js`、`author-html-tree.js`：反向链路已经有 `effectiveLabel` / `observedLabel`、语义库白名单、sourceNode 恢复、PDF 页码写回、退役 `data-id-page` 清理等机制。

当前实际数据流可以概括为：

```text
正向：
Paged HTML
-> Browser Snapshot
-> Style Compilation
-> Semantic Model
-> InDesign Build Instructions
-> InDesign Executor

反向：
InDesign reverse snapshot
-> label whitelist / observed facts
-> Semantic Model
-> visual HTML / author source package
```

这与目标 spec 的方向一致，但字段注册表本身在当前提交还没有实现；搜索 `src/protocol` / `field-registry` / `capability-matrix` 只命中了文档，没有命中代码实现。

---

## 按严重程度列出的问题

### 高：字段分类在 spec 内部不够一致，容易把“字段种类”和“生命周期状态”混在一起

目标 spec 第 5.2 节说字段分三类：`canonical`、`source metadata`、`format extension`。但用户关注的五类字段，以及长期库规范里的表述，是 `canonical field`、`source metadata`、`format extension`、`observation field`、`retired field`。

spec 后面第 9 节又单独讨论 observation 和 retired，规则本身是合理的，但没有把它们放回统一 registry schema 里。这样实现时容易出现两种风险：第一，observation 字段被当成 canonical 字段注册；第二，retired 字段只写在文档里，校验器无法知道它应该“只读为观察、禁止写出”。

建议把字段体系改成**两轴模型**：

```text
fieldClass:
  canonical
  sourceMetadata
  formatExtension
  observation

lifecycle:
  active
  candidate
  deprecated
  retired
```

`retired` 不应是一个与 canonical 平级的字段种类，而是某个历史字段的生命周期状态。它仍需要登记旧路径、替代路径、读策略、写策略、迁移报告策略。observation 可以是 `fieldClass`，也可以是 `readPolicy` 的结果，但不要和 active canonical 混用。

---

### 高：目标字段路径示例与当前代码/静态规范有差异，直接落地会引发不必要的破坏性重命名

目标 spec 在资产置入里写了 `items[].asset.placement.pdfPage`，并在退役示例里把旧字段替换为 `items[].asset.placement.pdfPage`。

但当前长期规范和代码使用的是另一组事实路径：`LABEL_PROTOCOL.md` 明确 PDF 置入页码写入 `asset.pageNumber`，HTML 对应 `data-id-pdf-page`；`asset-detector.js` 当前读取的是 `data-id-pdf-page` 并转成 `placement.pageNumber`；正向 instructions 的 placed payload 也是 `pageNumber`。

这不是说目标 spec 的命名一定错，而是它不能作为“立即替换当前路径”的实现依据。更安全的方式是：注册表第一版必须登记**当前行为事实路径**，同时允许记录目标标准路径和别名映射。例如：

```js
{
  canonicalPath: 'items[].asset.placement.pageNumber',
  currentPaths: [
    'items[].asset.pageNumber',
    'items[].asset.placement.pageNumber',
    'instructions.pages[].items[].placed.pageNumber'
  ],
  html: {
    readAttrs: ['data-id-pdf-page'],
    retiredAttrs: ['data-id-page']
  },
  retiredAliases: [
    {
      attr: 'data-id-page',
      reason: 'ambiguous-with-page-identity',
      readPolicy: 'observe-only',
      writePolicy: 'forbidden'
    }
  ]
}
```

同类问题还包括页面尺寸字段。目标 spec 使用 `pages[].size`，但当前长期规范里 DocumentModel 是 `pageSize.widthMm` / `pageSize.heightMm`，PageModel 是 `widthMm` / `heightMm`，当前代码里 `from-snapshot.js` 又生成 page 的 `width` / `height` 和 document 的 `pageSize`。

还有一个很能说明注册表必要性的现象：长期规范推荐页面边距使用 `data-id-margin`，但当前 `html-writer.js` 写的是 `data-id-margins`。这类漂移正是字段注册表要解决的问题，但也说明第一阶段不能先删静态字段表，必须先把现有路径全部登记、对齐、报告。

---

### 中高：capability matrix 的枚举值方向正确，但不足以表达读/写/持久化的差异

`native`、`lossless`、`approximate`、`fallback`、`observe-only`、`unsupported` 这组词是有用的。它比现有 CSS 支持表多了 `lossless` 和 `observe-only`，能覆盖更多风险状态。

问题是当前 spec 把这些词放在单个矩阵格里，但真实转换至少有三个方向：

```text
read: 从格式读入 Semantic Model
write: 从 Semantic Model 写回格式
persist: 作为标签/自定义数据跨轮保存
```

例如 PDF 页码在 HTML 侧可通过 `data-id-pdf-page` 读写，在 InDesign instructions 中是 `placed.pageNumber`，但在 PPTX 里可能只能通过预览图 fallback 显示，同时通过 custom data 无损持久化原始 PDF 路径和页码。单个 `fallback` 或 `lossless` 无法同时描述“视觉 fallback，但元数据可 lossless round-trip”。当前代码已经体现了这种分离：资源字段读入在 `asset-detector.js`，写入 instructions 在 `to-instructions.js`，反向 HTML 写出在 `author-html-tree.js`。

建议矩阵保留这六个等级，但 registry 里改成：

```js
capabilities: {
  html: {
    read: 'native',
    write: 'native',
    persist: 'native'
  },
  indesign: {
    read: 'native',
    write: 'native',
    persist: 'native'
  },
  pptx: {
    read: 'unsupported',
    write: 'fallback',
    persist: 'lossless',
    fallbackKind: 'preview-image',
    risk: 'editable-loss'
  }
}
```

这样可以表达“PPTX 不能原生编辑 PDF，但可以保留原始资源路径、页码和预览生成关系”。

---

### 中：Adapter / Writer 边界略有重叠，未来 PPTX 加入时需要提前收紧

目标 spec 前面把架构画成 Adapter -> Semantic Model -> Writer，这是正确的。

但第 8.2 节又说 InDesign Adapter 负责“从 Semantic Model 生成 instructions”，这会让 Adapter 和 Writer 边界变模糊。

当前代码里，其实已经有更清晰的分工：`src/paged-html/browser-snapshot.js` 负责 HTML snapshot；`src/semantic-model/from-snapshot.js` 负责 snapshot -> model；`src/semantic-model/to-instructions.js` 负责 model -> instructions；`src/indesign-reverse/reverse-model.js` 负责 reverse snapshot -> model。

建议 spec 明确：

```text
Format Reader:
  format -> raw snapshot

Normalizer:
  raw snapshot -> Semantic Model

Format Writer:
  Semantic Model -> format-specific instructions/package/html

Executor:
  execute instructions/package in target host, no semantic inference
```

这样未来 PPTX 就不会演变成 `indesign-to-pptx.js`、`html-to-pptx.js`、`pptx-to-indesign.js` 这类两两转换器。

---

### 中：字段生命周期规则方向正确，但对 observation / retired / active canonical 应分层要求，否则容易过严

spec 要求新增字段登记 owner、能力等级、模型校验、至少一个方向测试，双向字段增加回环测试。这个对 active canonical 字段是合理的。

但 observation 字段和 retired 字段不应该套同一套测试规则。observation 字段的正确性不在于“能写回”，而在于“不能驱动结构化编译、必须报告来源和降级原因”。这与 `REVERSE_EXPORT.md` 里的 `effectiveLabel` / `observedLabel` 分离规则一致，也与当前 `label-whitelist.js` 的实现一致。

建议生命周期门禁改成：

```text
active canonical:
  必须有 schema/validator
  必须至少一个 read/write 方向
  重要字段必须 round-trip

sourceMetadata:
  必须证明不改变视觉编译
  必须 round-trip source package 或 label carrier

formatExtension:
  必须声明 owner format
  必须声明 canonical 升级条件和 fallback

observation:
  必须进入 report
  不得进入 structured compilation
  不要求写回

retired:
  必须有 old path、replacement、readPolicy、writePolicy
  readPolicy 最多 observe-only
  writePolicy 必须 forbidden
```

---

### 中：迁移顺序总体正确，但阶段 2 直接“禁止未知字段”有大爆炸风险

spec 的迁移策略写了“渐进迁移，不一次性推翻现有链路”，这是对的。阶段 1 先建立注册表骨架、只警告，也很合理。

风险在阶段 2：HTML normalizer、InDesign reverse normalizer、HTML writer 和 instruction writer 全部禁止写未知字段。当前代码里的字段还散在 snapshot、style compiler、asset detector、semantic model、label helper、reverse writer 里，且 `validateSemanticModel` 目前只校验模型类型、页面、标签、重复 ID，没有字段注册表级校验。

建议把阶段 2 拆成三步：

```text
阶段 2a：只对新增字段 error，对历史未知字段 warning
阶段 2b：按字段域逐个转 error，例如先 asset.placement，再 sourceNode，再 visualStyle
阶段 2c：writer 禁止未知字段，但 report/unresolved/observation 命名空间允许独立存在
```

模块拆分不应成为字段注册表生效的前置条件。阶段 3 的大模块拆分可以保留，但要写成“行为稳定后再拆”，而不是“接入注册表必须先拆”。

---

### 低：现有文档引用总体准确，但 `AGENTS.md` 可再避免“已设计 = 已实现”的误读

`docs/README.md` 和 `docs/规范/README.md` 已经清楚说明：`superpowers/specs/` 是方案设计，不自动等同长期规范；注册表实现前，长期规范里的静态字段表仍是当前行为事实源。

`AGENTS.md` 把目标 spec 称为“已批准设计”，同时也说明注册表实现前不得删除静态字段表。这个表达基本没错，但建议改成更硬的句子：

```text
该 spec 是已批准架构设计，不代表当前实现行为。
注册表实现并接入校验前，静态字段表仍是事实源。
```

这样能避免后续实现者误以为 `src/protocol/` 已经存在，或者误删 `HTML_INDESIGN_LIBRARY_SPEC.md`、`SEMANTIC_PROTOCOL.md`、`LABEL_PROTOCOL.md`、`REVERSE_EXPORT.md` 里的字段表。

---

## 修订后的 spec 大纲

下面是一版我建议替换/补充到目标 spec 的结构。不是推翻原 spec，而是把原 spec 的核心收紧成可实施版本。

```md
# 协议字段注册表、多格式能力矩阵与 PPTX 适配边界

## 0. 状态

本文件是已批准架构设计，不代表当前实现事实。

注册表实现前：
- `HTML_INDESIGN_LIBRARY_SPEC.md`
- `SEMANTIC_PROTOCOL.md`
- `LABEL_PROTOCOL.md`
- `REVERSE_EXPORT.md`
- 当前代码和可复现实测

仍是字段行为事实源。

注册表实现并接入校验后，重复字段表迁移为注册表生成文档。

## 1. 目标

目标是防止 HTML / InDesign / PPTX 形成两两互转网络。

唯一允许的数据中枢是 Semantic Model。

```text
HTML Reader -> HTML Normalizer -> Semantic Model -> HTML Writer
InDesign Reader -> InDesign Normalizer -> Semantic Model -> InDesign Instruction Writer
PPTX Reader -> PPTX Normalizer -> Semantic Model -> PPTX Writer
```

禁止：

```text
HTML -> InDesign 专用字段旁路
InDesign -> PPTX 专用转换器
PPTX -> HTML 专用转换器
```

## 2. 非目标

本轮不实现完整 PPTX。  
本轮不删除静态字段表。  
本轮不强制移动所有现有模块。  
本轮不把本项目扩展成通用 Office 文档模型。  
本轮不要求所有字段三格式无损。

## 3. 分层边界

### 3.1 Reader

读取格式原始事实。

HTML Reader:

- 浏览器 layout snapshot。

- DOM attributes。

- computed/authored style。

- resource source。

- source package metadata。

InDesign Reader:

- InDesign snapshot。

- `html_indesign` 标签。

- 原生页面、母版、图层、样式、对象、资源、路径、表格。

- 未标注对象的 observation facts。

PPTX Reader:

- slide、layout、master。

- shape、text box、table、chart、media。

- custom data。

- animation / transition 作为 format extension。

### 3.2 Normalizer

把 raw snapshot 转成 Semantic Model。  
不得发明未登记字段。  
不得把 observation 直接提升为 canonical。

### 3.3 Writer

从 Semantic Model 写出目标格式。  
不得写未登记字段。  
不得静默 fallback。  
不得把 format extension 写成 canonical 字段。

### 3.4 Executor

执行格式命令。  
不做 HTML 解析。  
不做 CSS cascade。  
不做复杂语义推断。  
不做字段迁移。

## 4. 字段注册表

每个字段必须有一个注册项。

```js
{
  canonicalPath: 'items[].asset.placement.pageNumber',

  currentPaths: [
    'items[].asset.pageNumber',
    'items[].asset.placement.pageNumber',
    'instructions.pages[].items[].placed.pageNumber'
  ],

  fieldClass: 'canonical',
  lifecycle: 'active',

  owner: 'asset-placement',

  type: 'integer',
  unit: null,
  required: false,

  html: {
    readAttrs: ['data-id-pdf-page'],
    writeAttrs: ['data-id-pdf-page'],
    retiredAttrs: [
      {
        name: 'data-id-page',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'ambiguous-with-page-identity'
      }
    ]
  },

  indesign: {
    snapshotPaths: ['placedAsset.placement.pageNumber'],
    labelPaths: ['asset.pageNumber'],
    instructionPaths: ['placed.pageNumber']
  },

  pptx: {
    packagePaths: [],
    customDataPaths: ['htmlIndesign.items[].asset.placement.pageNumber']
  },

  capabilities: {
    html: {
      read: 'native',
      write: 'native',
      persist: 'native'
    },
    indesign: {
      read: 'native',
      write: 'native',
      persist: 'native'
    },
    pptx: {
      read: 'unsupported',
      write: 'fallback',
      persist: 'lossless',
      fallbackKind: 'preview-image',
      risk: 'editable-loss'
    }
  },

  validation: {
    min: 1,
    integer: true
  },

  tests: {
    read: ['asset-detector.test.js'],
    write: ['instructions-compiler.test.js'],
    roundtrip: ['reverse-author-roundtrip.test.js']
  }
}
```

## 5. 字段分类

### 5.1 canonical

通用分页文档事实。

判断标准：

- 至少两个格式能稳定理解，或它是格式无关文档语义。

- 字段名不绑定某个格式术语。

- 有降级策略。

- 有测试覆盖。

示例：

- document id/title/profile/unit。

- pages。

- parentPages。

- styles。

- layers。

- assets。

- items。

- bounds。

- text content。

- table。

- visualStyle。

- vectorGeometry。

- asset placement。

### 5.2 sourceMetadata

来源追踪字段。

用途：

- 恢复 author source package。

- 恢复 DOM tag/class/attributes。

- 恢复 source file。

- 解释 round-trip 来源。

限制：

- 不得驱动视觉编译。

- 不得替代 canonical 字段。

- 不得被 PPTX 或 InDesign writer 当作格式事实。

示例：

- sourcePackage。

- sourceFile。

- sourceNode。

- sourceAncestorNodes。

- sourceText。

- sourceHtml。

- sourceRuns。

- structure。

### 5.3 formatExtension

格式专有能力。

路径必须在：

```text
extensions.<format>.*
```

示例：

- extensions.indesign.pdfPlacePreference

- extensions.indesign.grepStylesRaw

- extensions.pptx.animation

- extensions.pptx.transition

- extensions.pptx.placeholder

- extensions.pptx.speakerNotes

升级为 canonical 的条件：

- 至少两个格式稳定表达，或它已成为通用文档语义。

- 有格式无关命名。

- 有 fallback 策略。

- 有测试覆盖。

### 5.4 observation

观察字段。

用途：

- 未通过白名单的标签。

- 旧模板残留。

- 无法确定语义的样式或对象。

- 外部文档导入线索。

限制：

- 不得进入 structured compilation。

- 不得写成 canonical label。

- 必须进入 report。

- 必须保留来源和降级原因。

### 5.5 retired

退役字段不是字段类别，而是 lifecycle。

退役字段必须登记旧路径、替代路径、读策略、写策略。

```js
{
  canonicalPath: 'items[].asset.placement.pageNumber',
  retiredPath: 'html.data-id-page',
  lifecycle: 'retired',
  replacedBy: 'html.data-id-pdf-page',
  readPolicy: 'observe-only',
  writePolicy: 'forbidden'
}
```

## 6. 能力矩阵

能力等级：

```text
native        原生可表达、可编辑。
lossless      不一定原生，但可无损保存并回读。
approximate   可近似表达，有视觉或编辑差异。
fallback      通过图片、SVG、栅格、预览等降级表达。
observe-only  只可读取为观察线索，不可驱动编译。
unsupported   不支持，必须报告，不能静默丢弃。
```

每个字段必须分别声明：

```text
read
write
persist
fallbackKind
risk
```

示例：

| 字段             | HTML read/write         | InDesign read/write     | PPTX read/write      | PPTX persist        |
| -------------- | ----------------------- | ----------------------- | -------------------- | ------------------- |
| text runs      | native/native           | native/native           | native/native        | native              |
| PDF pageNumber | native/native           | native/native           | unsupported/fallback | lossless customData |
| blendMode      | native/approximate      | native/native           | approximate/fallback | lossless customData |
| pptx animation | unsupported/unsupported | unsupported/unsupported | native/native        | native              |

## 7. 标签和 metadata carrier

字段注册表不绑定单一载体。

HTML 载体：

- `data-id-*`

- author source package

- generated report

InDesign 载体：

- `html_indesign`

- style/layer/page/item labels

- reverse snapshot

- instructions

PPTX 未来载体：

- custom XML 或等价 custom data

- shape tags

- slide-level metadata

- package relationship metadata

具体 PPTX 机制可以后置，但 registry 必须先表达：

- 是否可持久化。

- 是否可回读。

- 是否可被 writer 消费。

- 是否只用于 observation。

## 8. 生命周期门禁

### 8.1 新 active canonical 字段

必须：

1. 注册字段。

2. 指定 owner。

3. 指定 read/write/persist 能力。

4. 增加模型校验。

5. 增加至少一个方向测试。

6. 重要字段增加 round-trip 测试。

7. 更新生成文档或对应规范。

### 8.2 sourceMetadata 字段

必须：

1. 证明不改变视觉编译。

2. 证明 writer 不把它当作 canonical。

3. 有 source round-trip 或 author package 测试。

### 8.3 formatExtension 字段

必须：

1. 指定 owner format。

2. 指定升级 canonical 的条件。

3. 指定跨格式 fallback。

4. 不能污染 canonical namespace。

### 8.4 observation 字段

必须：

1. 进入 report。

2. 不能进入 structured writer。

3. 不能作为编译兜底。

4. 有降级原因。

### 8.5 retired 字段

必须：

1. 保留读取识别。

2. 只能 observe-only。

3. 禁止写出。

4. 禁止进入新样例。

5. 禁止作为读取兜底。

6. 有迁移报告。

## 9. 迁移计划

### 阶段 0：冻结现有事实源

不改行为。  
列出当前字段来源：

- static docs。

- snapshot 字段。

- semantic model 字段。

- instructions 字段。

- label 字段。

- reverse model 字段。

- HTML data-id 字段。

### 阶段 1：注册表骨架

新增 `src/protocol/`。  
先登记当前已经存在的字段。  
允许 currentPaths / aliases。  
扫描只 warning。

优先域：

- document/page。

- styleRefs。

- sourceNode/sourcePackage。

- asset.placement。

- visualStyle。

- vectorGeometry。

- labels。

- observation/effectiveLabel。

### 阶段 2：新增字段门禁

新增字段未注册则 error。  
历史字段未注册仍 warning。  
每个 warning 必须有 owner 和计划。

### 阶段 3：按域转强校验

逐域启用 error：

1. asset.placement。

2. source metadata。

3. styleRefs。

4. labels。

5. visualStyle/vectorGeometry。

6. table/text。

### 阶段 4：退役字段集中清理

先登记 retired。  
再移除写出。  
最后移除读取兜底。  
旧输入只能 observation/report。

### 阶段 5：生成文档

字段清单从 registry 生成。  
规范文档只保留原则、边界和重要示例。  
静态字段表不再手写多份。

### 阶段 6：PPTX 预留接口

不实现完整 PPTX。  
只定义：

- PptxReader contract。

- PptxWriter contract。

- slide/page/master/layout 映射。

- PPTX custom data carrier。

- fallback 资源策略。

- capability matrix entries。

## 10. 成功标准

成功标准：

- 新字段只需在一个 registry 入口登记。

- HTML/InDesign/PPTX 能力差异可查询。

- writer 不能发明字段。

- observation 不能污染 canonical。

- retired 字段不能静默复活。

- 静态字段表最终可以由 registry 生成。

- 新格式只增加 adapter/writer，不增加两两转换器。

```
---

## 哪些地方不要过度设计

第一，不要现在实现完整 PPTX。目标 spec 只需要把 PPTX 放进能力矩阵和 carrier 抽象里；PPTX writer/reader 的具体包结构可以后置。目标 spec 自己也把“不在本轮实现完整 PPTX”列为非目标，这是正确的。:contentReference[oaicite:56]{index=56}

第二，不要一开始就做完整 JSON Schema 生成、文档生成、AST 扫描全覆盖。第一阶段用 CommonJS 对象注册表 + 小型 validator + warning-only 扫描就够了。spec 里的 `validate-model-fields.js`、`validate-data-id-fields.js` 可以保留，但不要让它们第一天就阻塞所有历史字段。:contentReference[oaicite:57]{index=57}

第三，不要为了“架构干净”立即移动 `src/paged-html/`、`src/semantic-model/`、`src/indesign-reverse/`。当前代码已经有可用的 Semantic Model 层和 reverse whitelist 层，先让 registry 约束这些模块，比大规模搬家更安全。:contentReference[oaicite:58]{index=58} :contentReference[oaicite:59]{index=59}

第四，不要把 PPTX 动画、切换、备注等过早升级成 canonical。目标 spec 把它们放进 `extensions.pptx.*` 是合理的；只有图表这类确实可能跨 HTML/InDesign/PPTX 表达的对象，才适合以后评估为 canonical。:contentReference[oaicite:60]{index=60} :contentReference[oaicite:61]{index=61}

第五，不要删除现有静态字段表。现在还没有 `src/protocol/` 实现，长期规范也明确注册表实现前静态字段表仍是事实源。删早了会丢掉当前代码行为边界，尤其是 `data-id-pdf-page`、`asset.pageNumber`、`sourceNode`、`effectiveLabel` / `observedLabel` 这些已经落到代码里的字段。:contentReference[oaicite:62]{index=62} :contentReference[oaicite:63]{index=63} :contentReference[oaicite:64]{index=64}

---

## 最终判断

这份 spec **适合这个项目的长期方向**。它能有效防止 HTML/InDesign/PPTX 之间两两互转失控，尤其是它坚持 Semantic Model 中心、字段注册表、能力矩阵、观察字段、退役字段和 adapter 边界。

但实施前建议先做四个修订：

1. 把字段分类改成“fieldClass + lifecycle”两轴。
2. 把字段路径改成“当前事实路径 + canonicalPath + alias/retired path”，不要直接重命名当前行为。
3. 把 capability matrix 改成 read/write/persist 三方向。
4. 把迁移阶段 2 拆成 warning -> new-field error -> per-domain error，避免一次性阻塞现有链路。

做完这四点后，可以采纳为本项目多格式协议层的主设计。
```
