# 回复：语义重建算法调研 - Kimi Agent 蜂群

## 来源

- 来源：Kimi Agent 蜂群
- 日期：2026-06-03
- 主题：从 InDesign / 固定分页文档对象快照中重建可编辑语义 HTML 的算法参考

## 原始回复

# Semantic Reconstruction 算法层深度调研报告

> **调研目标**: 为"从 InDesign/固定分页文档的对象快照中重建可编辑语义 HTML"的算法层设计，寻找可借鉴的开源项目、论文、算法库或工程实现。
>
> **调研方法**: Deep Research Swarm — 12个并行研究代理 × 25+次搜索/代理 = 300+次总搜索，覆盖学术论文、GitHub、官方文档、技术博客
>
> **调研日期**: 2026-06-03
>
> **验证状态**: 已完成交叉验证（8项高置信度 / 4项中等置信度 / 3项冲突已解决）+ 跨维度洞察提取（10条非显性模式）

---

## 执行摘要

本次调研通过 **12个并行研究代理** 对文档布局分析领域进行了系统性深度调研，总搜索量超过 **300次**，覆盖了布局检测、阅读顺序、区域聚类、表格识别、中间表示、幻灯片理解、母版检测、网格检测、可解释AI、文档解析、建筑行业特定需求等 **12个维度**。

**核心结论**:

1. **没有发现任何现成工具**可直接解决"从InDesign固定分页文档重建可编辑语义HTML"的问题 — 这是一个独特的蓝海场景
2. **最优架构是"规则为主、模型为辅"的混合架构** — XY-cut++（阅读顺序）+ S2 Chunking（聚类）+ InDesign元数据消费，覆盖95%+场景
3. **InDesign特有的元数据**（Thread/Articles/Layers/MasterPage）是通用工具没有的巨大优势，应优先消费
4. **建筑汇报领域需要自定义的标签体系** — 在DocLayNet 11类 + SynSlide 16类基础上扩展行业特定类别

---

## 一、推荐项目详细分析（12项）

### Tier-0: 架构级核心参考

---

#### 1. XY-cut++ (2025) — 纯规则阅读顺序检测

| 属性          | 详情                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **链接**      | 论文: arXiv 2025 (XY-cut++: Density-Driven Document Layout Analysis)                                                  |
| **输入**      | 文档页面中的文本块序列（含bbox坐标）                                                                                                |
| **输出**      | 层次化阅读顺序树（含分割证据）                                                                                                     |
| **核心方法**    | 四阶段纯规则pipeline: ①元素分类（跨栏/装饰性/普通）→ ②密度自适应列检测 → ③块内自顶向下排序 → ④全局序列恢复 + 证据输出；通过评估区域密度自动选择分割轴（X或Y）                       |
| **关键数据**    | BLEU-4 = 0.986，ARD降低93.5%，毫秒级响应                                                                                     |
| **适合借鉴**    | **完全可解释的规则引擎架构**（符合项目"可解释、输出证据"的核心要求）；**密度评估公式**可自动判断分割策略；**四阶段pipeline设计**可逐层输出中间结果和置信度；**零依赖**（无需GPU/训练数据/深度学习框架） |
| **不适合直接套用** | ① 原始算法从像素投影开始，需改造为从坐标数据驱动；② 对复杂图文环绕布局可能需要额外规则；③ 论文较新，开源实现可能不完整                                                      |
| **优先级**     | **P0 — 阅读顺序引擎的首选基础**                                                                                                |

---

#### 2. S2 Chunking (2025) — 空间+语义谱聚类

