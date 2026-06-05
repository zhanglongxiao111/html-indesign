# 自动合成样式归一化设计

## 0. 状态

本文件是设计草案，用于下一阶段计划和实现评审。

它不代表当前实现事实。当前行为仍以代码、测试、真实 InDesign E2E 和审计报告为准。

## 1. 背景

人工 InDesign 文件里经常存在大量视觉设置完全一致、但没有绑定同一个 InDesign 样式的对象。常见例子包括：

- 同字体、字号、颜色、行距和对齐方式的文本框。
- 同线宽、颜色、线型、箭头和端点的流线。
- 同描边、填充、圆角、透明度和混合模式的图框或形状。
- 同 PDF / 图片框样式，但每个对象仍有独立置入内容几何。

如果反向导出后逐对象携带所有局部属性，规范化 InDesign 会变得难维护，回环 diff 也会被大量重复属性放大。

下一阶段需要新增一个低层级格式保真机制：把相同原子视觉设置归一成可读中文样式，让人类用户能在 InDesign 面板中理解和复用，同时保留机器可追踪的稳定 token。

## 2. 目标

- 把人工 ID 中完全相同的字体、段落、对象、线条、箭头、效果等原子视觉设置合并为样式。
- InDesign 面板显示名必须是中文，面向人类可读。
- 协议 token 必须稳定，面向 Agent 和回环可追踪。
- 样式合成只能服务于保真和可编辑性，不得伪造页面语义。
- 局部 override 必须显式保留，不得被合成样式吞掉。
- 支撑下一阶段真实 P1 清零，尤其是线型、箭头、混合模式、透明度、描边、填充和文本样式差异。

## 3. 非目标

- 不通过样式合成判断“标题 / 图注 / 流线 / 正文”等白名单语义。
- 不把相似但不完全相同的对象强行合并为同一样式。
- 不为了降低 diff 隐藏真实视觉差异。
- 不把样式合成做成 HTML 专用字段或 InDesign 专用旁路。
- 不要求第一轮就覆盖所有 InDesign 高级效果，但未覆盖字段必须可见、可测、可报告。

## 4. 架构位置

样式合成层位于格式事实归一化链路中，低于语义重建层，高于具体 writer。

```text
InDesign snapshot
  -> InDesign Adapter
  -> Style Atom Extractor / Synthesized Style Registry
  -> DocumentModel.styles + item.styleRefs + item.overrides
  -> HTML Writer
  -> HTML Adapter
  -> InDesign Writer
  -> InDesign Executor
  -> normalized InDesign
```

边界：

- InDesign Adapter 负责读取原始对象事实和原始面板样式名。
- Style Atom Extractor 负责提取可比较的原子视觉属性。
- Synthesized Style Registry 负责按 fingerprint 合并完全相同的原子设置，并生成 token / 中文 displayName。
- DocumentModel 负责携带样式定义、对象引用和局部 override。
- HTML Writer / HTML Adapter 负责让作者包可承载这些样式引用和必要 override。
- InDesign Writer / Executor 负责生成和应用原生 InDesign 样式。

语义重建层只使用样式作为观察证据之一，不得把合成样式直接当作语义事实。

## 5. 样式类型

第一阶段支持以下合成样式类型：

| 类型 | 用途 | InDesign 对应 |
| ---- | ---- | ---- |
| `synth-paragraph-style` | 段落级文字排版 | paragraph style |
| `synth-character-style` | 字体、字号、字色等字符事实 | character style |
| `synth-object-style` | 图框、形状、文本框通用对象外观 | object style |
| `synth-line-style` | 线条、箭头、端点、线型 | object style + line attributes |
| `synth-effect-style` | 透明度、混合模式等效果 | object style extension |
| `synth-placement-style` | 图像 / PDF 框样式，不含具体资源身份 | object style + placement defaults |

`synth-placement-style` 只描述框和默认置入策略；具体 `assetPath`、PDF 页码、crop、content offset、content scale 仍属于对象事实或 placement override。

## 6. Fingerprint 规则

