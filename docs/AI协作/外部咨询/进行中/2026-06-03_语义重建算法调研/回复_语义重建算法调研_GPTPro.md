# 回复：语义重建算法调研 - GPT Pro

## 来源

- 来源：GPT Pro
- 日期：2026-06-03
- 主题：从 InDesign / 固定分页文档对象快照中重建可编辑语义 HTML 的算法参考

## 原始回复

# 从 InDesign / 固定分页对象快照重建可编辑语义 HTML：参考项目、论文与算法报告

## 0. 结论先行

你们的输入已经是 **对象级 Observed Document Model**，不是截图/OCR，因此第一轮不应从“图像版面检测”开始，而应从 **对象关系图 + 视觉分组 + 阅读顺序 + 页面模板/组件识别** 开始。

最值得第一轮参考的是：

| 优先级 | 建议参考                                                 | 为什么优先                                                 |
| --- | ---------------------------------------------------- | ----------------------------------------------------- |
| P0  | REIP / Reverse-Engineering Information Presentations | 输入就是 PPT 风格 visual elements，输出层次分组，最接近“固定分页汇报文档对象快照”。 |
| P0  | Object-Level PDF Document Analysis                   | 明确从 PDF 对象流而非 raster/OCR 做对象级版面理解，方法论非常贴近你们已有快照。      |
| P0  | VIPS                                                 | 可借鉴“视觉块层级 + 分隔符 + Degree of Coherence”的可解释分组框架。       |
| P0  | PdfPig / pdfminer.six / XY-Cut / Docstrum 类算法        | 适合实现第一版可解释 reading order、文本块合并、列/网格/空白分割。             |
| P0  | ReadingBank / LayoutReader / XY-Cut++                | 专门处理 reading order，可用来设计阅读顺序证据与评测。                    |
| P1  | Slide Gestalt                                        | 适合跨页层级、重复元素、deck-level structure、母版/章节识别。             |
| P1  | LayoutParser + DocLayNet                             | 适合做可视化标注、评测、可选 ML 分类器，但不要直接作为核心。                      |
| P1  | Docling / GROBID / Unstructured / Marker             | 适合学习工程架构、统一中间表示、导出、调试、评测，不建议直接套用语义结果。                 |
| P2  | LayoutLM / LayoutLMv3 / Doc2Graph / GNN              | 可作为辅助角色分类或关系打分，不建议作为不可解释兜底。                           |
| P2  | SlideCraft / SciPostLayout                           | 适合构造训练/评测数据和页面类型 benchmark，不是直接重建算法。                  |

---

## 1. 推荐的 12 个参考项目、论文或算法方向

### 1. REIP：Reverse-Engineering Information Presentations