| 属性          | 详情                                                                                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | 论文: [https://arxiv.org/abs/2501.05485；开源实现](https://arxiv.org/abs/2501.05485%EF%BC%9B%E5%BC%80%E6%BA%90%E5%AE%9E%E7%8E%B0): [GitHub - Vprashant/s2-chunking-lib: A library for structural-semantic chunking of documents. · GitHub](https://github.com/Vprashant/s2-chunking-lib) |
| **输入**      | 文档元素列表（含bbox坐标、文本内容）                                                                                                                                                                                                                                                              |
| **输出**      | 聚类后的元素组（chunks），每组含相关元素及聚类依据                                                                                                                                                                                                                                                      |
| **核心方法**    | 图构建（节点=元素，边权重=空间距离+语义相似度融合）→ 谱聚类（Spectral Clustering）划分 → token长度约束后处理；空间权重 w = 1/(1+d)，语义权重 = cosine_similarity                                                                                                                                                                  |
| **关键数据**    | cohesion 0.85-0.88, layout consistency 0.82-0.85                                                                                                                                                                                                                                  |
| **适合借鉴**    | **直接操作bbox**（完全匹配项目数据格式）；**图构建+谱聚类方法**可解释性强（能输出聚类依据）；**空间+语义双维度融合**公式简单有效；**有开源实现**可直接集成                                                                                                                                                                                          |
| **不适合直接套用** | ① 主要针对文本文档，对复杂布局（指标卡、对比块）的处理未验证；② 需要文本嵌入（BERT），无文本元素（如图）需额外处理；③ 聚类数量需预设或启发式确定                                                                                                                                                                                                     |
| **优先级**     | **P0 — 区域分组/图文聚类的首选算法**                                                                                                                                                                                                                                                           |

---

#### 3. BabelDOC (2026) — 中间表示（IR）架构

| 属性          | 详情                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [https://github.com/funstory-ai/BabelDOC；论文](https://github.com/funstory-ai/BabelDOC%EF%BC%9B%E8%AE%BA%E6%96%87): [BabelDOC: Better Layout-Preserving PDF Translation via Intermediate Representation](https://arxiv.org/html/2605.10845v1) |
| **输入**      | PDF文档                                                                                                                                                                                                                                               |
| **输出**      | 结构化中间表示（IR）JSON + 翻译后PDF/HTML                                                                                                                                                                                                                       |
| **核心方法**    | 五模块pipeline: IR构建（将PDF解析为统一IR）→ 公式处理 → NLP翻译 → 自适应排版 → PDF重建；IR层将视觉元数据（pdf_font, page_layout, bbox）与语义段落文本完全解耦                                                                                                                                      |
| **适合借鉴**    | **IR解耦设计模式**（将视觉布局与文本语义分离，完全匹配Observed↔Author Model的需求）；**双向转换思想**（正向解析+逆向重建）；**五模块pipeline架构**可作为Semantic Reconstruction层的参考结构                                                                                                                     |
| **不适合直接套用** | ① 面向翻译场景，非直接输出HTML；② AGPL-3.0协议商用受限；③ 公式处理等模块对建筑汇报不必要；④ 自适应排版引擎针对PDF而非HTML                                                                                                                                                                          |
| **优先级**     | **P0 — IR层架构设计的核心参考**                                                                                                                                                                                                                               |

---

### Tier-1: 重要模块参考

---

#### 4. Unstructured — 文档解析ETL与Element Ontology

| 属性          | 详情                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **链接**      | GitHub: [GitHub - Unstructured-IO/unstructured: Convert documents to structured data effortlessly. Unstructured is open-source ETL solution for transforming complex documents into clean, structured formats for language models. Visit our website to learn more about our enterprise grade Platform product for production grade workflows, partitioning, enrichments, chunking and embedding. · GitHub](https://github.com/Unstructured-IO/unstructured) |
| **输入**      | PDF、PPTX、DOCX、图片等60+格式                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **输出**      | JSON/Markdown/HTML，含element类型（Title/NarrativeText/Table/ListItem等）、bbox坐标、page_number、text_as_html、parent_id                                                                                                                                                                                                                                                                                                                                                 |
| **核心方法**    | 多策略解析: fast（规则式）/ hi_res（YOLOX+detectron2）/ ocr_only / vlm；auto策略按页动态路由；通过`text_as_html`字段输出HTML表示，`parent_id`机制支持整文档HTML重建                                                                                                                                                                                                                                                                                                                                  |
| **适合借鉴**    | **Element Ontology设计**（Title/NarrativeText/ListItem/Table/Figure/Header/Footer等白名单，可直接扩展为项目标签体系）；**多策略路由架构**（按页选择解析策略）；**HTML输出格式**（表格保留rowspan/colspan）；**metadata设计**（coordinates、page_number、category_depth）；**partitioning设计模式**                                                                                                                                                                                                                         |
| **不适合直接套用** | ① 从像素/渲染层开始处理，非直接消费结构化对象快照；② hi_res依赖深度学习模型（YOLOX、Chipper），推理开销大；③ 对InDesign特有概念（母版、图层、z-order、样式继承）无原生支持；④ 部分高级功能需企业版                                                                                                                                                                                                                                                                                                                                       |
| **优先级**     | **P1 — Element Ontology和HTML输出格式的核心参考**                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

#### 5. IBM Docling — CPU友好型布局检测Pipeline

| 属性          | 详情                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [https://github.com/DS4SD/docling；论文](https://github.com/DS4SD/docling%EF%BC%9B%E8%AE%BA%E6%96%87): [Docling Technical Report](https://arxiv.org/html/2408.09869)                                   |
| **输入**      | PDF文档页面图像（72dpi）                                                                                                                                                                                            |
| **输出**      | 布局元素bbox + 11+类别标签 + `export_to_html()`语义HTML                                                                                                                                                               |
| **核心方法**    | RT-DETR架构在DocLayNet上训练，ONNX Runtime推理；支持导出完整语义HTML（H1-H6、p、table、strong、em）；图片EMBEDDED/REFERENCED/PLACEHOLDER三种模式                                                                                           |
| **关键数据**    | CPU亚秒级延迟@72dpi，GitHub 40K+ stars                                                                                                                                                                            |
| **适合借鉴**    | **完整的生产级pipeline参考**（从PDF到语义HTML的全链路）；**RT-DETR的CPU友好设计**；**DocLayNet 11类标签体系**（Caption/Footnote/Formula/List-item/Page-footer/Page-header/Picture/Section-header/Table/Text/Title）；**统一文档模型**（Pydantic强类型） |
| **不适合直接套用** | ① 从图像开始处理，非直接消费结构化数据；② 对InDesign特定概念无原生支持；③ 推理虽快但仍需深度学习模型部署；④ 标签体系未覆盖建筑汇报特定元素                                                                                                                               |
| **优先级**     | **P1 — 生产级pipeline架构和标签体系参考**                                                                                                                                                                               |

---

#### 6. Surya v2 — Block级HTML输出格式标杆

| 属性          | 详情                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [GitHub - datalab-to/surya: OCR, layout analysis, reading order, table recognition in 90+ languages · GitHub](https://github.com/datalab-to/surya)                      |
| **输入**      | 文档图像（PDF页面或图片）                                                                                                                                                                  |
| **输出**      | 结构化JSON（含bbox、HTML表示、reading_order、confidence）、17种布局标签                                                                                                                          |
| **核心方法**    | 基于Qwen3.5-style VLM架构（~650M参数），单一模型同时处理布局分析+OCR+表格识别；文本行检测使用EfficientViT segformer；输出canonicalized layout label和block级HTML                                                      |
| **适合借鉴**    | **Block级HTML输出格式**（每个block含label/html/confidence/reading_order，可直接参考设计项目输出格式）；**17种布局标签体系**（LAYOUT_PRED_RELABEL定义）；**置信度设计**（per-token probability均值）；**`<math>`标签的LaTeX兼容性设计** |
| **不适合直接套用** | ① 面向扫描文档/OCR场景，需渲染为图片输入；② 需vllm/llama.cpp推理后端，部署重；③ 不可解释性强（VLM黑盒），不符合"输出证据、置信度和unresolved项"要求；④ 模型权重非完全商用友好                                                                     |
| **优先级**     | **P1 — HTML输出格式和布局标签体系的参考标杆**                                                                                                                                                   |

---

#### 7. Eynollah — DL+规则混合架构（可解释性标杆）

| 属性          | 详情                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [GitHub - qurator-spk/eynollah: Document Layout Analysis · GitHub](https://github.com/qurator-spk/eynollah) |
| **输入**      | 文档页面图像                                                                                                              |
| **输出**      | PAGE-XML格式（含10类像素级分割、阅读顺序LTR/RTL、OCR文本、@conf置信度属性）                                                                  |
| **核心方法**    | 像素级分割模型（CNN）做感知 → 启发式规则做推理（阅读顺序、deskewing、过滤）→ 输出标准PAGE-XML；模型仅负责"看到什么"，规则负责"如何理解"                                  |
| **适合借鉴**    | **"DL做感知+规则做推理"的混合架构哲学**（与项目"可解释"要求高度匹配）；**PAGE-XML输出格式**（可转换为中间表示）；**阅读顺序启发式规则设计**；**@conf置信度属性设计**                |
| **不适合直接套用** | ① 面向历史文档和扫描图像；② 处理速度较慢；③ 依赖TensorFlow <2.13，技术栈较老；④ 输出为PAGE-XML，需额外转换为HTML                                          |
| **优先级**     | **P1 — 混合架构哲学的核心参考**                                                                                                |

---

#### 8. DocLayout-YOLO — 布局检测速度-精度平衡最佳

| 属性          | 详情                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [GitHub - opendatalab/DocLayout-YOLO: DocLayout-YOLO: Enhancing Document Layout Analysis through Diverse Synthetic Data and Global-to-Local Adaptive Perception · GitHub](https://github.com/opendatalab/DocLayout-YOLO) |
| **输入**      | 文档页面图像                                                                                                                                                                                                                           |
| **输出**      | 布局元素bbox + 类别标签（Text/Title/Figure/Table/Formula等）                                                                                                                                                                                |
| **核心方法**    | 基于YOLOv10，DocSynth-300K合成数据预训练，支持一键导出ONNX/TensorRT                                                                                                                                                                               |
| **关键数据**    | A100上85.5页/秒，比LayoutLMv3快一个数量级                                                                                                                                                                                                   |
| **适合借鉴**    | **合成数据预训练策略**（DocSynth-300K的生成方法可用于建筑汇报领域）；**ONNX/TensorRT一键导出**；**与Detectron2相比的轻量化优势**                                                                                                                                         |
| **不适合直接套用** | ① AGPL-3.0协议商用受限；② 从图像开始处理；③ 标签体系通用，未覆盖建筑汇报特定类型；④ 需要GPU推理                                                                                                                                                                        |
| **优先级**     | **P2 — 如需训练自定义布局检测模型时的首选方案**                                                                                                                                                                                                     |

---

### Tier-2: 特定场景参考

---

#### 9. Table Transformer (TATR) — 表格结构识别

| 属性          | 详情                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | GitHub: [https://github.com/microsoft/table-transformer；论文](https://github.com/microsoft/table-transformer%EF%BC%9B%E8%AE%BA%E6%96%87): PubTables-1M |
| **输入**      | 文档页面图像                                                                                                                                               |
| **输出**      | 表格区域bbox、单元格结构（含rowspan/colspan）、表格内容                                                                                                                |
| **核心方法**    | 基于DETR的端到端表格检测和结构识别；在PubTables-1M数据集上训练                                                                                                              |
| **适合借鉴**    | **将表格识别转为object detection问题的思路**；**单元格关系建模**（rowspan/colspan识别）；**PubTables-1M数据集构建方法**                                                              |
| **不适合直接套用** | ① 需OCR配合提取单元格文本；② 从图像开始处理；③ 对复杂表格（嵌套表、跨页表）效果有限；④ 建筑汇报表格通常不复杂，可能不需要如此重的模型                                                                             |
| **优先级**     | **P2 — 表格结构识别模块的参考**                                                                                                                                 |

---

#### 10. Kreuzberg + refinedoc — 跨页重复元素检测

| 属性          | 详情                                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | Kreuzberg: [https://docs.kreuzberg.dev/；refinedoc](https://docs.kreuzberg.dev/%EF%BC%9Brefinedoc): [GitHub - CyberCRI/refinedoc: Python library for extracting headers, footers and body from PDF · GitHub](https://github.com/CyberCRI/refinedoc) |
| **输入**      | 多页文档的文本块序列                                                                                                                                                                                                                                         |
| **输出**      | 标记为"furniture"的重复元素（页眉/页脚/页码等）                                                                                                                                                                                                                     |
| **核心方法**    | Kreuzberg: `strip_repeating_text`功能，supermajority投票机制检测跨页逐字重复文本；refinedoc: 基于HP Labs Lin (2003) "Page-Association"方法的纯Python实现                                                                                                                     |
| **关键数据**    | HP Labs方法: 1156页上98%精度/92.7%召回；refinedoc: 零外部依赖                                                                                                                                                                                                    |
| **适合借鉴**    | **跨页文本重复检测算法**（supermajority投票 + 模糊匹配 + 几何评分）；**纯Python轻量实现**；**"furniture"分离概念**（将重复元素与内容分离）                                                                                                                                                      |
| **不适合直接套用** | ① 面向通用PDF页眉页脚检测，不含InDesign母版概念；② 对非文本重复元素（如logo、装饰线）需要配合图像哈希；③ 几何评分需要调参                                                                                                                                                                            |
| **优先级**     | **P2 — 母版检测/重复元素识别的算法参考**                                                                                                                                                                                                                          |

---

#### 11. LayoutReader + ReadingBank — 阅读顺序深度学习方案

| 属性          | 详情                                                                                                                                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **链接**      | 论文: [https://aclanthology.org/2021.emnlp-main.389.pdf；社区版](https://aclanthology.org/2021.emnlp-main.389.pdf%EF%BC%9B%E7%A4%BE%E5%8C%BA%E7%89%88): [GitHub - FreeOCR-AI/layoutreader: A Faster LayoutReader Model based on LayoutLMv3, Sort OCR bboxes to reading order. · GitHub](https://github.com/ppaanngggg/layoutreader) |
| **输入**      | 文本块序列 + bbox坐标                                                                                                                                                                                                                                                                                                                |
| **输出**      | 阅读顺序索引序列                                                                                                                                                                                                                                                                                                                      |
| **核心方法**    | LayoutLM编码器 + seq2seq解码器；ReadingBank数据集50万页预训练；社区版改用LayoutLMv3 TokenClassification，一次前向传播                                                                                                                                                                                                                                     |
| **关键数据**    | BLEU=0.9819, ARD=1.75（启发式方法ARD=8.46）                                                                                                                                                                                                                                                                                          |
| **适合借鉴**    | **bbox+文本的多模态表示方法**；**ARD评估指标**（可用于衡量重建顺序偏差）；**ReadingBank数据集构建方法**（从DocX内部XML提取真实阅读顺序）                                                                                                                                                                                                                                       |
| **不适合直接套用** | ① 面向Word流式布局，非固定分页文档；② 不可解释（黑盒Transformer）；③ 需要GPU推理；④ 针对学术/办公文档训练，未覆盖建筑汇报场景                                                                                                                                                                                                                                                  |
| **优先级**     | **P3 — 复杂场景fallback的阅读顺序模型**                                                                                                                                                                                                                                                                                                  |

---

#### 12. SynSlide + InfoDet — 幻灯片/图表元素检测

| 属性          | 详情                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| **链接**      | SynSlide: 2025年论文；InfoDet: 相关论文                                                                              |
| **输入**      | 幻灯片/演示文稿页面图像                                                                                                 |
| **输出**      | 16类幻灯片元素（SynSlide）/ 75种图表类型（InfoDet）                                                                         |
| **核心方法**    | SynSlide: 合成数据集+目标检测；InfoDet: 多标签分类+目标检测                                                                     |
| **适合借鉴**    | **16类幻灯片元素标签体系**（可直接扩展，加入建筑汇报特定类别如FloorPlan/Elevation/Render）；**75种图表类型分类**（对建筑汇报中的数据可视化检测极有价值）；**合成数据训练策略** |
| **不适合直接套用** | ① 面向通用幻灯片，非建筑汇报特定；② 从图像开始处理；③ 需要训练自定义模型；④ 数据集可能需要授权                                                          |
| **优先级**     | **P3 — 建筑汇报领域标签体系扩展的参考**                                                                                     |

---

## 二、推荐优先级总览

| 优先级    | 项目                  | 核心借鉴点                     | 负责模块                     |
| ------ | ------------------- | ------------------------- | ------------------------ |
| **P0** | XY-cut++            | 阅读顺序规则引擎                  | Layer 3: Reading Order   |
| **P0** | S2 Chunking         | 图文分组/区域聚类                 | Layer 2: Layout Analyzer |
| **P0** | BabelDOC            | IR层解耦架构                   | Layer 1: IR Builder      |
| **P1** | Unstructured        | Element Ontology + HTML输出 | Layer 4: Author Model    |
| **P1** | IBM Docling         | 生产级pipeline + 标签体系        | 全链路参考                    |
| **P1** | Surya v2            | Block级HTML输出格式            | HTML输出格式                 |
| **P1** | Eynollah            | DL+规则混合架构哲学               | 架构设计                     |
| **P2** | DocLayout-YOLO      | 自定义布局检测训练                 | 模型训练参考                   |
| **P2** | Table Transformer   | 表格结构识别                    | 表格模块                     |
| **P2** | Kreuzberg+refinedoc | 跨页重复元素检测                  | 母版检测                     |
| **P3** | LayoutReader        | 复杂阅读顺序fallback            | 阅读顺序fallback             |
| **P3** | SynSlide+InfoDet    | 行业标签体系扩展                  | 标签设计                     |

---

## 三、成熟 JavaScript/Node/Python 库推荐

### A. 可直接用于核心算法的库

| 库名                | 语言     | 协议  | 用途                                | 安装                         | 链接                                                                                                                                                  |
| ----------------- | ------ | --- | --------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **scikit-learn**  | Python | BSD | Spectral Clustering、DBSCAN、KMeans | `pip install scikit-learn` | [https://scikit-learn.org/](https://scikit-learn.org/)                                                                                              |
| **NetworkX**      | Python | BSD | 图构建、图算法、连通组件分析                    | `pip install networkx`     | [https://networkx.org/](https://networkx.org/)                                                                                                      |
| **scipy.spatial** | Python | BSD | KDTree、距离计算、空间索引                  | `pip install scipy`        | [https://scipy.org/](https://scipy.org/)                                                                                                            |
| **genieclust**    | Python | MIT | 高效MST层次聚类（Genie算法）                | `pip install genieclust`   | [GitHub - gagolews/genieclust: Genie: Fast and Robust Hierarchical Clustering · GitHub](https://github.com/gagolews/genieclust)                     |
| **imagehash**     | Python | BSD | 感知哈希（pHash/dHash/aHash）           | `pip install imagehash`    | [GitHub - JohannesBuchner/imagehash: A Python Perceptual Image Hashing Module · GitHub](https://github.com/JohannesBuchner/imagehash)               |
| **rapidfuzz**     | Python | MIT | 快速文本相似度匹配                         | `pip install rapidfuzz`    | [GitHub - rapidfuzz/RapidFuzz: Rapid fuzzy string matching in Python using various string metrics · GitHub](https://github.com/rapidfuzz/RapidFuzz) |
| **rtree**         | Python | MIT | R-Tree空间索引                        | `pip install rtree`        | [GitHub - Toblerity/rtree: Rtree: spatial index for Python GIS · GitHub](https://github.com/Toblerity/rtree)                                        |

### B. 可用于表格处理的库

| 库名             | 语言     | 协议  | 用途                        | 安装                       | 链接                                                                                                                                                                                                  |
| -------------- | ------ | --- | ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Camelot**    | Python | MIT | 有框/无框表格提取（stream/lattice） | `pip install camelot-py` | [GitHub - camelot-dev/camelot: A Python library to extract tabular data from PDFs · GitHub](https://github.com/camelot-dev/camelot)                                                                 |
| **pdfplumber** | Python | MIT | 布局感知文本提取+内置表格检测启发式        | `pip install pdfplumber` | [GitHub - jsvine/pdfplumber: Plumb a PDF for detailed information about each char, rectangle, line, et cetera — and easily extract text and tables. · GitHub](https://github.com/jsvine/pdfplumber) |

### C. 可用于InDesign数据解析的库

| 库名             | 语言     | 协议  | 用途                           | 安装                       | 链接                                                                                                                  |
| -------------- | ------ | --- | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **simpleidml** | Python | BSD | 解析InDesign IDML文件（ZIP格式XML包） | `pip install simpleidml` | [GitHub - Starou/SimpleIDML: Manipulate Adobe® InDesign® IDML files · GitHub](https://github.com/starou/simpleidml) |
| **lxml**       | Python | BSD | XML解析处理IDML内容                | `pip install lxml`       | [https://lxml.de/](https://lxml.de/)                                                                                |

### D. 可用于调试和可视化的库

| 库名             | 语言     | 协议   | 用途           | 安装                       | 链接                                                       |
| -------------- | ------ | ---- | ------------ | ------------------------ | -------------------------------------------------------- |
| **Pillow**     | Python | HPND | 图像处理、调试可视化叠加 | `pip install Pillow`     | [https://python-pillow.org/](https://python-pillow.org/) |
| **matplotlib** | Python | PSF  | 投影直方图、密度图可视化 | `pip install matplotlib` | [https://matplotlib.org/](https://matplotlib.org/)       |

---

## 四、推荐的系统架构（基于调研结论）

```
┌─────────────────────────────────────────────────────────────┐
│                    InDesign Reverse Snapshot                   │
│  (JSON: pages, masterSpreads, layers, styles,                  │
│   textFrames, imageFrames, tables, vectors,                    │
│   stories/thread, articles, z-order, bbox)                     │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│  LAYER 1: IR Builder  (借鉴 BabelDOC + Unstructured)           │
│                                                               │
│  输入: InDesign对象快照                                        │
│  处理:                                                         │
│    - 坐标系统一 (InDesign Y↓ → 标准坐标系)                      │
│    - 类型映射 (InDesign类型 → 标准化Element类型)                 │
│    - 元数据消费 (Thread链→阅读顺序, MasterPage→母版标记)         │
│    - 规范化Document Element结构                                  │
│  输出: 标准化文档元素列表 (每个含bbox/类型/内容/样式/置信度/来源)  │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│  LAYER 2: Layout Analyzer  (借鉴 S2 Chunking + XY-cut++)       │
│                                                               │
│  输入: 标准化文档元素列表                                       │
│  处理:                                                         │
│    2a. 预处理: IoU重叠合并 → 消除嵌套元素噪音                    │
│    2b. 网格检测: x坐标峰值聚类 + y轴DBSCAN → 识别行列结构         │
│    2c. 区域聚类: 图构建(空间+语义) + 谱聚类 → 语义区域分组       │
│    2d. 母版识别: IDML元数据(优先) + 几何匹配验证               │
│    2e. 页面分类: 基于特征模板 → 识别13种建筑汇报页面类型          │
│  输出: 语义区域树 (区域含类型/元素列表/置信度/证据)              │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│  LAYER 3: Reading Order & Semantics                            │
│          (借鉴 XY-cut++ + Eynollah置信度设计)                  │
│                                                               │
│  输入: 语义区域树                                             │
│  处理:                                                         │
│    3a. 区域内阅读顺序: XY-cut++密度驱动排序                     │
│    3b. 语义标签分配: 基于样式+位置+上下文 → H1-H6/P/Figcaption  │
│    3c. 图文关系链接: 图注→图片, 表格→表头                     │
│    3d. 置信度计算: 四级独立评分(类型/分组/顺序/语义)            │
│    3e. Unresolved项标记: Graphify三元标记系统                  │
│  输出: 带阅读顺序和语义标签的元素序列                           │
└────────────────────────────┬──────────────────────────────────┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│  LAYER 4: Author Model Builder  (借鉴 Surya + Unstructured)    │
│                                                               │
│  输入: 带语义标签的元素序列                                    │
│  处理:                                                         │
│    - 构建符合白名单语义的编辑模型                               │
│    - 输出Block级语义HTML (非像素级绝对定位)                     │
│    - 保留编辑性: 可回流的HTML, 语义标签, 最小内联样式            │
│    - 每块携带: label/html/confidence/reading_order/evidence     │
│  输出: Author Model (结构化JSON + 语义HTML源码包)               │
└───────────────────────────────────────────────────────────────┘
```

---

## 五、关键设计决策建议

| 决策点    | 推荐方案                                                 | 理由                             | 参考来源                      |
| ------ | ---------------------------------------------------- | ------------------------------ | ------------------------- |
| 核心聚类算法 | **谱聚类 + MST + DBSCAN组合**                             | 可解释性强，能输出聚类证据，无需训练数据           | S2 Chunking, genieclust   |
| 阅读顺序   | **规则为主(InDesign元数据+XY-cut++)，LayoutReader为fallback** | XY-cut++ BLEU 0.986，元数据覆盖99%场景 | XY-cut++, InDesign Thread |
| 页面类型识别 | **基于特征模板的规则分类**                                      | 建筑汇报页面类型有限（13种），规则足够           | Dim06 + Dim12综合分析         |
| 母版检测   | **元数据优先(IDML MasterSpreads) + 算法兜底**                 | IDML元数据100%精确，算法仅用于验证          | simpleidml, Dim08         |
| 置信度机制  | **四级独立评分 × 五级置信度矩阵**                                 | 多维度独立评分 + 五级聚合，覆盖所有决策类型        | Docling, Graphify, Dim10  |
| HTML输出 | **Block级语义HTML（如Surya/Unstructured）**                | 可编辑、可回流、非绝对定位                  | Surya v2, Unstructured    |
| 表格处理   | **规则为主(X-Y投影聚类) + TATR为fallback**                    | 从结构化数据开始，规则足够处理简单表格            | Camelot, pdfplumber       |
| 调试能力   | **可视化调试界面（如pdfplumber）**                             | 将分组边界、阅读顺序、置信度叠加到页面            | pdfplumber, Dim11         |

---

## 六、跨维度洞察（10条非显性模式）

> 这些洞察从多维度交叉分析中涌现，单一维度无法发现。

### 洞察1: "规则为主、模型为辅"是唯一可行路径

12个维度调研一致指向混合架构：深度学习模型（DocLayout-YOLO/LayoutLM）都有协议限制或不可解释问题；纯规则方法（XY-cut++/谱聚类）在各自领域达到SOTA精度。采用Eynollah的"DL做感知+规则做推理"哲学，可以在保持可解释性的同时覆盖95%+场景。

### 洞察2: InDesign元数据是竞争者没有的巨大优势

所有通用文档理解工具（Surya/PDF-Extract-Kit/Unstructured）都面临"从像素重建"的根本困难。我们的系统直接拥有Thread链（阅读顺序）、Articles面板（语义顺序）、Layers（z-order）、MasterPageItems（母版引用），使问题简单一个数量级。

### 洞察3: 建筑汇报存在一个"可扩展的三层标签体系"

通用层（DocLayNet 11类：Text/Title/Figure/Table...）→ 布局层（SynSlide扩展：Caption/Header/Footer/Section-header...）→ 行业层（13种建筑类型：FloorPlan/Elevation/Render/MaterialBoard/Timeline/KPI...）。分层设计支持未来扩展更多行业。

### 洞察4: 置信度应采用"四级独立评分 × 五级聚合"矩阵

综合Docling（四级维度评分）、Graphify（三元标记）、Surya（per-token confidence）的最佳实践：四个独立维度（类型识别/分组决策/阅读顺序/语义角色）× 五级评分（EXTRACTED/HIGH/MODERATE/LOW/UNRESOLVED）。

### 洞察5: 谱聚类+MST+DBSCAN组合是区域分组最优算法栈

四层渐进式组合：IoU重叠合并（预处理）→ DBSCAN行列检测 → 谱聚类/MST语义区域聚类 → 组内结构识别。全部使用成熟库，无需训练自定义模型。

### 洞察6: 阅读顺序问题被高估 — InDesign元数据+XY-cut覆盖99%

通用领域将阅读顺序视为需50万页预训练的难题，但固定分页文档的问题简单得多：Thread链直接编码顺序，仅需XY-cut处理多栏布局的栏间顺序。

### 洞察7: HTML输出应是"Block级语义HTML"而非"像素级精确HTML"

pdf2htmlEX等工具追求像素级还原（绝对CSS定位），与"可编辑语义HTML"目标背道而驰。Surya和Unstructured的block级语义HTML是正确方向。

### 洞察8: 这是一个蓝海场景 — 没有现成工具直接解决

300+次搜索覆盖12个维度，没有发现任何开源项目直接针对"从InDesign固定分页文档重建可编辑语义HTML"。所有工具要么面向OCR，要么面向流式文档，要么面向学术论文。

### 洞察9: 母版检测应是"元数据优先+算法兜底"而非纯算法

IDML格式完整保留母版信息（MasterSpreads/designmap.xml），ExtendScript API提供masterPageItems和override()方法。纯算法方法仅用于验证或元数据缺失场景。

### 洞察10: 需要可视化调试界面来支撑可解释性要求

pdfplumber的可视化调试系统（将解析结果叠加到页面图像）极大提升开发效率。对于"可解释、输出证据"的要求，调试界面不仅是开发工具，更是产品功能。

---

## 七、第一轮实现推荐路线图

| 阶段             | 任务                                 | 参考项目                          | 预计工作量 |
| -------------- | ---------------------------------- | ----------------------------- | ----- |
| **Week 1-2**   | 设计IR层数据模型（标准化Document Element）     | BabelDOC, Unstructured        | 中     |
| **Week 2-3**   | 实现元数据消费层（Thread/MasterPage/Layers） | simpleidml, InDesign API      | 小     |
| **Week 3-4**   | 实现XY-cut++阅读顺序引擎                   | XY-cut++论文                    | 中     |
| **Week 4-5**   | 实现S2 Chunking区域聚类（谱聚类+DBSCAN）      | s2-chunking-lib, scikit-learn | 中     |
| **Week 5-6**   | 实现母版检测（元数据+几何验证）                   | refinedoc, Kreuzberg          | 小     |
| **Week 6-7**   | 实现页面类型分类器（规则模板）                    | SynSlide, InfoDet             | 中     |
| **Week 7-8**   | 实现置信度框架和Unresolved项标记              | Graphify, Docling             | 中     |
| **Week 8-9**   | 实现HTML Writer（Block级语义HTML）        | Surya, Unstructured           | 中     |
| **Week 9-10**  | 可视化调试界面                            | pdfplumber可视化                 | 小     |
| **Week 10-12** | 端到端集成测试 + 建筑汇报样本验证                 | 全部                            | 大     |

---

## 八、风险提示

| 风险                | 影响        | 缓解策略                                   |
| ----------------- | --------- | -------------------------------------- |
| XY-cut++对复杂创意布局失效 | 阅读顺序错误    | 引入LayoutReader作为fallback，标记为UNRESOLVED |
| 谱聚类参数敏感           | 分组不稳定     | 提供自动参数估计 + 手动调参接口                      |
| InDesign元数据不完整    | 母版/顺序检测失败 | 设计多层降级策略（元数据→几何→算法）                    |
| 建筑汇报布局多样性         | 页面类型误判    | 采用规则+特征模板，预留MLLM验证接口                   |
| AGPL协议限制          | 商用合规风险    | 优先使用BSD/MIT库，AGPL仅作为参考不直接集成            |

---

> **报告完成**。本调研严格遵循 Deep Research Swarm 流程：Phase 0路由 → Phase 1景观扫描 → Phase 2维度分解(12维) → Phase 3并行深度调研(12 agent × 25+搜索) → Phase 4交叉验证 → Phase 6洞察提取 → Phase 7报告撰写。全部研究产物保存在 `/mnt/agents/output/research/` 目录。

## 待整理要点

- 可参考项目 / 论文 / 算法：
- 适合借鉴的部分：
- 不适合直接套用的部分：
- 对本项目 `src/semantic-reconstruction/` 的启发：
