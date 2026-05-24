# InDesign Executor Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 升级 `_indesign_scripts/build_from_instructions.jsx`，让它通过 `cli-anything-indesign` 消费新 `Paged HTML -> Build Instructions` schema，并在真实 InDesign 中创建页面、样式、图形框、文本框和 linked placed assets。

**架构：** Node 侧继续负责 HTML、CSS、布局、语义推理和 instructions 校验；ExtendScript 侧只执行已校验的 JSON。`build_from_instructions.jsx` 改为薄 bootstrap，实际逻辑拆到 `_indesign_scripts/lib/*.jsxinc`，并保留旧 instructions 的结构化分流入口。

**技术栈：** Node.js CommonJS、`node:test`、ExtendScript JSX/JSXINC、Adobe InDesign DOM、`cli-anything-indesign`。

---

## 范围确认

本计划合并“样式执行器”和“置入资源执行器”：

- 创建或复用 InDesign document/page/layer。
- 创建 swatches、paragraph styles、character styles、object styles。
- 按 instructions 创建 `TEXT`、`GRAPHIC`、`SHAPE` 对象。
- 文本支持段落样式和 run 级字符样式。
- 图形支持 linked PDF/SVG/图片/PSD/AI 置入的统一路径、页码/crop/artboard/layerComp 字段的最佳可执行映射。
- 输出结构化执行报告，优先从 CLI 的 `data.result_json` 读取。
- 用 `cli-anything-indesign script run _indesign_scripts\build_from_instructions.jsx` 做真实 InDesign smoke 验证。

本计划不实现：

- HTML 解析、CSS cascade、浏览器布局。
- 任意网页分页。
- SVG path 拆解为 native InDesign path。
- PSD/AI 内部图层编辑重建。
- 完整 InDesign -> HTML 反向转换。

## 文件结构

```text
_indesign_scripts/
  build_from_instructions.jsx       # 薄 bootstrap：读取路径、加载 lib、返回 JSON
  lib/
    hi_core.jsxinc                  # namespace、JSON、report、label、单位工具
    hi_document.jsxinc              # document/page/layer 创建与测量单位保护
    hi_styles.jsxinc                # swatch/font/style 创建和样式应用
    hi_assets.jsxinc                # asset 路径解析、place preferences、fitting
    hi_items.jsxinc                 # TEXT/GRAPHIC/SHAPE 创建、zIndex、label
    hi_executor.jsxinc              # 新 schema 执行主流程和旧 schema 结构化分流

src/
  paged-html/
    instructions-validator.js       # 增加可选资产文件存在性校验

test/
  indesign-executor/
    executor-fixture-writer.js      # 写入真实 InDesign smoke 所需 instructions 和测试资产
    executor-fixture-writer.test.js # 校验 fixture writer 输出符合 instructions schema
    executor-script-static.test.js  # 校验 JSX bootstrap/lib 模块边界和 API 名称
```

模块边界：

| 模块 | 职责 | 不做什么 |
| ---- | ---- | -------- |
| `instructions-validator.js` | Node 侧 preflight：引用一致性、可选资产文件存在性 | 不读取 InDesign，不修复数据 |
| `hi_core.jsxinc` | ExtendScript 基础工具和 report contract | 不创建页面对象 |
| `hi_document.jsxinc` | document/page/layer 与单位设置 | 不处理样式字段 |
| `hi_styles.jsxinc` | 把 style model 落到 InDesign 样式资源 | 不创建页面对象 |
| `hi_assets.jsxinc` | 解析和 place 外部资源 | 不判断 DOM 语义 |
| `hi_items.jsxinc` | 从 instructions item 创建 InDesign page item | 不读取 JSON 文件 |
| `hi_executor.jsxinc` | 串起读取、样式、页面、对象、报告 | 不包含底层 DOM 细节 |

---

### 任务 1：Node 侧资产 preflight 与 smoke fixture writer

**文件：**
- 修改：`D:\AI\html-indesign\src\paged-html\instructions-validator.js`
- 新建：`D:\AI\html-indesign\test\indesign-executor\executor-fixture-writer.js`
- 新建：`D:\AI\html-indesign\test\indesign-executor\executor-fixture-writer.test.js`

- [ ] **步骤 1：写失败的 fixture writer 与资产 preflight 测试**

创建 `test/indesign-executor/executor-fixture-writer.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateInstructions } = require('../../src/paged-html');
const { writeExecutorSmokeWorkspace } = require('./executor-fixture-writer');

test('writeExecutorSmokeWorkspace writes valid instructions and local placeable assets', () => {
  const workspaceDir = path.resolve(__dirname, '../workspace/indesign-executor-smoke');
  const result = writeExecutorSmokeWorkspace(workspaceDir);

  assert.equal(fs.existsSync(result.instructionsPath), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'executor-assets/site-plan.pdf')), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'executor-assets/diagram.svg')), true);
  assert.equal(result.instructions.pages[0].items.length, 4);

  const validation = validateInstructions(result.instructions, {
    checkAssetFiles: true,
    baseDir: workspaceDir,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
});

test('validateInstructions reports missing asset files when asset preflight is enabled', () => {
  const instructions = {
    metadata: {},
    document: { pages: [{ id: 'p1', width: 100, height: 100 }] },
    styles: {
      swatches: {},
      fonts: {},
      compositeFonts: {},
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets: [{ id: 'missing-pdf', resolvedPath: 'assets/missing.pdf' }],
    layers: [],
    pages: [{
      id: 'p1',
      items: [{
        id: 'g1',
        type: 'GRAPHIC',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        placed: { assetId: 'missing-pdf' },
        zIndex: 1,
      }],
    }],
  };

  const result = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: __dirname,
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'ASSET_FILE_NOT_FOUND'), true);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node --test test/indesign-executor/executor-fixture-writer.test.js
```

预期：FAIL，失败点为 `Cannot find module './executor-fixture-writer'` 或 `ASSET_FILE_NOT_FOUND` 未实现。

- [ ] **步骤 3：实现 fixture writer**

创建 `test/indesign-executor/executor-fixture-writer.js`：

