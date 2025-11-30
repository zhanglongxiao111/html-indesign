## 1. Define Protocols (Docs & Types)
- [x] 1.1 定义 Blueprint JSON 的 TypeScript 接口 (`src/types/blueprint.ts`)。
- [x] 1.2 定义 HTML Tagging 的常量枚举 (`src/types/tags.ts`)。
- [x] 1.3 **[UPDATE]** 扩展 Blueprint 接口以支持 `paragraphStyles/characterStyles/objectStyles` 和 `staticItems`。

## 2. Implement Blueprint Extraction (Advanced)
- [x] 2.1 **[REFACTOR]** 重构 `_indesign_scripts/extract_blueprint.jsx`。
- [x] 2.2 实现 `Color` -> `Hex/RGB` 转换算法。
- [x] 2.3 实现 `ParagraphStyle` -> `CSS` 转换逻辑。
- [x] 2.4 实现无 Label 静态元素的提取。
- [x] 2.5 实现 Slot 的样式引用。

## 3. Implement Validation Logic
- [x] 3.1 开发 `src/validator.js`，实现母版存在性检查。
- [x] 3.2 实现槽位匹配检查。
- [x] 3.3 实现基本的文本长度/图片类型检查。
- [x] 3.4 **[UPDATE]** 适配新的 JSON 结构进行回归测试。

## 4. Integration Test
- [x] 4.1 创建测试用例：一个合法的 HTML 和一个非法的 HTML，验证校验器能否正确通过/拒绝。
- [x] 4.2 **[NEW]** 验证样式提取的准确性（生成的 JSON 是否包含预期的 CSS 属性）。

## 5. Implement Reference Generator
- [x] 5.1 开发 `src/generator.js`，实现从 Blueprint JSON 到 HTML 的转换。
- [x] 5.2 实现 CSS 注入逻辑（将 `paragraphStyles` 转换为 `<style>`）。
- [x] 5.3 实现静态元素渲染（Static Items -> Absolute Divs）。
- [x] 5.4 实现 Reference Slots 渲染（Slots -> Editable Divs with Comments）。
- [x] 5.5 测试生成器，输出 HTML 并验证结构。
- [x] 5.6 **[REFACTOR]** 重构生成器：支持多文件输出，修复字体 CSS，隐藏 Label，优先渲染原始内容。