Fingerprint 必须基于 canonical 属性，而不是面板显示名。

### 6.1 字符样式 fingerprint

参与字段：

- font family / font style。
- font size。
- fill color / fill tint / fill opacity。
- tracking / horizontal scale / vertical scale。
- baseline shift。
- underline / strikethrough。

### 6.2 段落样式 fingerprint

参与字段：

- paragraph composer。
- justification / alignment。
- leading。
- first line indent / left indent / right indent。
- space before / space after。
- hyphenation。
- bullet / numbering 的可执行事实。

### 6.3 对象样式 fingerprint

参与字段：

- fill color / fill tint / fill opacity。
- stroke color / stroke tint / stroke weight / stroke opacity。
- stroke style。
- stroke alignment。
- corner radius。
- object opacity。
- blend mode。
- text inset / frame fitting policy 等对象级事实。

### 6.4 线条样式 fingerprint

参与字段：

- stroke color。
- stroke weight。
- stroke style / dash pattern。
- line cap / line join / miter limit。
- start marker / end marker。
- marker scale 或可读取的 marker 细节。
- line opacity / blend mode。

### 6.5 置入样式 fingerprint

参与字段：

- frame stroke / fill / corner / opacity。
- fitting mode。
- content crop kind。
- PDF visible layer policy。

不参与字段：

- asset path。
- PDF page number。
- content scale。
- content offset。
- frame bounds。

这些字段属于具体对象实例，不能被合成样式吞掉。

## 7. 原始样式优先级

如果原始 InDesign 对象已经绑定了有效样式，应按以下规则处理：

1. 原始样式名为中文且样式定义完整可回读时，优先沿用原始样式。
2. 原始样式名缺失、为默认样式、或样式定义无法覆盖对象实际属性时，生成自动合成样式。
3. 原始样式名存在但对象有局部 override 时，保留原始样式引用，并把 override 显式写入对象事实。
4. 多个不同原始样式名但 canonical 属性完全相同时，不强制合并原始样式；可以生成审计建议，但不得破坏用户已有面板组织。
5. 自动合成样式不得覆盖或重命名用户已有样式。

## 8. 中文命名规则

面板显示名必须中文，稳定、可读、可区分。

格式：

```text
自动<类型>-<主要属性1>-<主要属性2>-<主要属性3>-<序号>
```

示例：

| 类型 | displayName 示例 | token 示例 |
| ---- | ---------------- | ---------- |
| 段落样式 | `自动段落-18点-左对齐-黑色-01` | `auto-paragraph-18pt-left-black-001` |
| 字符样式 | `自动字符-宋体-12点-灰色-01` | `auto-character-songti-12pt-gray-001` |
| 对象样式 | `自动对象-白底-灰描边-圆角-01` | `auto-object-white-fill-gray-stroke-radius-001` |
| 线条样式 | `自动线条-橙色-5点-竖线-01` | `auto-line-orange-5pt-vertical-001` |
| 箭头线样式 | `自动箭头-黑色-2点-终点箭头-01` | `auto-arrow-black-2pt-end-arrow-001` |
| PDF 框样式 | `自动PDF框-无描边-保留裁切-01` | `auto-pdf-frame-no-stroke-preserve-crop-001` |
| 效果样式 | `自动效果-正片叠底-68透明-01` | `auto-effect-multiply-68-opacity-001` |

命名约束：

- displayName 只描述外观事实，不写语义词。
- 不使用英文面板名。
- 序号基于同类型同主属性集合稳定分配。
- token 只能由稳定 ASCII 组成。
- displayName 与 token 必须同时写入模型和协议字段。

## 9. 样式与 Override 边界

对象最终属性由三部分组成：

```text
effectiveStyle = referencedStyle + explicitOverride + formatExtension
```

规则：

- 合成样式只承载完全相同的公共属性。
- 对象实例差异必须留在 `overrides` 或对应 placement/vector/text facts 中。
- 如果两个对象只有一个字段不同，不能装作同一个完整样式；要么生成两个样式，要么共享基础样式并保留显式 override。
- 写回 InDesign 时必须先应用样式，再应用 override。
- 反向 snapshot 再读回时，审计必须能验证 style + override 的合成结果等于原始对象事实。