```js
const fs = require('fs');
const path = require('path');

function writeExecutorSmokeWorkspace(workspaceDir = path.resolve(__dirname, '../workspace/indesign-executor-smoke')) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  const assetsDir = path.join(workspaceDir, 'executor-assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'site-plan.pdf'), createTinyPdf('Site Plan'), 'ascii');
  fs.writeFileSync(path.join(assetsDir, 'diagram.svg'), createTinySvg(), 'utf8');

  const instructions = createSmokeInstructions();
  const instructionsPath = path.join(workspaceDir, 'instructions.json');
  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2), 'utf8');

  return {
    workspaceDir,
    assetsDir,
    instructionsPath,
    instructions,
  };
}

function createSmokeInstructions() {
  return {
    metadata: {
      source: 'indesign-executor-smoke',
      mode: 'editable-first',
      compiler: 'html-indesign/test-fixture',
    },
    document: {
      pages: [{ id: 'executor-page-1', width: 210, height: 120 }],
    },
    styles: {
      swatches: {
        'color-123456': { name: 'color-123456', model: 'process', space: 'RGB', value: '#123456' },
        'color-c8102e': { name: 'color-c8102e', model: 'process', space: 'RGB', value: '#c8102e' },
        'color-f2f2f2': { name: 'color-f2f2f2', model: 'process', space: 'RGB', value: '#f2f2f2' },
      },
      fonts: {
        Arial: { family: 'Arial', fallback: 'Arial' },
      },
      compositeFonts: {},
      paragraphStyles: {
        'report-title': {
          name: 'report-title',
          appliedFont: 'Arial',
          pointSize: 24,
          leading: 28,
          fontWeight: '700',
          fontStyle: 'normal',
          fillColor: 'color-123456',
          justification: 'left',
          tracking: 0,
          spaceBefore: 0,
          spaceAfter: 0,
        },
      },
      characterStyles: {
        accent: {
          name: 'accent',
          appliedFont: 'Arial',
          pointSize: 24,
          fontWeight: '700',
          fontStyle: 'italic',
          fillColor: 'color-c8102e',
          tracking: 0,
          verticalPosition: 'baseline',
          textDecoration: 'none',
        },
      },
      objectStyles: {
        'metric-card': {
          name: 'metric-card',
          fillColor: 'color-f2f2f2',
          strokeColor: 'color-123456',
          strokeWeight: 1,
          strokeStyle: 'solid',
          cornerRadius: '0px',
          opacity: 1,
          overflow: 'visible',
        },
      },
      frameStyles: {
        'drawing-frame': {
          name: 'drawing-frame',
          fit: 'contain',
          position: '50% 50%',
          inset: { top: 0, right: 0, bottom: 0, left: 0 },
          overflow: 'hidden',
        },
      },
      tableStyles: {},
      cellStyles: {},
    },
    assets: [
      {
        id: 'asset-site-plan-pdf',
        src: 'executor-assets/site-plan.pdf',
        resolvedPath: 'executor-assets/site-plan.pdf',
        kind: 'pdf',
        fileName: 'site-plan.pdf',
        linked: true,
        placement: { fit: 'contain', position: '50% 50%', pageNumber: 1, crop: 'trim', preserveVector: true },
      },
      {
        id: 'asset-diagram-svg',
        src: 'executor-assets/diagram.svg',
        resolvedPath: 'executor-assets/diagram.svg',
        kind: 'svg',
        fileName: 'diagram.svg',
        linked: true,
        placement: { fit: 'contain', position: '50% 50%', preserveVector: true },
      },
    ],
    layers: [
      { name: 'background', order: 0 },
      { name: 'graphics', order: 1 },
      { name: 'text', order: 2 },
    ],
    pages: [{
      id: 'executor-page-1',
      index: 0,
      width: 210,
      height: 120,
      items: [
        {
          id: 'card-background',
          role: 'shape',
          type: 'SHAPE',
          bounds: { x: 10, y: 10, width: 190, height: 100 },
          objectStyle: 'metric-card',
          layer: 'background',
          zIndex: 1,
        },
        {
          id: 'title',
          role: 'text',
          type: 'TEXT',
          bounds: { x: 16, y: 16, width: 110, height: 18 },
          text: '建筑设计汇报重点',
          paragraphStyle: 'report-title',
          runs: [
            { text: '建筑设计汇报', characterStyle: null },
            { text: '重点', characterStyle: 'accent' },
          ],
          layer: 'text',
          zIndex: 30,
        },
        {
          id: 'site-plan',
          role: 'graphic',
          type: 'GRAPHIC',
          bounds: { x: 16, y: 42, width: 88, height: 58 },
          objectStyle: 'metric-card',
          frameStyle: 'drawing-frame',
          placed: { assetId: 'asset-site-plan-pdf', fit: 'contain', position: '50% 50%', pageNumber: 1, crop: 'trim', preserveVector: true },
          layer: 'graphics',
          zIndex: 20,
        },
        {
          id: 'diagram',
          role: 'graphic',
          type: 'GRAPHIC',
          bounds: { x: 114, y: 42, width: 72, height: 58 },
          objectStyle: 'metric-card',
          frameStyle: 'drawing-frame',
          placed: { assetId: 'asset-diagram-svg', fit: 'contain', position: '50% 50%', preserveVector: true },
          layer: 'graphics',
          zIndex: 21,
        },
      ],
    }],
    warnings: [],
  };
}

function createTinySvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">',
    '<rect x="0" y="0" width="200" height="120" fill="#f2f2f2"/>',
    '<path d="M20 95 L90 30 L180 95 Z" fill="#123456" opacity="0.85"/>',
    '<circle cx="90" cy="52" r="12" fill="#c8102e"/>',
    '</svg>',
  ].join('');
}

function createTinyPdf(label) {
  const content = `BT /F1 18 Tf 20 50 Td (${escapePdfText(label)}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return body;
}

function escapePdfText(value) {
  return String(value).replace(/[\\()]/g, '\\$&');
}

module.exports = {
  writeExecutorSmokeWorkspace,
  createSmokeInstructions,
};
```

- [ ] **步骤 4：扩展 instructions validator 的资产文件校验**

修改 `src/paged-html/instructions-validator.js`：

```js
const fs = require('fs');
const path = require('path');

