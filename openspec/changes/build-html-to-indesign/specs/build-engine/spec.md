## ADDED Requirements

### Requirement: Build Instruction Format
系统 SHALL 定义 HTML → InDesign 的构建指令 JSON，作为执行器的唯一输入，支持多页合并批量输出并保持 HTML 顺序。

#### Scenario: 基本构建指令
- **WHEN** content.html 解析完成
- **THEN** 生成的指令 MUST 包含有序的 `pages` 数组
- **AND** 每个页面项 MUST 指定 `master`（母版名）或 `template: "free"`（自由页）
- **AND** 每个页面项 MUST 包含 `items` 数组，其中固定母版使用 `slot` 字段定位，内容包含文本或图片路径
- **AND** 指令 MUST 可序列化为单个 JSON 文件供 JSX 执行器消费
- **AND** 页面顺序 MUST 遵循 HTML 中 section 的出现顺序；执行器 MUST 按该顺序追加页面，不删除已存在页面

### Requirement: Fixed Master Page Build
执行器 SHALL 基于构建指令填充已有母版的槽位，生成新页面。

#### Scenario: 填充封面母版
- **WHEN** 指令包含一页 `master: "A-Cover"`，`items` 含 `{ slot: "Title", type: "TEXT", content: "Hello" }` 与 `{ slot: "Hero", type: "IMAGE", src: "hero.jpg" }`
- **THEN** 执行器 MUST 创建页面并套用母版 "A-Cover"
- **AND** 将文本填入槽位 "Title"，将图片置入槽位 "Hero"（保持框尺寸，必要时按裁剪/适配策略）
- **AND** 若槽位不存在或类型不匹配，执行器 MUST 以结构化错误报告并终止该页填充

### Requirement: Free Template Page Build
执行器 SHALL 支持“自由页”模板，通过指令描述要创建的新元素，并套用指定的自由模板母版。

#### Scenario: 动态创建文本与图片框
- **WHEN** 指令包含一页 `template: "free"` 且指定自由模板母版（例如 `master: "Free-Template"`），`items` 含 `{ type: "TEXT", bounds: {x,y,width,height}, content: "Body" }` 与 `{ type: "IMAGE", bounds: {...}, src: "cover.png" }`
- **THEN** 执行器 MUST 创建页面并套用该自由模板母版
- **AND** MUST 为每个文本项新建文本框，应用提供的样式/内联样式并写入文本
- **AND** MUST 为每个图片项新建图形框，置入图片，按 `fit` 或 `fill` 策略保持框尺寸
- **AND** 执行器 MUST 按 `zIndex`（如提供）叠放元素，未提供时使用插入顺序递增
