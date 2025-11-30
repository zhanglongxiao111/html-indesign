## ADDED Requirements

### Requirement: Master Page Existence Check
校验引擎 SHALL 拒绝任何引用了 Blueprint 中不存在的母版名称的 HTML 结构。

#### Scenario: 引用不存在的母版
- **WHEN** 输入 HTML 包含 `<section data-master="Unknown-Master">`
- **AND** Blueprint 的 `masters` 列表中不包含 "Unknown-Master"
- **THEN** 校验结果必须为 Failed
- **AND** 错误报告必须包含 `MASTER_NOT_FOUND` 错误代码

### Requirement: Slot Consistency Check
校验引擎 SHALL 验证 HTML 中的每个槽位 (`data-slot`) 是否在对应的母版定义中存在。

#### Scenario: 拼写错误的槽位名
- **WHEN** 输入 HTML 在 "Cover-A" 母版下包含 `<div data-slot="Titl">` (拼写错误)
- **AND** Blueprint 中 "Cover-A" 的可用槽位为 ["Title", "Subtitle"]
- **THEN** 校验结果必须为 Failed
- **AND** 错误报告必须提示 "Titl" 不存在，并建议 "Title"

### Requirement: Content Type Validation
校验引擎 SHALL 验证填充内容的类型是否与 Blueprint 定义的类型兼容。

#### Scenario: 图片槽位放入纯文本
- **WHEN** 输入 HTML 在定义为 `type: image` 的 "Hero" 槽位中放置了纯文本节点而不是 `<img>` 标签
- **THEN** 校验结果必须为 Failed
- **AND** 错误报告必须提示类型不匹配 (Expected: Image, Got: Text)

### Requirement: Standardized Error Reporting
校验引擎 SHALL 以机器可读的结构化 JSON 格式返回错误报告，以便 AI Agent 自我修正。

#### Scenario: 返回结构化错误
- **WHEN** 检测到任何校验错误（如槽位缺失）
- **THEN** 输出必须包含 `valid: false`
- **AND** `errors` 数组中的每一项必须包含 `code` (如 "SLOT_NOT_FOUND")
- **AND** 必须包含 `location` (指出是哪个母版或元素)
- **AND** 必须包含 `message` (人类可读描述)
- **AND** 如果可能，SHOULD 包含 `suggestion` (例如 "Did you mean 'Title'?")