function validateInstructions(instructions, options = {}) {
  const errors = [];
  const styles = instructions.styles || {};
  const documentPages = instructions.document && Array.isArray(instructions.document.pages)
    ? instructions.document.pages
    : [];
  const pageIds = new Set(documentPages.map((page) => page.id));
  const assetIds = new Set((instructions.assets || []).map((asset) => asset.id));

  if (documentPages.length === 0) {
    errors.push({
      code: 'DOCUMENT_PAGE_MISSING',
      message: 'instructions.document.pages must contain at least one page.',
    });
  }

  if (options.checkAssetFiles) {
    validateAssetFiles(instructions.assets || [], options, errors);
  }

  for (const page of instructions.pages || []) {
    if (!pageIds.has(page.id)) {
      errors.push({
        code: 'PAGE_NOT_IN_DOCUMENT',
        message: `Page '${page.id}' is missing from instructions.document.pages.`,
        pageId: page.id,
      });
    }
    for (const item of page.items || []) {
      validateBounds(item, errors);
      validateStyleRefs(item, styles, errors);
      validatePlacedAsset(item, assetIds, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateAssetFiles(assets, options, errors) {
  const baseDir = options.baseDir || process.cwd();
  for (const asset of assets) {
    const candidate = resolveInstructionAssetPath(asset, baseDir);
    if (!candidate || !fs.existsSync(candidate)) {
      errors.push({
        code: 'ASSET_FILE_NOT_FOUND',
        message: `Asset '${asset.id}' file was not found.`,
        assetId: asset.id,
        path: candidate || asset.resolvedPath || asset.src,
      });
    }
  }
}

function resolveInstructionAssetPath(asset, baseDir) {
  const raw = asset && (asset.resolvedPath || asset.src);
  if (!raw) return null;
  if (/^[a-z]+:\/\//i.test(raw)) return raw;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(baseDir, raw);
}

function validateBounds(item, errors) {
  const bounds = item.bounds;
  const valid = bounds
    && Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width >= 0
    && bounds.height >= 0;
  if (!valid) {
    errors.push({
      code: 'INVALID_BOUNDS',
      message: `Item '${item.id}' has invalid bounds.`,
      itemId: item.id,
    });
  }
}

function validateStyleRefs(item, styles, errors) {
  if (item.type === 'TEXT' && item.paragraphStyle && !(styles.paragraphStyles || {})[item.paragraphStyle]) {
    errors.push({
      code: 'PARAGRAPH_STYLE_NOT_FOUND',
      message: `Paragraph style '${item.paragraphStyle}' was not found.`,
      itemId: item.id,
      styleName: item.paragraphStyle,
    });
  }
  for (const run of item.runs || []) {
    if (run.characterStyle && !(styles.characterStyles || {})[run.characterStyle]) {
      errors.push({
        code: 'CHARACTER_STYLE_NOT_FOUND',
        message: `Character style '${run.characterStyle}' was not found.`,
        itemId: item.id,
        styleName: run.characterStyle,
      });
    }
  }
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.objectStyle && !(styles.objectStyles || {})[item.objectStyle]) {
    errors.push({
      code: 'OBJECT_STYLE_NOT_FOUND',
      message: `Object style '${item.objectStyle}' was not found.`,
      itemId: item.id,
      styleName: item.objectStyle,
    });
  }
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.frameStyle && !(styles.frameStyles || {})[item.frameStyle]) {
    errors.push({
      code: 'FRAME_STYLE_NOT_FOUND',
      message: `Frame style '${item.frameStyle}' was not found.`,
      itemId: item.id,
      styleName: item.frameStyle,
    });
  }
}

function validatePlacedAsset(item, assetIds, errors) {
  if (item.type !== 'GRAPHIC' || !item.placed || !item.placed.assetId) return;
  if (!assetIds.has(item.placed.assetId)) {
    errors.push({
      code: 'ASSET_NOT_FOUND',
      message: `Placed asset '${item.placed.assetId}' was not found.`,
      itemId: item.id,
      assetId: item.placed.assetId,
    });
  }
}

module.exports = {
  validateInstructions,
  resolveInstructionAssetPath,
};
```

- [ ] **步骤 5：运行测试并确认通过**

运行：

```bash
node --test test/indesign-executor/executor-fixture-writer.test.js test/paged-html/instructions-validator.test.js
```

预期：PASS。`test/workspace/indesign-executor-smoke/` 是 ignored 输出，不进入提交。

- [ ] **步骤 6：提交**

```bash
git add src/paged-html/instructions-validator.js test/indesign-executor/executor-fixture-writer.js test/indesign-executor/executor-fixture-writer.test.js
git commit -m "feat: add indesign executor smoke fixtures"
```

---

### 任务 2：拆分 ExtendScript bootstrap 与核心工具

**文件：**
- 修改：`D:\AI\html-indesign\_indesign_scripts\build_from_instructions.jsx`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_core.jsxinc`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_document.jsxinc`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_styles.jsxinc`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_assets.jsxinc`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_items.jsxinc`
- 新建：`D:\AI\html-indesign\_indesign_scripts\lib\hi_executor.jsxinc`
- 新建：`D:\AI\html-indesign\test\indesign-executor\executor-script-static.test.js`

- [ ] **步骤 1：写失败的 static script 测试**

创建 `test/indesign-executor/executor-script-static.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const scriptPath = path.join(root, '_indesign_scripts/build_from_instructions.jsx');
const libDir = path.join(root, '_indesign_scripts/lib');

test('build_from_instructions.jsx is a thin bootstrap that loads executor libs', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  for (const name of [
    'hi_core.jsxinc',
    'hi_document.jsxinc',
    'hi_styles.jsxinc',
    'hi_assets.jsxinc',
    'hi_items.jsxinc',
    'hi_executor.jsxinc',
  ]) {
    assert.match(source, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(source, /HI\.runBuildFromInstructions/);
  assert.equal(source.includes('slotNameFromLabel'), false);
});

test('executor lib files expose expected HI APIs and stay focused', () => {
  const expectations = {
    'hi_core.jsxinc': ['HI.readJsonFile', 'HI.stringify', 'HI.makeReport', 'HI.boundsToGeometricBounds'],
    'hi_document.jsxinc': ['HI.prepareDocument', 'HI.ensureLayers', 'HI.getPageForInstruction'],
    'hi_styles.jsxinc': ['HI.ensureStyles', 'HI.applyParagraphStyle', 'HI.applyObjectStyle'],
    'hi_assets.jsxinc': ['HI.resolveAssetFile', 'HI.placeAssetInFrame', 'HI.applyFitting'],
    'hi_items.jsxinc': ['HI.buildInstructionItems', 'HI.createTextFrame', 'HI.createGraphicFrame'],
    'hi_executor.jsxinc': ['HI.runBuildFromInstructions', 'HI.runLegacyBuildInstructions'],
  };

  for (const [fileName, apiNames] of Object.entries(expectations)) {
    const filePath = path.join(libDir, fileName);
    assert.equal(fs.existsSync(filePath), true, `${fileName} should exist`);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const apiName of apiNames) {
      assert.match(source, new RegExp(apiName.replace('.', '\\.')));
    }
    assert.ok(source.split(/\r?\n/).length <= 260, `${fileName} should stay small`);
  }
});
```

- [ ] **步骤 2：运行 static script 测试并确认失败**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：FAIL，失败点为 `_indesign_scripts/lib/*.jsxinc` 缺失。

- [ ] **步骤 3：把 `build_from_instructions.jsx` 改成薄 bootstrap**

将 `_indesign_scripts/build_from_instructions.jsx` 替换为：

```js
/**
 * build_from_instructions.jsx
 * Thin bootstrap for html-indesign build instructions.
 */
(function () {
    var uiOld = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    try {
        var scriptFile = File($.fileName);
        var scriptDir = scriptFile.parent;
        function includeLib(name) {
            var lib = File(scriptDir.fsName + "/lib/" + name);
            if (!lib.exists) {
                throw new Error("Missing executor lib: " + lib.fsName);
            }
            $.evalFile(lib);
        }

        includeLib("hi_core.jsxinc");
        includeLib("hi_document.jsxinc");
        includeLib("hi_styles.jsxinc");
        includeLib("hi_assets.jsxinc");
        includeLib("hi_items.jsxinc");
        includeLib("hi_executor.jsxinc");

        var jsonPath = "D:/AI/html-indesign/test/workspace/instructions.json";
        try {
            if (typeof defaultJsonPath !== "undefined" && defaultJsonPath) {
                jsonPath = defaultJsonPath;
            }
        } catch (_) {}
        try {
            if (app.documents.length > 0) {
                var labelPath = app.activeDocument.extractLabel("build_json_path");
                if (labelPath) jsonPath = labelPath;
            }
        } catch (_) {}

        var result = HI.runBuildFromInstructions(app, jsonPath);
        return HI.stringify(result);
    } catch (error) {
        var fallback = {
            ok: false,
            errors: [{ code: "BOOTSTRAP_ERROR", message: String(error) }],
            messages: [String(error)]
        };
        try {
            if (typeof HI !== "undefined" && HI.stringify) return HI.stringify(fallback);
        } catch (_) {}
        return '{"ok":false,"errors":[{"code":"BOOTSTRAP_ERROR","message":"bootstrap failed"}]}';
    } finally {
        app.scriptPreferences.userInteractionLevel = uiOld;
    }
})();
```

- [ ] **步骤 4：创建 `hi_core.jsxinc`**

创建 `_indesign_scripts/lib/hi_core.jsxinc`，包含以下 API：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.stringify = function (value) {
    if (typeof JSON !== "undefined" && JSON.stringify) {
        return JSON.stringify(value);
    }
    return String(value);
};

HI.parseJson = function (raw) {
    if (typeof JSON !== "undefined" && JSON.parse) {
        return JSON.parse(raw);
    }
    return eval("(" + raw + ")");
};

HI.readJsonFile = function (jsonPath) {
    var file = File(jsonPath);
    if (!file.exists) {
        throw new Error("Instructions file not found: " + jsonPath);
    }
    if (!file.open("r")) {
        throw new Error("Cannot open instructions file: " + file.fsName);
    }
    var raw = file.read();
    file.close();
    return {
        file: file,
        baseFolder: file.parent,
        data: HI.parseJson(raw)
    };
};

HI.makeReport = function () {
    return {
        ok: true,
        messages: [],
        errors: [],
        warnings: [],
        counts: {
            pages: 0,
            layers: 0,
            swatches: 0,
            paragraphStyles: 0,
            characterStyles: 0,
            objectStyles: 0,
            textFrames: 0,
            graphicFrames: 0,
            shapes: 0,
            placedAssets: 0,
            missingAssets: 0,
            oversetTextFrames: 0
        }
    };
};

HI.addMessage = function (report, level, code, message, details) {
    var entry = { level: level, code: code, message: message, details: details || {} };
    report.messages.push(entry);
    if (level === "error") {
        report.ok = false;
        report.errors.push(entry);
    }
    if (level === "warning") {
        report.warnings.push(entry);
    }
    return entry;
};

HI.boundsToGeometricBounds = function (bounds) {
    return [Number(bounds.y), Number(bounds.x), Number(bounds.y) + Number(bounds.height), Number(bounds.x) + Number(bounds.width)];
};

HI.insertJsonLabel = function (target, key, value) {
    try {
        target.insertLabel(key, HI.stringify(value));
    } catch (_) {}
};

HI.itemLabel = function (item) {
    return "html-indesign:id=" + item.id + ";role=" + (item.role || "") + ";type=" + (item.type || "");
};
```

- [ ] **步骤 5：创建其余 lib 文件的 API 骨架**

创建以下文件，先只放 API 骨架，让 static test 通过模块存在性检查，后续任务填充实现：

`_indesign_scripts/lib/hi_document.jsxinc`：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.prepareDocument = function (appRef, instructions, report) {
    var doc = appRef.documents.length > 0 ? appRef.activeDocument : appRef.documents.add();
    return { doc: doc, pages: [], layers: {} };
};

HI.ensureLayers = function (doc, layers, report) {
    return {};
};

HI.getPageForInstruction = function (doc, pageInstruction, index, report) {
    return doc.pages[index] || doc.pages.add(LocationOptions.AT_END);
};
```

`_indesign_scripts/lib/hi_styles.jsxinc`：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.ensureStyles = function (doc, styles, report) {
    return { swatches: {}, paragraphStyles: {}, characterStyles: {}, objectStyles: {} };
};

HI.applyParagraphStyle = function (doc, textFrame, styleName, report) {};

HI.applyObjectStyle = function (doc, pageItem, styleName, report) {};
```

`_indesign_scripts/lib/hi_assets.jsxinc`：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.resolveAssetFile = function (asset, baseFolder) {
    return File(asset.resolvedPath || asset.src);
};

HI.placeAssetInFrame = function (doc, frame, asset, placed, baseFolder, report) {
    return false;
};

HI.applyFitting = function (frame, fit, position) {};
```

`_indesign_scripts/lib/hi_items.jsxinc`：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.buildInstructionItems = function (doc, page, pageInstruction, context, report) {
    return [];
};

HI.createTextFrame = function (doc, page, item, context, report) {
    return null;
};

HI.createGraphicFrame = function (doc, page, item, context, report) {
    return null;
};
```

`_indesign_scripts/lib/hi_executor.jsxinc`：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.runBuildFromInstructions = function (appRef, jsonPath) {
    var input = HI.readJsonFile(jsonPath);
    if (input.data && input.data.document && input.data.styles) {
        return HI.runPagedHtmlBuildInstructions(appRef, input.data, input.baseFolder);
    }
    return HI.runLegacyBuildInstructions(appRef, input.data, input.baseFolder);
};

HI.runPagedHtmlBuildInstructions = function (appRef, instructions, baseFolder) {
    var report = HI.makeReport();
    HI.addMessage(report, "info", "PAGED_EXECUTOR_READY", "Paged HTML executor bootstrap loaded", {});
    return report;
};

HI.runLegacyBuildInstructions = function (appRef, instructions, baseFolder) {
    var report = HI.makeReport();
    HI.addMessage(report, "error", "LEGACY_EXECUTOR_MOVED", "Legacy instruction execution must be restored through compatibility code before use.", {});
    return report;
};
```

- [ ] **步骤 6：运行 static script 测试并确认通过**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add _indesign_scripts/build_from_instructions.jsx _indesign_scripts/lib test/indesign-executor/executor-script-static.test.js
git commit -m "refactor: split indesign executor bootstrap"
```

---

### 任务 3：实现 document、layer 和 style resource 执行

**文件：**
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_document.jsxinc`
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_styles.jsxinc`

- [ ] **步骤 1：实现 document 和 layer helper**

把 `_indesign_scripts/lib/hi_document.jsxinc` 扩展为：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.prepareDocument = function (appRef, instructions, report) {
    var doc = appRef.documents.length > 0 ? appRef.activeDocument : appRef.documents.add();
    var oldH = doc.viewPreferences.horizontalMeasurementUnits;
    var oldV = doc.viewPreferences.verticalMeasurementUnits;
    var oldOrigin = doc.viewPreferences.rulerOrigin;

    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;

    var firstPage = instructions.document && instructions.document.pages && instructions.document.pages[0];
    if (firstPage) {
        try {
            doc.documentPreferences.pageWidth = String(firstPage.width) + "mm";
            doc.documentPreferences.pageHeight = String(firstPage.height) + "mm";
            doc.documentPreferences.facingPages = false;
        } catch (error) {
            HI.addMessage(report, "warning", "DOCUMENT_SIZE_SET_FAILED", String(error), {});
        }
    }

    var layers = HI.ensureLayers(doc, instructions.layers || [], report);
    return {
        doc: doc,
        layers: layers,
        oldUnits: { h: oldH, v: oldV, origin: oldOrigin }
    };
};

HI.restoreDocumentPreferences = function (doc, context) {
    try {
        doc.viewPreferences.horizontalMeasurementUnits = context.oldUnits.h;
        doc.viewPreferences.verticalMeasurementUnits = context.oldUnits.v;
        doc.viewPreferences.rulerOrigin = context.oldUnits.origin;
    } catch (_) {}
};

HI.ensureLayers = function (doc, layers, report) {
    var out = {};
    var ordered = layers.slice(0).sort(function (a, b) {
        return Number(a.order || 0) - Number(b.order || 0);
    });
    for (var i = 0; i < ordered.length; i++) {
        var name = ordered[i].name || "content";
        var layer = doc.layers.itemByName(name);
        try {
            layer.name;
        } catch (_) {
            layer = doc.layers.add({ name: name });
            report.counts.layers += 1;
        }
        out[name] = layer;
    }
    return out;
};

HI.getPageForInstruction = function (doc, pageInstruction, index, report) {
    while (doc.pages.length <= index) {
        doc.pages.add(LocationOptions.AT_END);
    }
    var page = doc.pages[index];
    try {
        page.name = String(index + 1);
    } catch (_) {}
    report.counts.pages = Math.max(report.counts.pages, index + 1);
    return page;
};
```

- [ ] **步骤 2：实现 style helper**

把 `_indesign_scripts/lib/hi_styles.jsxinc` 扩展为：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.ensureStyles = function (doc, styles, report) {
    styles = styles || {};
    var context = {
        swatches: HI.ensureSwatches(doc, styles.swatches || {}, report),
        paragraphStyles: HI.ensureParagraphStyles(doc, styles.paragraphStyles || {}, report),
        characterStyles: HI.ensureCharacterStyles(doc, styles.characterStyles || {}, report),
        objectStyles: HI.ensureObjectStyles(doc, styles.objectStyles || {}, report)
    };
    return context;
};

HI.ensureSwatches = function (doc, swatches, report) {
    var out = {};
    for (var name in swatches) {
        if (!swatches.hasOwnProperty(name)) continue;
        var def = swatches[name];
        var color = doc.colors.itemByName(def.name || name);
        try {
            color.name;
        } catch (_) {
            color = doc.colors.add({ name: def.name || name });
            report.counts.swatches += 1;
        }
        var rgb = HI.hexToRgb(def.value);
        if (rgb) {
            try {
                color.model = ColorModel.PROCESS;
                color.space = ColorSpace.RGB;
                color.colorValue = rgb;
            } catch (error) {
                HI.addMessage(report, "warning", "SWATCH_SET_FAILED", String(error), { name: name });
            }
        }
        out[name] = color;
    }
    return out;
};

HI.hexToRgb = function (value) {
    var match = String(value || "").match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) return null;
    var hex = match[1];
    return [
        parseInt(hex.substr(0, 2), 16),
        parseInt(hex.substr(2, 2), 16),
        parseInt(hex.substr(4, 2), 16)
    ];
};

HI.ensureParagraphStyles = function (doc, paragraphStyles, report) {
    var out = {};
    for (var name in paragraphStyles) {
        if (!paragraphStyles.hasOwnProperty(name)) continue;
        var def = paragraphStyles[name];
        var style = doc.paragraphStyles.itemByName(def.name || name);
        try {
            style.name;
        } catch (_) {
            style = doc.paragraphStyles.add({ name: def.name || name });
            report.counts.paragraphStyles += 1;
        }
        HI.assignTextStyleProperties(doc, style, def, report);
        out[name] = style;
    }
    return out;
};

HI.ensureCharacterStyles = function (doc, characterStyles, report) {
    var out = {};
    for (var name in characterStyles) {
        if (!characterStyles.hasOwnProperty(name)) continue;
        var def = characterStyles[name];
        var style = doc.characterStyles.itemByName(def.name || name);
        try {
            style.name;
        } catch (_) {
            style = doc.characterStyles.add({ name: def.name || name });
            report.counts.characterStyles += 1;
        }
        HI.assignTextStyleProperties(doc, style, def, report);
        out[name] = style;
    }
    return out;
};

HI.assignTextStyleProperties = function (doc, style, def, report) {
    try { if (def.pointSize !== null && typeof def.pointSize !== "undefined") style.pointSize = Number(def.pointSize); } catch (_) {}
    try { if (def.leading !== null && typeof def.leading !== "undefined") style.leading = Number(def.leading); } catch (_) {}
    try { if (def.tracking !== null && typeof def.tracking !== "undefined") style.tracking = Number(def.tracking); } catch (_) {}
    try { if (def.fillColor) style.fillColor = doc.swatches.itemByName(def.fillColor); } catch (_) {}
    try { if (def.justification) style.justification = HI.justificationFor(def.justification); } catch (_) {}
    try {
        if (def.appliedFont) {
            style.appliedFont = app.fonts.itemByName(def.appliedFont);
        }
    } catch (error) {
        HI.addMessage(report, "warning", "FONT_APPLY_FAILED", String(error), { font: def.appliedFont });
    }
};

HI.justificationFor = function (value) {
    var key = String(value || "").toLowerCase();
    if (key === "center") return Justification.CENTER_ALIGN;
    if (key === "right" || key === "end") return Justification.RIGHT_ALIGN;
    if (key === "justify") return Justification.FULLY_JUSTIFIED;
    return Justification.LEFT_ALIGN;
};

HI.ensureObjectStyles = function (doc, objectStyles, report) {
    var out = {};
    for (var name in objectStyles) {
        if (!objectStyles.hasOwnProperty(name)) continue;
        var def = objectStyles[name];
        var style = doc.objectStyles.itemByName(def.name || name);
        try {
            style.name;
        } catch (_) {
            style = doc.objectStyles.add({ name: def.name || name });
            report.counts.objectStyles += 1;
        }
        try { if (def.fillColor) style.fillColor = doc.swatches.itemByName(def.fillColor); } catch (_) {}
        try { if (def.strokeColor) style.strokeColor = doc.swatches.itemByName(def.strokeColor); } catch (_) {}
        try { if (def.strokeWeight !== null && typeof def.strokeWeight !== "undefined") style.strokeWeight = Number(def.strokeWeight); } catch (_) {}
        out[name] = style;
    }
    return out;
};

HI.applyParagraphStyle = function (doc, textFrame, styleName, report) {
    if (!styleName) return;
    try {
        textFrame.parentStory.paragraphs.everyItem().appliedParagraphStyle = doc.paragraphStyles.itemByName(styleName);
    } catch (error) {
        HI.addMessage(report, "warning", "PARAGRAPH_STYLE_APPLY_FAILED", String(error), { styleName: styleName });
    }
};

HI.applyCharacterStyleToRange = function (doc, textFrame, startIndex, length, styleName, report) {
    if (!styleName || length <= 0) return;
    try {
        var range = textFrame.parentStory.characters.itemByRange(startIndex, startIndex + length - 1);
        range.appliedCharacterStyle = doc.characterStyles.itemByName(styleName);
    } catch (error) {
        HI.addMessage(report, "warning", "CHARACTER_STYLE_APPLY_FAILED", String(error), { styleName: styleName });
    }
};

HI.applyObjectStyle = function (doc, pageItem, styleName, report) {
    if (!styleName) return;
    try {
        pageItem.appliedObjectStyle = doc.objectStyles.itemByName(styleName);
    } catch (error) {
        HI.addMessage(report, "warning", "OBJECT_STYLE_APPLY_FAILED", String(error), { styleName: styleName });
    }
};
```

- [ ] **步骤 3：运行 static script 测试**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：PASS。

- [ ] **步骤 4：提交**

```bash
git add _indesign_scripts/lib/hi_document.jsxinc _indesign_scripts/lib/hi_styles.jsxinc
git commit -m "feat: create indesign document styles from instructions"
```

---

### 任务 4：实现 asset place、item 创建和 zIndex

**文件：**
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_assets.jsxinc`
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_items.jsxinc`

- [ ] **步骤 1：实现 asset 解析、PDF place preferences 和 fitting**

把 `_indesign_scripts/lib/hi_assets.jsxinc` 扩展为：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.resolveAssetFile = function (asset, baseFolder) {
    var raw = asset.resolvedPath || asset.src || "";
    if (/^[a-zA-Z]:[\\\/]/.test(raw) || raw.indexOf("\\\\") === 0 || raw.charAt(0) === "/") {
        return File(raw);
    }
    return File(baseFolder.fsName + "/" + raw);
};

HI.findAssetById = function (assets, assetId) {
    for (var i = 0; i < assets.length; i++) {
        if (assets[i].id === assetId) return assets[i];
    }
    return null;
};

HI.placeAssetInFrame = function (doc, frame, asset, placed, baseFolder, report) {
    var file = HI.resolveAssetFile(asset, baseFolder);
    if (!file.exists) {
        report.counts.missingAssets += 1;
        HI.addMessage(report, "error", "ASSET_FILE_MISSING", "Asset file is missing", { assetId: asset.id, path: file.fsName });
        return false;
    }

    HI.configurePlacePreferences(asset, placed || asset.placement || {}, report);
    try {
        frame.place(file);
        report.counts.placedAssets += 1;
        HI.applyFitting(frame, (placed && placed.fit) || (asset.placement && asset.placement.fit), (placed && placed.position) || (asset.placement && asset.placement.position));
        return true;
    } catch (error) {
        HI.addMessage(report, "error", "ASSET_PLACE_FAILED", String(error), { assetId: asset.id, path: file.fsName });
        return false;
    }
};

HI.configurePlacePreferences = function (asset, placed, report) {
    var kind = String(asset.kind || "").toLowerCase();
    if (kind === "pdf" || kind === "ai") {
        try {
            if (placed.pageNumber) app.pdfPlacePreferences.pageNumber = Number(placed.pageNumber);
        } catch (_) {}
        try {
            var crop = HI.pdfCropFor(placed.crop);
            if (crop !== null) app.pdfPlacePreferences.pdfCrop = crop;
        } catch (error) {
            HI.addMessage(report, "warning", "PDF_CROP_APPLY_FAILED", String(error), { crop: placed.crop });
        }
    }
};

HI.pdfCropFor = function (value) {
    var key = String(value || "").toLowerCase();
    var constantName = "CROP_CONTENT";
    if (key === "media") constantName = "CROP_MEDIA";
    if (key === "bleed") constantName = "CROP_BLEED";
    if (key === "trim") constantName = "CROP_TRIM";
    if (key === "art") constantName = "CROP_ART";
    try {
        if (PDFCrop[constantName] !== undefined) return PDFCrop[constantName];
    } catch (_) {}
    return null;
};

HI.applyFitting = function (frame, fit, position) {
    var key = String(fit || "fill").toLowerCase();
    try {
        if (key === "contain") frame.fit(FitOptions.PROPORTIONALLY);
        else if (key === "cover") frame.fit(FitOptions.FILL_PROPORTIONALLY);
        else if (key === "fill") frame.fit(FitOptions.CONTENT_TO_FRAME);
    } catch (_) {}
    try {
        if (String(position || "").toLowerCase() === "50% 50%" || String(position || "").toLowerCase() === "center") {
            frame.fit(FitOptions.CENTER_CONTENT);
        }
    } catch (_) {}
};
```

- [ ] **步骤 2：实现 TEXT、GRAPHIC、SHAPE 创建**

把 `_indesign_scripts/lib/hi_items.jsxinc` 扩展为：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.buildInstructionItems = function (doc, page, pageInstruction, context, report) {
    var items = (pageInstruction.items || []).slice(0).sort(function (a, b) {
        return Number(a.zIndex || 0) - Number(b.zIndex || 0);
    });
    var created = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var pageItem = null;
        if (item.type === "TEXT") pageItem = HI.createTextFrame(doc, page, item, context, report);
        else if (item.type === "GRAPHIC") pageItem = HI.createGraphicFrame(doc, page, item, context, report);
        else if (item.type === "SHAPE") pageItem = HI.createShapeFrame(doc, page, item, context, report);
        if (pageItem) {
            created.push({ item: pageItem, zIndex: Number(item.zIndex || 0) });
        }
    }
    HI.applyZIndex(created);
    return created;
};

HI.createTextFrame = function (doc, page, item, context, report) {
    var frame = page.textFrames.add();
    frame.geometricBounds = HI.boundsToGeometricBounds(item.bounds);
    HI.assignLayer(frame, context, item.layer);
    var text = HI.textFromRuns(item);
    frame.contents = text;
    HI.applyParagraphStyle(doc, frame, item.paragraphStyle, report);
    HI.applyRuns(doc, frame, item.runs || [], report);
    try { frame.label = HI.itemLabel(item); } catch (_) {}
    if (frame.overflows) {
        report.counts.oversetTextFrames += 1;
        HI.addMessage(report, "warning", "TEXT_OVERSET", "Text frame is overset", { itemId: item.id });
    }
    report.counts.textFrames += 1;
    return frame;
};

HI.textFromRuns = function (item) {
    var runs = item.runs || [];
    if (!runs.length) return item.text || "";
    var text = "";
    for (var i = 0; i < runs.length; i++) text += runs[i].text || "";
    return text;
};

HI.applyRuns = function (doc, frame, runs, report) {
    var index = 0;
    for (var i = 0; i < runs.length; i++) {
        var text = runs[i].text || "";
        HI.applyCharacterStyleToRange(doc, frame, index, text.length, runs[i].characterStyle, report);
        index += text.length;
    }
};

HI.createGraphicFrame = function (doc, page, item, context, report) {
    var rect = page.rectangles.add();
    rect.geometricBounds = HI.boundsToGeometricBounds(item.bounds);
    HI.assignLayer(rect, context, item.layer);
    HI.applyObjectStyle(doc, rect, item.objectStyle, report);
    try { rect.label = HI.itemLabel(item); } catch (_) {}

    var placed = item.placed || {};
    var asset = HI.findAssetById(context.assets || [], placed.assetId);
    if (!asset) {
        HI.addMessage(report, "error", "ASSET_NOT_FOUND", "Instruction asset reference was not found", { itemId: item.id, assetId: placed.assetId });
    } else {
        HI.placeAssetInFrame(doc, rect, asset, placed, context.baseFolder, report);
    }
    report.counts.graphicFrames += 1;
    return rect;
};

HI.createShapeFrame = function (doc, page, item, context, report) {
    var rect = page.rectangles.add();
    rect.geometricBounds = HI.boundsToGeometricBounds(item.bounds);
    HI.assignLayer(rect, context, item.layer);
    HI.applyObjectStyle(doc, rect, item.objectStyle, report);
    try { rect.label = HI.itemLabel(item); } catch (_) {}
    report.counts.shapes += 1;
    return rect;
};

HI.assignLayer = function (pageItem, context, layerName) {
    if (!layerName || !context.layers || !context.layers[layerName]) return;
    try { pageItem.itemLayer = context.layers[layerName]; } catch (_) {}
};

HI.applyZIndex = function (created) {
    created.sort(function (a, b) { return a.zIndex - b.zIndex; });
    for (var i = 0; i < created.length; i++) {
        try { created[i].item.sendToBack(); } catch (_) {}
    }
    for (var j = 0; j < created.length; j++) {
        try { created[j].item.bringToFront(); } catch (_) {}
    }
};
```

- [ ] **步骤 3：运行 static script 测试**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：PASS。

- [ ] **步骤 4：提交**

```bash
git add _indesign_scripts/lib/hi_assets.jsxinc _indesign_scripts/lib/hi_items.jsxinc
git commit -m "feat: place assets from indesign instructions"
```

---

### 任务 5：实现 executor 主流程、报告和旧 schema 结构化报错

**文件：**
- 修改：`D:\AI\html-indesign\_indesign_scripts\lib\hi_executor.jsxinc`
- 修改：`D:\AI\html-indesign\test\indesign-executor\executor-script-static.test.js`

- [ ] **步骤 1：扩展 static test 检查报告字段**

在 `test/indesign-executor/executor-script-static.test.js` 增加测试：

```js
test('executor reports structured counts for CLI result_json consumers', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_executor.jsxinc'), 'utf8');
  for (const token of [
    'pagesRequested',
    'pageCount',
    'textFrames',
    'graphicFrames',
    'placedAssets',
    'missingAssets',
    'build_last_result',
  ]) {
    assert.match(source, new RegExp(token));
  }
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：FAIL，失败点为报告字段缺失。

- [ ] **步骤 3：实现 `hi_executor.jsxinc` 主流程**

把 `_indesign_scripts/lib/hi_executor.jsxinc` 扩展为：

```js
if (typeof HI === "undefined") { HI = {}; }

HI.runBuildFromInstructions = function (appRef, jsonPath) {
    var input = HI.readJsonFile(jsonPath);
    if (input.data && input.data.document && input.data.styles && input.data.pages) {
        return HI.runPagedHtmlBuildInstructions(appRef, input.data, input.baseFolder);
    }
    return HI.runLegacyBuildInstructions(appRef, input.data, input.baseFolder);
};

HI.runPagedHtmlBuildInstructions = function (appRef, instructions, baseFolder) {
    var report = HI.makeReport();
    var context = null;
    try {
        context = HI.prepareDocument(appRef, instructions, report);
        context.baseFolder = baseFolder;
        context.assets = instructions.assets || [];
        context.styleContext = HI.ensureStyles(context.doc, instructions.styles || {}, report);

        var pages = instructions.pages || [];
        for (var i = 0; i < pages.length; i++) {
            var page = HI.getPageForInstruction(context.doc, pages[i], i, report);
            HI.buildInstructionItems(context.doc, page, pages[i], context, report);
        }

        report.pagesRequested = pages.length;
        report.pageCount = context.doc.pages.length;
        HI.insertJsonLabel(context.doc, "build_last_result", report);
        HI.addMessage(report, "info", "BUILD_DONE", "Build instructions executed", {
            pagesRequested: report.pagesRequested,
            pageCount: report.pageCount,
            textFrames: report.counts.textFrames,
            graphicFrames: report.counts.graphicFrames,
            placedAssets: report.counts.placedAssets,
            missingAssets: report.counts.missingAssets
        });
    } catch (error) {
        HI.addMessage(report, "error", "EXECUTOR_ERROR", String(error), {});
    } finally {
        if (context && context.doc) {
            HI.restoreDocumentPreferences(context.doc, context);
        }
    }
    return report;
};

HI.runLegacyBuildInstructions = function (appRef, instructions, baseFolder) {
    var report = HI.makeReport();
    HI.addMessage(report, "error", "LEGACY_SCHEMA_UNSUPPORTED_IN_MODULAR_EXECUTOR", "Current executor received legacy template instructions. Regenerate instructions through pagedHtml.compileInstructions or restore the legacy script from git history for old template runs.", {});
    return report;
};
```

- [ ] **步骤 4：运行 static script 测试并确认通过**

运行：

```bash
node --test test/indesign-executor/executor-script-static.test.js
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add _indesign_scripts/lib/hi_executor.jsxinc test/indesign-executor/executor-script-static.test.js
git commit -m "feat: execute paged html instructions in indesign"
```

---

### 任务 6：真实 InDesign CLI smoke 验证

**文件：**
- 不新增长期文件。
- 临时输出只放 `D:\AI\html-indesign\test\workspace\indesign-executor-smoke\`。

- [ ] **步骤 1：运行全部 Node 测试**

运行：

```bash
npm test
```

预期：PASS。

- [ ] **步骤 2：生成 smoke instructions 到默认执行路径**

运行：

```bash
node -e "const path=require('path');const {writeExecutorSmokeWorkspace}=require('./test/indesign-executor/executor-fixture-writer');const out=writeExecutorSmokeWorkspace(path.resolve('test/workspace'));console.log(JSON.stringify({instructionsPath:out.instructionsPath,items:out.instructions.pages[0].items.length,assets:out.instructions.assets.length},null,2));"
```

预期：打印 `items: 4`、`assets: 2`，并写入 `test/workspace/instructions.json` 和 `test/workspace/executor-assets/`。

- [ ] **步骤 3：检查 InDesign CLI 健康状态**

运行：

```bash
cli-anything-indesign --json --pretty server health
```

预期：CLI 返回成功 JSON。若失败，记录环境阻塞，不修改本项目去绕过 CLI。

- [ ] **步骤 4：通过 CLI 执行 ExtendScript**

运行：

```bash
cli-anything-indesign --json --pretty script run _indesign_scripts\build_from_instructions.jsx | Tee-Object -FilePath test\workspace\indesign-executor-smoke\script-run.json
```

预期：命令退出码为 `0`，`test/workspace/indesign-executor-smoke/script-run.json` 存在。

- [ ] **步骤 5：校验 CLI 的结构化结果**

运行：

```bash
node -e "const fs=require('fs');const result=JSON.parse(fs.readFileSync('test/workspace/indesign-executor-smoke/script-run.json','utf8'));const report=result.data&&result.data.result_json;if(!report){console.error(JSON.stringify(result,null,2));process.exit(1);}if(!report.ok){console.error(JSON.stringify(report,null,2));process.exit(1);}if(report.counts.textFrames<1||report.counts.graphicFrames<2||report.counts.placedAssets<2){console.error(JSON.stringify(report,null,2));process.exit(1);}console.log(JSON.stringify({ok:report.ok,pagesRequested:report.pagesRequested,pageCount:report.pageCount,textFrames:report.counts.textFrames,graphicFrames:report.counts.graphicFrames,placedAssets:report.counts.placedAssets,missingAssets:report.counts.missingAssets},null,2));"
```

预期：打印 `ok: true`、`textFrames >= 1`、`graphicFrames >= 2`、`placedAssets >= 2`、`missingAssets: 0`。

- [ ] **步骤 6：清理真实测试文档**

运行：

```bash
node -e "const fs=require('fs');fs.writeFileSync('test/workspace/indesign-executor-smoke/close-doc.jsx','(function(){ if(app.documents.length>0){ app.activeDocument.close(SaveOptions.NO); } return \"{\\\"ok\\\":true}\"; })();','utf8');"
cli-anything-indesign --json --pretty script run test\workspace\indesign-executor-smoke\close-doc.jsx
```

预期：临时 InDesign 文档关闭，不保存。

- [ ] **步骤 7：检查 git 状态**

运行：

```bash
git status --short
```

预期：只有本计划有意产生的 tracked 变更；`test/workspace/` 输出不进入提交。

- [ ] **步骤 8：最终提交**

如任务 1-5 已各自提交，本步骤只提交遗漏的测试或文档修正：

```bash
git add _indesign_scripts src test/indesign-executor docs/superpowers/plans/2026-05-24-indesign-executor-upgrade.md
git status --short
git commit -m "test: verify indesign executor smoke build"
```

如果没有 tracked 变更，跳过提交并记录 `working tree clean`。

---

## 最终验证

- [ ] `npm test`
- [ ] `node -e "const path=require('path');const {writeExecutorSmokeWorkspace}=require('./test/indesign-executor/executor-fixture-writer');const {validateInstructions}=require('./src/paged-html');const out=writeExecutorSmokeWorkspace(path.resolve('test/workspace'));const result=validateInstructions(out.instructions,{checkAssetFiles:true,baseDir:out.workspaceDir});if(!result.valid){console.error(JSON.stringify(result,null,2));process.exit(1);}console.log(JSON.stringify({valid:true,assets:out.instructions.assets.length,items:out.instructions.pages[0].items.length},null,2));"`
- [ ] `cli-anything-indesign --json --pretty server health`
- [ ] `cli-anything-indesign --json --pretty script run _indesign_scripts\build_from_instructions.jsx`
- [ ] 解析 CLI `data.result_json`，确认 `ok: true`、`placedAssets >= 2`、`missingAssets === 0`。
- [ ] 清理临时 InDesign 文档。

## 自检清单

规格覆盖：

- `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 第 11 节执行器职责：本计划覆盖 document、page、layer、swatches、paragraph/character/object styles、text/graphic/shape、linked assets、overset report。
- 建筑汇报资产：本计划覆盖 PDF 和 SVG 的真实 smoke；PSD/AI 使用同一个 `placeAssetInFrame` 通道，字段保留 `artboard`、`layerComp`、`preserveVector`，真实专项样例单独加测试。
- CLI：所有真实执行通过 `cli-anything-indesign`，不复制 COM/MCP/JSX transport。
- 边界：HTML/CSS 解析仍在 Node/browser 侧，ExtendScript 只消费 JSON。

类型一致性：

- Node validator 输入仍是 `compileInstructions()` 输出的 `instructions`。
- Executor 识别 `instructions.document`、`instructions.styles`、`instructions.assets`、`instructions.layers`、`instructions.pages`。
- 图形 item 使用 `placed.assetId` 找 `assets[].id`。
- 文本 item 使用 `paragraphStyle` 和 `runs[].characterStyle`。
- CLI 判断优先读 `data.result_json`。

风险和处理：

- InDesign PDF crop 常量在不同版本可能差异，`HI.pdfCropFor()` 找不到常量时记录 warning，不阻塞置入。
- 字体名在浏览器和 InDesign 可能不一致，`HI.assignTextStyleProperties()` 记录 `FONT_APPLY_FAILED` warning。
- SVG 置入能力依赖 InDesign 版本，若 smoke 环境不支持 SVG，先保留错误报告，再把 smoke fixture 的第二个 asset 换成生成 PDF，执行器通道不变。