## 10. 协议字段

新增字段必须进入 `src/protocol/` 注册表，再生成 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`。

建议字段：

- `styles.synthesized[].token`
- `styles.synthesized[].displayName`
- `styles.synthesized[].kind`
- `styles.synthesized[].fingerprint`
- `styles.synthesized[].source`
- `styles.synthesized[].properties`
- `items[].styleRefs.synthesizedToken`
- `items[].styleRefs.synthesizedName`
- `items[].styleOverrides`

字段含义：

- `token` 是机器稳定事实。
- `displayName` 是中文面板名。
- `fingerprint` 是合并依据。
- `source` 区分 `original-style`、`auto-synthesized`、`original-style-with-overrides`。
- `styleOverrides` 只放样式未覆盖或局部不同的字段。

## 11. HTML 作者包承载

作者包需要同时服务人类编辑和回环稳定。

要求：

- `deck.config.json` 写入合成样式定义。
- 页面 HTML 对象写入稳定 `data-id-style-token` 或同等字段。
- 中文 displayName 可以写入 `data-id-style-name` 或配置表，不要求页面重复长文本。
- 局部 override 必须以结构化 data-id 字段或 source metadata 保留。
- CSS 可以用于浏览器视觉预览，但不能成为唯一事实源。

禁止：

- 只把样式写进 CSS class 名，不写协议字段。
- 用英文 class 名直接作为 InDesign 面板名。
- 为了浏览器预览把 InDesign 原生效果静默降级。

## 12. InDesign 写回

写回顺序：

1. 创建或复用中文 displayName 对应的 InDesign 原生样式。
2. 写入 `html_indesign` 标签，绑定 token / displayName / fingerprint。
3. 创建对象。
4. 应用样式。
5. 应用对象 override。
6. 应用资源置入实例事实。
7. 写入对象级 `html_indesign` 标签，保留 styleRefs 和 overrides。

失败策略：

- 样式创建失败必须报告。
- 样式字段不支持必须报告。
- 不得静默输出“看似成功”的降级对象。

## 13. 审计与验收

本设计服务于下一阶段“真实 P1 清零”目标。

验收门槛：

| 指标 | 目标 |
| ---- | ---- |
| `p0.count` | `0` |
| `p1.count` | `0` |
| 二轮结构稳定 errors | `0` |
| `REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED` | `0` |
| `REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED` | `0` |
| `REVERSE_SNAPSHOT_VECTOR_GEOMETRY_CHANGED` | `0` |
| `REVERSE_SNAPSHOT_ITEM_MISSING / EXTRA` | `0`，或被严格证明为等价并从 P1 分类中移除 |

样式合成专项审计：

- 同 fingerprint 只能生成一个自动样式。
- 自动样式 displayName 必须为中文。
- 自动样式 token 必须稳定。
- 对象 styleRefs 不得指向不存在的样式。
- style + override 的 effective result 必须等于原始对象事实。

## 14. 风险

- 过度合并会把真实差异吞掉。
- 中文命名如果不稳定，会造成二轮回环漂移。
- CSS class、InDesign 样式名、协议 token 三者若混用，会重新形成隐性双路径。
- 原始人工样式和自动合成样式的优先级不清，会让人类用户面板变乱。

缓解：

- fingerprint 只用 canonical 属性。
- displayName 和 token 分离。
- styleRefs 和 overrides 均进入协议字段注册表。
- 每类样式都用审计测试覆盖。

## 15. 推荐实施切分

后续 plan 应按以下顺序拆：

1. 协议字段和模型结构。
2. InDesign reverse 样式原子提取。
3. 合成样式 registry 与中文命名。
4. HTML 作者包承载和回读。
5. InDesign writer / executor 原生样式写回。
6. 样式合成专项审计。
7. 真实人工 ID E2E 与 P1 指标收口。
