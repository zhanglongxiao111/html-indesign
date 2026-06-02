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
    writeAttrs: ['data-id-pdf-page']
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
  canonicalPath: 'retired.htmlAttrs.dataIdPage',
  currentPaths: [],
  fieldClass: 'observation',
  lifecycle: 'retired',
  owner: 'asset-placement',
  type: 'attribute',
  retired: {
    htmlAttrs: [{
      name: 'data-id-page',
      replacedBy: 'data-id-pdf-page',
      readPolicy: 'observe-only',
      writePolicy: 'forbidden',
      reason: 'ambiguous-with-page-identity'
    }]
  }
}
```

退役 HTML 属性只能通过独立 retired surface 查询，例如
`fieldRegistry.getRetiredHtmlAttr('data-id-page')`。`getByHtmlAttr()`
只返回 current HTML 属性，不能把 `data-id-page` 映射回 PDF 页码字段。

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