**链接**：REIP GitHub 与论文页面。该项目的数据集中包含 23,072 个 information presentations 和 620,878 个 visual elements，并从 PowerPoint 中解析出对象类型、z-index、bbox、尺寸、旋转、对齐等空间特征；论文方法是用 Transformer-based model 预测元素之间的 relatedness，再用 bottom-up algorithm 生成层次分组。([GitHub](https://github.com/sdq/reip "https://github.com/sdq/reip"))

**输入**
PowerPoint / presentation 页面中的 visual elements，例如 text、picture、line、chart、table、shape，以及 bbox、z-order、alignment、rotation 等对象级特征。

**输出**
页面内 visual elements 的 hierarchical grouping，也就是类似“图文组 / 卡片组 / 图表组 / 大区块 / 子区块”的分组树。

**核心方法**
先对元素两两或局部上下文建模，预测元素之间是否相关，再自底向上合并成层级结构。论文强调 presentation 中的元素通常存在空间和语义上的层次分组，而这种分组常常没有显式标注。([Springer](https://link.springer.com/article/10.1007/s44267-023-00010-1 "https://link.springer.com/article/10.1007/s44267-023-00010-1"))

**适合借鉴的部分**
这是与你们场景最接近的参考之一。你们的 InDesign snapshot 与 REIP 的 PPT 元素输入非常相似，都有对象、bbox、z-order、类型、文本和图像。建议重点借鉴：

- 把页面表示为 **visual element graph**。

- 每个边记录 proximity、alignment、containment、style similarity、semantic similarity、z-order relation。

- 先恢复 **hierarchical grouping**，再做语义角色识别。

- 对 architectural report / PPT-style 页面，优先识别“组”而不是直接预测 HTML 标签。

**不适合直接套用的原因**
REIP 主要解决“层次分组”，不直接输出你们白名单 Author Model，也不识别建筑汇报中的“图纸 / 效果图 / 材料板 / 指标卡 / 对比页 / 时间轴”等业务语义。它还使用 Transformer，直接套用会带来可解释性和训练数据问题。更合理的方式是：用 REIP 的数据建模和层次分组思想，第一版先用规则/图算法实现，再逐步引入可解释的学习型 edge scorer。

---

### 2. Slide Gestalt：Presentation Deck Hierarchy / Inter-slide Structure

**链接**：Slide Gestalt 项目页。该工作提出自动识别 slide deck 层级结构的方法，利用 slide 间视觉和文本对应关系生成 hierarchical groupings，并在真实 slide decks 上测试。([Irfan Essa](https://www.irfanessa.gatech.edu/slide-gestalt-automatic-structure-extraction-in-slide-decks-for-non-visual-access/ "https://www.irfanessa.gatech.edu/slide-gestalt-automatic-structure-extraction-in-slide-decks-for-non-visual-access/"))

**输入**
一组 slide 页面，每页包含视觉布局、文本内容和页面之间的相似性信息。

**输出**
slide deck 的层级结构，例如页面之间的章节、主题、重复模式、导航关系。

**核心方法**
比较页面之间的视觉相似性和文本相似性，找出 slide-to-slide correspondence，然后生成 deck-level hierarchy。

**适合借鉴的部分**
你们不仅要恢复单页 HTML，还要识别母版、重复页脚、章节页、相似版式、页面类型。Slide Gestalt 很适合借鉴跨页层面：

- 重复 header/footer/page number/logo 的检测。

- 母版元素与正文元素分离。

- 页面类型聚类：封面、目录、章节页、图文页、对比页、图纸页、指标页。

- 建筑汇报中常见的“同一版式多页复用”识别。

**不适合直接套用的原因**
Slide Gestalt 更偏 deck navigation 和 slide hierarchy，不是页面内对象到 HTML author semantics 的恢复。它不会替你解决单页内部的图文组、标题/正文/图注、图片矩阵、指标卡等细粒度语义。

---

### 3. Object-Level Document Analysis of PDF Files

**链接**：TU Wien 的 Object-Level Document Analysis 项目。该论文强调不把 PDF 栅格化，而是直接从 PDF content stream 提取 text/graphic objects，再用 bottom-up segmentation 形成 line、paragraph 和更高层 logical structures，可用于 HTML conversion 与 data extraction。([Repositum](https://repositum.tuwien.at/handle/20.500.12708/52784 "https://repositum.tuwien.at/handle/20.500.12708/52784"))

**输入**
PDF 中直接解析出的 object-level textual / graphical content，包括文字对象、图形对象、位置和视觉属性。

**输出**
文本行、段落、逻辑块、阅读顺序、结构化 document model。

**核心方法**
从对象级 PDF 数据开始，基于视觉感知规则进行 bottom-up segmentation：字符到词、词到行、行到段落、段落到逻辑区块。

**适合借鉴的部分**
这与“从 InDesign reverse snapshot 出发”高度一致，因为你们已经有比 PDF 解析更强的对象信息。可借鉴：

- 不走 OCR，不走像素重建。

- 把对象直接作为 primitive。

- 用 bottom-up 视觉聚合恢复逻辑结构。

- 输出结构时保留坐标、证据和不确定项。

**不适合直接套用的原因**
该方向主要面向 PDF 对象分析，不包含 InDesign 的母版、图层、样式名、标签、资源链接等额外信息，也没有建筑汇报/PPT 风格组件识别。你们应该把它作为“对象级重建方法论”，不是作为最终语义模型。

---

### 4. VIPS：Vision-based Page Segmentation

**链接**：VIPS 论文。VIPS 从网页 DOM 和视觉呈现中抽取 semantic structure，把页面分为层级视觉块；每个 block 有 Degree of Coherence，算法包括 block extraction、separator detection 和 recursive content structure construction。([微软](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf "https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf"))

**输入**
原始 VIPS 输入是网页 DOM 和渲染后的视觉信息，包括块、位置、背景、边界、分隔线等。

**输出**
视觉块层级树，每个节点是一个 visual block，并带有 coherence / granularity 概念。

**核心方法**
自顶向下寻找 horizontal / vertical separators，把页面切成视觉区块；再递归处理每个区块，直到 Degree of Coherence 达到目标粒度。VIPS 的 PDoC / DoC 机制非常适合表达“分组到什么程度为止”。([微软](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf "https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-2003-79.pdf"))

**适合借鉴的部分**
非常适合作为你们的 **可解释分组层**：

- 用空白、线条、背景色块、对齐边界作为 separators。

- 用 Degree of Coherence 表达 group 是否足够稳定。

- 每个 semantic group 输出 evidence：分隔线、共同背景、共同网格、对齐、间距、z-order。

- 对建筑汇报中的图片矩阵、对比区块、卡片区块、时间轴区域很有用。

**不适合直接套用的原因**
VIPS 原始目标是网页 DOM segmentation，不是 InDesign 对象快照。网页 DOM 与固定分页对象模型差异很大，且原算法较老、规则偏网页。建议借鉴其“视觉块 + separator + coherence”的思想，而不是直接使用代码。

---

### 5. pdfminer.six / PdfPig：文本块合并、版面分析与 reading order 基础算法

**链接**：pdfminer.six 文档说明 PDF 通常只有字符及其位置，需要根据 bbox 重建词、行、文本框和层级结构；LAParams 提供 char_margin、word_margin、line_margin、boxes_flow 等参数。([pdfminer.six](https://pdfminersix.readthedocs.io/en/latest/topic/converting_pdf_to_text.html "https://pdfminersix.readthedocs.io/en/latest/topic/converting_pdf_to_text.html")) PdfPig 提供 Recursive XY Cut、Document Spectrum、Nearest Neighbour、Docstrum、whitespace cover 等 layout analysis 工具。([Ugly Toad](https://uglytoad.github.io/PdfPig/ "https://uglytoad.github.io/PdfPig/"))

**输入**
PDF 中的字符、词、文本对象、几何对象、bbox、page coordinate。

**输出**
词、文本行、文本框、文本块、阅读顺序、导出格式如 ALTO / PAGE / hOCR。

**核心方法**

- pdfminer.six：基于字符间距、行重叠、行距、文本框距离合并文本层级。

- PdfPig：提供 Nearest Neighbour、Docstrum、Recursive XY Cut、whitespace-based segmentation 等典型文档版面算法。

**适合借鉴的部分**
你们第一版可以直接实现类似策略：

- 字符/文本 run → 行 → 段落 → 文本块。

- 根据字号、baseline、line-height、style run 合并正文段落。

- XY-Cut / whitespace cover 找列、区块、图片矩阵、卡片网格。

- Nearest-neighbour / Docstrum 找局部文本块和阅读顺序。

- 把每一步参数化，并输出 evidence：距离、重叠比例、字号一致性、style 一致性。

**不适合直接套用的原因**
这些库主要为 PDF 文本抽取设计，不知道 InDesign 母版、图层、样式、标签、对象类型，也不会识别“指标卡 / 材料图 / 效果图 / 对比页”等业务语义。它们适合做底层几何和阅读顺序算法参考，而不是 Author Model 层。

---

### 6. ReadingBank / LayoutReader / XY-Cut++：阅读顺序恢复

**链接**：ReadingBank 提供约 500K document images 的 reading order 数据集，并用 Word XML metadata 转 PDF 后提取二维 bbox；LayoutReader 用 text + layout 做 reading order 建模。([GitHub](https://github.com/doc-analysis/ReadingBank "https://github.com/doc-analysis/ReadingBank")) XY-Cut++ 是对经典 XY-Cut 的增强，结合 shallow semantics 和 geometry，目标也是 reading order recovery。([arXiv](https://arxiv.org/html/2504.10258v1 "https://arxiv.org/html/2504.10258v1"))

**输入**
文本块、bbox、页面几何关系；部分方法还使用文本内容和浅层语义。

**输出**
页面元素或文本块的 reading order 序列。

**核心方法**
ReadingBank/LayoutReader 偏学习式 reading order；XY-Cut++ 则在 classic recursive XY-Cut 基础上引入语义与几何增强，处理复杂版面的阅读顺序。

**适合借鉴的部分**
你们的 HTML writer 需要生成可编辑源码，阅读顺序非常关键。建议借鉴：

- reading order 不直接等于 x/y 排序。

- 对标题、分栏正文、图注、图文组合、时间轴、对比页分别定义 order policy。

- 输出多个候选顺序及 confidence。

- 对歧义页输出 unresolved，例如“左右两列同权”“图注可属于上图或下图”。

**不适合直接套用的原因**
这些方法多面向论文、办公文档或通用页面，未必适合 PPT 风格页面。建筑汇报经常存在大图、图纸编号、装饰标题、非线性视觉叙事，单纯 reading order 模型可能会把视觉组件拆散。

---

### 7. LayoutParser + DocLayNet：布局检测、标注与评测工具链

**链接**：LayoutParser 是 Document Image Analysis 工具包，提供 layout data structures、model zoo、OCR、可视化、JSON/CSV/PDF 加载和导出能力。([GitHub](https://github.com/layout-parser/layout-parser "https://github.com/layout-parser/layout-parser")) DocLayNet 提供 80,863 页人工标注文档，包含 11 类 bbox 标签，并提供 COCO bbox、PDF 和带坐标/文本的 JSON。([GitHub](https://github.com/DS4SD/DocLayNet "https://github.com/DS4SD/DocLayNet"))

**输入**
通常是页面图像、PDF、OCR 结果或布局标注数据。

**输出**
带类别的 layout blocks，例如 title、text、table、figure、caption 等。

**核心方法**
LayoutParser 集成 Detectron2 / PaddleOCR / Tesseract 等模型和统一数据结构；DocLayNet 主要是高质量 layout detection 数据集和 benchmark。

**适合借鉴的部分**

- 作为你们的 annotation / evaluation baseline。

- 借鉴 DocLayNet 的类别设计、COCO-style bbox 标注、human review 流程。

- 用 LayoutParser 的 `TextBlock / Layout / Coordinates` 思路设计中间表示。

- 对少量页面截图做辅助检测，验证对象级规则是否漏掉视觉大块。

**不适合直接套用的原因**
这些项目核心是 image-based document layout detection，而你们已有对象级数据。直接跑图像模型会丢失 InDesign style、object ID、layer、master、z-order、asset link 等强信息，也不符合“可解释优先”的要求。它们更适合做辅助模型、评测工具和标注工具，而不是主流程。

---

### 8. LayoutLM / LayoutLMv3：文本 + bbox + 图像的多模态文档理解

**链接**：LayoutLM 使用 text、layout、format 和 image 信息进行 document understanding；官方说明其预训练模型用于 document understanding 和 information extraction。([GitHub](https://github.com/microsoft/unilm/blob/master/layoutlm/README.md "https://github.com/microsoft/unilm/blob/master/layoutlm/README.md"))

**输入**
文本 token、bbox、页面图像，有时还包括视觉 patch 或 OCR token。

**输出**
token classification、sequence labeling、document QA、form understanding、layout analysis 等任务结果。

**核心方法**
把 token 文本、二维位置和视觉特征一起编码，通过预训练模型学习文档结构。LayoutLMv3 进一步统一 text/image masking 和 word-patch alignment，用于通用 Document AI 任务。([arXiv](https://arxiv.org/abs/2204.08387 "https://arxiv.org/abs/2204.08387"))

**适合借鉴的部分**

- 用作辅助 role classifier：标题、正文、图注、表头、指标数字、日期、页码。

- 用于识别规则难以覆盖的 caption、callout、短标签、图纸编号。

- 可以只把模型输出作为 evidence source 之一，而不是最终裁决。

**不适合直接套用的原因**
LayoutLM 系列偏机器学习黑盒，需要领域标注数据；默认任务多是表单、收据、学术文档、信息抽取，不是 InDesign author model reconstruction。若直接依赖它兜底，难以满足“可解释、证据、置信度、unresolved”的工程要求。

---

### 9. Doc2Graph / GNN 文档结构理解方向

**链接**：Doc2Graph 是基于 GNN 的 task-agnostic document understanding 框架，目标覆盖 key-value relationship、layout analysis、table detection 等任务；其输出可包含实体连接关系和 JSON/dictionary。([GitHub](https://github.com/andreagemelli/doc2graph "https://github.com/andreagemelli/doc2graph"))

**输入**
文档元素节点，例如 OCR/text boxes、bbox、视觉区域、局部图像特征，以及节点之间的空间关系。

**输出**
节点分类、边分类、关系图、实体连接、布局类别、表格结构等。

**核心方法**
把文档对象建成 graph，用 GNN 学习节点和边的结构模式。论文/项目强调 GNN 可捕捉文档中的 structural patterns。([GitHub](https://github.com/andreagemelli/doc2graph "https://github.com/andreagemelli/doc2graph"))

**适合借鉴的部分**
你们本身就应该有一个 **Document Object Graph**：

- node = InDesign object / text run / image / vector / table / group。

- edge = proximity、alignment、overlap、contains、same-style、same-layer、caption-near-image、timeline-order。

- edge score 可解释化，先用规则打分，后续再替换成 ML scorer。

- graph clustering 可用于恢复图文组、卡片、图片矩阵、对比列、图纸组。

**不适合直接套用的原因**
Doc2Graph 主要面向扫描/表单/票据等 document AI 任务，需要训练数据，且 GNN 解释性弱于规则图算法。建议只借鉴“图建模 + 边关系预测”的架构，不要把 GNN 作为第一轮主算法。

---

### 10. GROBID：PDF 到结构化 TEI 的生产级管线

**链接**：GROBID 是将 PDF 抽取、解析、重构为 TEI XML 的开源项目，支持全文结构化、标题、段落、章节、callout、figure、table、coordinates，并提供 API、训练、评测和 benchmark。([GitHub](https://github.com/grobidOrg/grobid "https://github.com/grobidOrg/grobid"))

**输入**
PDF 及其通过 pdfalto 等工具得到的文本和视觉布局信息。

**输出**
结构化 TEI XML，包括文档分段、标题、段落、引用、图表、坐标等。

**核心方法**
使用文本和视觉布局特征，结合 CRF / deep learning 模型进行序列标注和结构恢复。

**适合借鉴的部分**

- 生产级 document reconstruction pipeline。

- 中间结构、schema、训练/评测、API 化、benchmark 思路。

- 把结构恢复分解为 header、body、section、figure、table、reference 等多个任务。

- 输出结构化 XML/JSON，并保留 coordinates 作为 trace。

**不适合直接套用的原因**
GROBID 强领域化于学术论文和 TEI，不适合直接识别建筑汇报/PPT 页面组件。它处理的是论文结构，不是你们白名单 Author Model。适合借鉴工程组织方式，而不是标签体系。

---

### 11. Docling：现代文档转换与统一中间表示

**链接**：Docling 支持 PDF、DOCX、PPTX 等多格式解析，包含 page layout、reading order、table structure、formula、image classification，输出统一 `DoclingDocument`，并可导出 Markdown、HTML、DocTags 和 lossless JSON。([GitHub](https://github.com/docling-project/docling "https://github.com/docling-project/docling")) Docling 技术报告说明它是开源、自包含、可本地运行的 Python library，并基于专门的 layout/table 模型。([arXiv](https://arxiv.org/html/2501.17887v1 "https://arxiv.org/html/2501.17887v1"))

**输入**
PDF、PPTX、DOCX、图片等文档格式。

**输出**
统一文档对象模型、Markdown、HTML、JSON、DocTags 等。

**核心方法**
多格式解析 + layout model + table model + reading order + 统一文档 IR + 多格式导出。

**适合借鉴的部分**

- “Observed format → unified document model → export writer”的工程分层。

- lossless JSON 与 semantic export 同时存在的设计。

- reading order、table structure、HTML/Markdown writer 的组织方式。

- 可作为你们 HTML writer 和 debug artifact 的参考。

**不适合直接套用的原因**
Docling 目标是通用文档转换，不是从 InDesign reverse snapshot 重建一个受白名单约束的可编辑 Author Model。它可能会把设计语义压缩成通用 Markdown/HTML 结构，无法保留建筑汇报中的复杂组件意图。

---

### 12. SlideCraft + SciPostLayout：合成数据、海报/展示版式数据集

**链接**：SlideCraft 是 ICDAR 2024 相关实现，可从 Wikipedia 内容生成多样化 slide，并提取 YOLO bbox 标注；流程包括内容解析、摘要、slide 生成、渲染、annotation extraction，并随机化 layout、theme、font、background、header/footer 等。([GitHub](https://github.com/travisseng/SlideCraft "https://github.com/travisseng/SlideCraft")) SciPostLayout 是 scientific poster layout analysis / generation 数据集，包含 7,855 张 scientific posters 的人工 layout annotations，并公开用于 layout analysis 和 generation。([CVF开放获取](https://openaccess.thecvf.com/content/CVPR2024W/GDUG/papers/Wang_SciPostLayout_A_Dataset_for_Layout_Analysis_and_Layout_Generation_of_CVPRW_2024_paper.pdf "https://openaccess.thecvf.com/content/CVPR2024W/GDUG/papers/Wang_SciPostLayout_A_Dataset_for_Layout_Analysis_and_Layout_Generation_of_CVPRW_2024_paper.pdf"))

**输入**
SlideCraft 输入文本/内容源并生成 PPT/slide；SciPostLayout 输入/数据是 poster 页面图像和人工标注 layout。

**输出**
合成 slide、页面截图、bbox annotation、layout category 数据。

**核心方法**
SlideCraft 用规则和模板生成多样化 slide，再导出检测标注；SciPostLayout 提供人工标注的海报版式数据，用于布局分析与生成 benchmark。

**适合借鉴的部分**

- 构造你们自己的 synthetic InDesign / HTML / PPT benchmark。

- 覆盖页面类型：封面、图文页、图片矩阵、图表页、时间轴、对比页、指标卡。

- 自动生成 Observed Snapshot + Author Model 对齐数据。

- 给 ML 辅助模块提供训练/验证数据，也可测试规则算法鲁棒性。

**不适合直接套用的原因**
它们主要服务 layout detection / generation，不直接解决 semantic reconstruction。SciPostLayout 偏 scientific poster，SlideCraft 偏通用 slide synthetic data，建筑汇报的图纸、效果图、材料板、轴线图、节点详图等类别需要你们自己定义。

---

## 2. 适合你们的第一轮算法设计建议

### 2.1 建议采用“规则图算法为主，ML 为辅助”的架构

推荐第一版分成 6 层：

```text
Observed Document Model
  ↓
Primitive Normalization
  ↓
Cross-page Template / Master Detection
  ↓
Page Object Graph + Visual Segmentation
  ↓
Semantic Role & Component Reconstruction
  ↓
Author Model + Evidence / Confidence / Unresolved
  ↓
HTML Writer
```

### 2.2 Primitive Normalization

把 InDesign snapshot 中的对象统一成基础 primitive：

```json
{
  "id": "obj_123",
  "type": "text|image|vector|table|group|line|shape",
  "page": 5,
  "layer": "Content",
  "masterRef": "A-Master",
  "bbox": {"x": 120, "y": 80, "w": 420, "h": 260},
  "z": 37,
  "text": "...",
  "style": {
    "paragraphStyle": "Title 1",
    "characterStyles": [],
    "fontSize": 28,
    "fontWeight": 700,
    "color": "#111111"
  },
  "asset": {
    "href": "renderings/aerial.jpg",
    "kind": "photo|drawing|material|unknown"
  },
  "tags": ["indesign-tag-if-any"]
}
```

这一层不要急着判断语义，只做标准化、坐标归一化、样式归一化、文本 run 合并、对象去噪。

### 2.3 Cross-page Template / Master Detection

即使 snapshot 里已有母版信息，也建议做统计验证：

- 同一位置、同一尺寸、同一样式、同一文本或同一资源 hash，在多页重复出现 → `templateElement`。

- 页码、logo、项目名、章节名、装饰线、固定页脚 → 从正文候选中剔除。

- 同一页面版式重复出现 → page type cluster。

输出示例：

```json
{
  "objectId": "obj_45",
  "role": "template.footer.pageNumber",
  "confidence": 0.96,
  "evidence": [
    {"type": "repeated_position", "pages": [2,3,4,5,6], "score": 0.35},
    {"type": "text_pattern", "pattern": "page_number", "score": 0.28},
    {"type": "master_layer", "master": "A-Master", "score": 0.33}
  ]
}
```

### 2.4 Page Object Graph

建议把每页变成 graph：

```text
node = primitive object or already-merged group
edge = relation between two nodes
```

常用 edge evidence：

| Edge evidence           | 说明                         |
| ----------------------- | -------------------------- |
| `proximity`             | bbox 间距小，可能属于同一组           |
| `alignment`             | 左边界、右边界、中心线、baseline 对齐    |
| `containment`           | 一个对象位于背景色块、卡片、图框内部         |
| `same_style`            | 文本样式、字号、颜色、段落样式一致          |
| `caption_relation`      | 小字号文本紧邻图片下方/右侧             |
| `grid_relation`         | 多个对象尺寸接近、间距规律              |
| `separator_blocked`     | 两对象之间有明显分割线/大空白，降低相关性      |
| `z_relation`            | 背景 shape 在底层，文本/图片在上层      |
| `semantic_text_pattern` | “01 / 02 / 03”、日期、面积、% 等模式 |
| `asset_kind_similarity` | 多张材料图、效果图、图纸属于同类矩阵         |

### 2.5 分组顺序建议

不要一上来做页面类型分类。建议先按以下顺序恢复结构：

1. **去掉 template / decoration / background**

2. **文本 run → line → paragraph → text block**

3. **image/vector/table 与 caption / label / callout 绑定**

4. **局部 group：图文组、卡片、图纸组、材料组**

5. **网格 group：图片矩阵、指标卡矩阵、对比列**

6. **页面大区块：标题区、主体区、侧栏、页脚区**

7. **页面类型识别：封面、章节页、图文页、图纸页、对比页、时间轴页、指标页**

8. **映射到 Author Model 白名单组件**

### 2.6 Author Model 白名单建议

可先定义较少但稳定的组件：

```ts
type AuthorNode =
  | CoverPage
  | SectionPage
  | TitleTextPage
  | ImageTextBlock
  | CaptionedFigure
  | ImageGrid
  | DrawingPanel
  | MaterialBoard
  | Timeline
  | MetricCardGrid
  | ComparisonPage
  | TableBlock
  | FreeformGroup
  | UnresolvedGroup;
```

其中 `FreeformGroup` 和 `UnresolvedGroup` 不应是黑盒兜底，而是带证据和原因：

```json
{
  "type": "UnresolvedGroup",
  "reason": "ambiguous_caption_binding",
  "candidates": [
    {"target": "image_12", "score": 0.61},
    {"target": "image_13", "score": 0.58}
  ],
  "evidence": [
    {"type": "distance_to_image_12", "value": 8},
    {"type": "distance_to_image_13", "value": 10},
    {"type": "same_column", "value": true}
  ]
}
```

---

## 3. 第一轮实现优先级

### P0：第一轮必须实现 / 深读

#### A. REIP 式 visual element grouping

目标：恢复页面内层级组。

最小实现：

- 建立 object graph。

- 计算 pairwise relation scores。

- 用 agglomerative clustering / union-find / graph community detection 做 bottom-up grouping。

- 输出 group tree。

- 每次 merge 都保存 evidence。

#### B. VIPS 式 visual block segmentation

目标：恢复大区块、网格、分隔线、页面主体结构。

最小实现：

- 识别大空白、显式线条、背景色块。

- 递归切分页面区域。

- 为每个 visual block 计算 coherence。

- coherence 不够时继续分裂，过度分裂时回退到 group evidence。

#### C. pdfminer / PdfPig 式 text block + reading order

目标：稳定生成正文、标题、图注的基础文本结构。

最小实现：

- text run → line。

- line → paragraph。

- paragraph → text block。

- title / subtitle / body / caption 初步分类。

- reading order 输出多候选和冲突原因。

#### D. Cross-page master / repeated element detection

目标：把页面模板元素从正文语义中剥离。

最小实现：

- 按 bbox 归一化聚类。

- 按文本、图片 hash、样式、图层、母版 ID 做重复性评分。

- 标记 header/footer/logo/page number/section label/decorative rule。

---

### P1：第二阶段引入

#### E. LayoutParser / DocLayNet 式标注与评测体系

目标：建立你们自己的 gold dataset。

建议标注：

- 页面类型。

- visual group hierarchy。

- role：title、subtitle、body、caption、figure、drawing、material、metric、timeline item。

- Author Model node。

- reading order。

#### F. Docling / GROBID / Unstructured 式工程管线

目标：借鉴生产级 document IR 和导出机制。

建议：

- 同时保留 lossless observed JSON 和 semantic author JSON。

- 每个 AuthorNode 反查 source object IDs。

- 每个转换 pass 可单独打开 debug overlay。

- 每个 pass 输出 confidence delta。

#### G. LayoutLM / Doc2Graph 辅助模型

目标：当规则无法覆盖时，提供额外 evidence。

建议：

- 不直接让模型决定最终结构。

- 模型只输出 role probability 或 edge relatedness。

- 最终由 rule engine / graph resolver 汇总证据。

---

### P2：数据合成与长线优化

#### H. SlideCraft / SciPostLayout 式 synthetic benchmark

目标：规模化测试页面类型和复杂布局。

建议生成：

- 一图一文页。

- 多图矩阵页。

- 方案对比页。

- 时间轴页。

- 指标卡页。

- 效果图 + 说明页。

- 图纸 + 标注页。

- 材料板页。

- 展厅动线图页。

---

## 4. 可直接使用或试用的成熟库

### 4.1 Python 库

| 库 / 项目                        | 可用于                                                                | 备注                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfminer.six`                | PDF fallback、文本 bbox、reading order baseline                        | 适合参考 LAParams 的字符/行/文本框合并逻辑。([pdfminer.six](https://pdfminersix.readthedocs.io/en/latest/topic/converting_pdf_to_text.html "https://pdfminersix.readthedocs.io/en/latest/topic/converting_pdf_to_text.html"))                                            |
| `pdfplumber`                  | PDF fallback、bbox 调试、表格抽取、可视化 debug                                | 面向 machine-generated PDF，提供字符、矩形、线条、表格抽取和 visual debugging。([GitHub](https://github.com/jsvine/pdfplumber "https://github.com/jsvine/pdfplumber"))                                                                                                       |
| `LayoutParser`                | 标注、layout block 可视化、可选检测模型                                         | 更适合作为辅助和评测，不建议替代对象级算法。([GitHub](https://github.com/layout-parser/layout-parser "https://github.com/layout-parser/layout-parser"))                                                                                                                        |
| `Docling`                     | 参考统一文档 IR、HTML/Markdown/JSON 导出                                    | 可研究其 `DoclingDocument` 和 writer 设计。([GitHub](https://github.com/docling-project/docling "https://github.com/docling-project/docling"))                                                                                                                   |
| `unstructured`                | 元素类型 taxonomy、文档 partition pipeline                                | 支持把文档 partition 成 Title、NarrativeText、ListItem、Table、Header、Footer、Image 等 element。([Unstructured](https://docs.unstructured.io/open-source/core-functionality/partitioning "https://docs.unstructured.io/open-source/core-functionality/partitioning")) |
| `marker`                      | PDF/PPTX/DOCX 到 Markdown/JSON/HTML 的转换参考                           | 支持多格式、表格、图片、header/footer removal、可选 LLM。([GitHub](https://github.com/datalab-to/marker "https://github.com/datalab-to/marker"))                                                                                                                         |
| `GROBID`                      | 生产级结构化抽取、训练/评测/API 架构                                              | 适合学习 pipeline 和 schema，不适合直接用其 TEI 语义。([GitHub](https://github.com/grobidOrg/grobid "https://github.com/grobidOrg/grobid"))                                                                                                                              |
| `Shapely`                     | bbox 几何、相交、包含、合并、空白区域分析                                            | Shapely 是基于 GEOS 的平面几何分析库。([Shapely](https://shapely.readthedocs.io/ "https://shapely.readthedocs.io/"))                                                                                                                                                 |
| `NetworkX`                    | object graph、edge scoring、connected components、community detection | NetworkX 用于创建、操作和研究复杂网络。([NetworkX](https://networkx.org/ "https://networkx.org/"))                                                                                                                                                                      |
| `scikit-learn`                | DBSCAN、Agglomerative clustering、page type classifier               | DBSCAN 可识别任意形状簇并把 outlier 标为 noise。([scikit-learn](https://scikit-learn.org/stable/modules/clustering.html "https://scikit-learn.org/stable/modules/clustering.html"))                                                                                   |
| `hdbscan`                     | 不同密度对象分组、异常元素识别                                                    | HDBSCAN 适合可变密度聚类，并提供 cluster stability 思路。([HDBSCAN 文档](https://hdbscan.readthedocs.io/ "https://hdbscan.readthedocs.io/"))                                                                                                                              |
| `scipy.spatial.KDTree`        | 邻近对象查询、caption/image 最近邻、局部 graph 构建                               | KDTree 适合快速 nearest-neighbor 查询。([Scipy 文档](https://docs.scipy.org/doc//scipy-1.9.3/reference/generated/scipy.spatial.KDTree.html "https://docs.scipy.org/doc//scipy-1.9.3/reference/generated/scipy.spatial.KDTree.html"))                              |
| `Camelot`                     | PDF 表格 fallback / benchmark                                        | 仅用于 PDF 表格抽取参考，不应替代已有 InDesign table snapshot。([Camelot](https://camelot-py.readthedocs.io/ "https://camelot-py.readthedocs.io/"))                                                                                                                       |
| Microsoft `table-transformer` | 表格检测/结构识别模型参考                                                      | 面向 PDF/images 的 table extraction，可用于复杂表格 fallback 或评测。([GitHub](https://github.com/microsoft/table-transformer "https://github.com/microsoft/table-transformer"))                                                                                        |
| `Pydantic`                    | Author Model schema、evidence schema、validator                      | 适合定义白名单 Author Model 和 unresolved schema。([Pydantic](https://pydantic.dev/docs/validation/latest/get-started/ "https://pydantic.dev/docs/validation/latest/get-started/"))                                                                               |

### 4.2 JavaScript / Node.js 库

| 库 / 项目             | 可用于                               | 备注                                                                                                                                                |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rbush`            | bbox 空间索引、快速范围查询、邻近候选过滤           | RBush 是 JavaScript 的 2D R-tree spatial index，支持点和矩形查询。([GitHub](https://github.com/mourner/rbush "https://github.com/mourner/rbush"))             |
| `flatbush`         | 大量静态 bbox 的快速空间索引                 | 适合一次构建、多次查询的页面对象集合。([GitHub](https://github.com/mourner/flatbush "https://github.com/mourner/flatbush"))                                          |
| `graphology`       | JS/TS object graph、边关系、图算法生态      | Graphology 是 JavaScript/TypeScript 的多用途 Graph 对象库。([GitHub](https://github.com/graphology/graphology "https://github.com/graphology/graphology")) |
| `sigma.js`         | debug graph 可视化                   | 适合展示 object graph、group tree、冲突边。([GitHub](https://github.com/jacomyal/sigma.js/ "https://github.com/jacomyal/sigma.js/"))                        |
| `pdfjs-dist`       | PDF fallback、页面渲染、对照调试            | 如果需要把 PDF 与 InDesign snapshot 做视觉对照，可作为辅助。                                                                                                        |
| `jsdom` / `parse5` | HTML writer 后的 DOM 校验             | 适合验证生成 HTML 是否满足白名单结构。                                                                                                                            |
| `zod`              | TypeScript Author Model schema 校验 | 若主工程在 Node/TS，适合定义 AuthorNode、Evidence、Unresolved schema。                                                                                         |

---

## 5. 不建议作为第一轮核心的方向

### 5.1 纯截图 OCR / image-to-markup

例如端到端 screenshot-to-HTML、image-to-Markdown、OCR+VLM 方案，不建议作为第一轮核心。原因是你们已有对象级结构、文本、样式、图层、z-order 和资源链接；纯图像方法会丢掉这些高价值信息，并且通常难以解释。

可以借鉴的只有：

- 视觉大区块 detection。

- 表格/公式/图像区域 fallback。

- 对复杂页面的辅助 sanity check。

### 5.2 任意网页还原 / screenshot-to-webpage

这类方法目标是从截图生成可运行网页，关注像素还原，不关注作者语义。你们的目标是“可编辑、干净、白名单语义 HTML”，因此不应追求任意 CSS 还原，而应恢复组件意图。

### 5.3 直接让 LLM/VLM 判断页面语义

LLM/VLM 可以作为 review assistant 或弱 evidence source，但不适合作为不可解释兜底。更好的方式是让模型只输出：

```json
{
  "candidateRole": "caption",
  "confidence": 0.72,
  "textEvidence": "文本较短，包含图号模式",
  "geometryEvidence": "位于图片下方 8px"
}
```

最终裁决仍由规则图和 evidence aggregator 完成。

---

## 6. 第一轮最小可行实现路线

### Milestone 1：对象图与基础分组

输入：一页 InDesign snapshot。
输出：group tree + evidence。

实现内容：

- bbox 空间索引。

- object graph。

- proximity / alignment / containment / same-style edges。

- bottom-up grouping。

- VIPS-style separator penalty。

- debug overlay。

### Milestone 2：文本语义与阅读顺序

输入：text objects / text runs。
输出：title、subtitle、body、caption、label、page number、section label。

实现内容：

- 文本行和段落合并。

- 样式聚类：字号、粗细、颜色、段落样式名。

- caption 绑定。

- reading order 候选。

- unresolved conflict 输出。

### Milestone 3：页面组件识别

输入：group tree。
输出：Author Model components。

优先支持：

```text
CoverPage
SectionPage
ImageTextBlock
CaptionedFigure
ImageGrid
DrawingPanel
MaterialBoard
MetricCardGrid
ComparisonPage
Timeline
TableBlock
```

### Milestone 4：跨页模板与页面类型

输入：整本文档。
输出：master elements、page type、layout family。

实现内容：

- 重复元素检测。

- 母版校验。

- 页面聚类。

- 章节结构。

- header/footer/page number 排除。

### Milestone 5：评测集与回归测试

建议每类页面至少准备 20–50 页 gold sample：

| 页面类型  | 评测重点                      |
| ----- | ------------------------- |
| 封面    | 标题、项目名、主图、装饰元素            |
| 章节页   | 章节号、章节标题、背景图              |
| 图文页   | 图文绑定、标题层级、正文顺序            |
| 图片矩阵页 | grid 识别、caption 绑定        |
| 图纸页   | drawing image、图名、编号、比例、注释 |
| 材料板页  | 材料图片、材料名、规格、矩阵            |
| 指标卡页  | 数值、单位、指标名、卡片边界            |
| 对比页   | 左右/多列对应关系                 |
| 时间轴页  | 时间点、连接线、事件卡片              |
| 表格页   | 表头、表体、注释、跨行跨列             |

---

## 7. 推荐最终技术路线

第一轮最稳妥的路线是：

```text
Rule-based + Graph-based Semantic Reconstruction
  + explicit evidence
  + confidence scoring
  + unresolved reporting
  + optional ML scorer
```

不要直接做：

```text
Observed Snapshot → LLM/VLM → HTML
```

更推荐：

```text
Observed Snapshot
  → Primitive Normalization
  → Repeated/Master Element Removal
  → Text Block Reconstruction
  → Visual Object Graph
  → Hierarchical Grouping
  → Role Labeling
  → Page Type Recognition
  → Whitelist Author Model
  → HTML Writer
```

其中最重要的三类 evidence 是：

1. **几何证据**：距离、对齐、包含、重叠、空白分隔、网格规律。

2. **样式证据**：段落样式、字符样式、字号、颜色、字重、行距。

3. **跨页证据**：母版、重复位置、重复资源、页面版式家族。

这样可以同时满足“可编辑语义 HTML”和“可解释、可回溯、可 debug”的工程目标。

## 待整理要点

- 可参考项目 / 论文 / 算法：
- 适合借鉴的部分：
- 不适合直接套用的部分：
- 对本项目 `src/semantic-reconstruction/` 的启发：
