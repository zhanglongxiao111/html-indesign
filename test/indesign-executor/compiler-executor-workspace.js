const fs = require('fs');
const path = require('path');
const { renderSnapshot, compileInstructions, validateInstructions } = require('../../src/paged-html');
const { createTinyPdf, createTinySvg } = require('./executor-fixture-writer');

async function writeCompilerExecutorWorkspace(workspaceDir = path.resolve(__dirname, '../workspace/compiler-executor-e2e')) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  const assetsDir = path.join(workspaceDir, 'compiler-assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'site-plan.pdf'), createTinyPdf('Compiled Site Plan'), 'ascii');
  fs.writeFileSync(path.join(assetsDir, 'diagram.svg'), createTinySvg(), 'utf8');

  const htmlPath = path.join(workspaceDir, 'compiler-e2e-deck.html');
  fs.writeFileSync(htmlPath, compilerE2eHtml(), 'utf8');

  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, { mode: 'editable-first' });
  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: workspaceDir,
  });
  if (!validation.valid) {
    const error = new Error('Compiled instructions failed validation.');
    error.validation = validation;
    throw error;
  }

  const instructionsPath = path.join(workspaceDir, 'instructions.json');
  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2), 'utf8');
  const inspectScriptPath = path.join(workspaceDir, 'inspect-doc.jsx');
  fs.writeFileSync(inspectScriptPath, inspectDocScript(), 'utf8');
  const closeScriptPath = path.join(workspaceDir, 'close-doc.jsx');
  fs.writeFileSync(closeScriptPath, closeDocScript(), 'utf8');

  return {
    workspaceDir,
    assetsDir,
    htmlPath,
    instructionsPath,
    inspectScriptPath,
    closeScriptPath,
    snapshot,
    instructions,
  };
}

function compilerE2eHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
    }
    .page {
      width: 210mm;
      height: 120mm;
      position: relative;
      overflow: hidden;
      background: #ffffff;
    }
    .metric-card {
      position: absolute;
      left: 10mm;
      top: 10mm;
      width: 190mm;
      height: 100mm;
      background: #f2f2f2;
      border: 1pt solid #123456;
      z-index: 1;
    }
    .title {
      position: absolute;
      left: 16mm;
      top: 16mm;
      width: 120mm;
      height: 20mm;
      margin: 0;
      font-family: Arial, sans-serif;
      font-size: 24pt;
      line-height: 28pt;
      font-weight: 700;
      color: #123456;
      z-index: 30;
    }
    .accent {
      color: #c8102e;
      font-style: italic;
      font-weight: 700;
    }
    .drawing {
      position: absolute;
      left: 16mm;
      top: 42mm;
      width: 88mm;
      height: 58mm;
      z-index: 20;
    }
    .diagram {
      position: absolute;
      left: 114mm;
      top: 42mm;
      width: 72mm;
      height: 58mm;
      object-fit: contain;
      z-index: 21;
    }
  </style>
</head>
<body>
  <section class="page" data-page id="compiler-page">
    <div id="card-background" class="metric-card" data-id-object data-id-object-style="metric-card"></div>
    <h1 id="compiler-title" class="title" data-id-paragraph-style="report-title">建筑设计汇报<span class="accent" data-id-character-style="accent">重点</span></h1>
    <object id="site-plan"
            class="drawing"
            data="./compiler-assets/site-plan.pdf"
            type="application/pdf"
            data-id-object
            data-id-layer="graphics"
            data-id-asset-kind="pdf"
            data-id-pdf-page="1"
            data-id-crop="trim"
            data-id-fit="contain"
            data-id-object-style="drawing-frame-object"
            data-id-frame-style="drawing-frame"></object>
    <img id="diagram"
         class="diagram"
         src="./compiler-assets/diagram.svg"
         data-id-object
         data-id-layer="graphics"
         data-id-asset-kind="svg"
         data-id-fit="contain"
         data-id-object-style="drawing-frame-object"
         data-id-frame-style="drawing-frame"
         alt="diagram">
  </section>
</body>
</html>
`;
}

function inspectDocScript() {
  return `(function () {
    var doc = app.activeDocument;
    function names(collection) {
        var out = [];
        try {
            for (var i = 0; i < collection.length; i++) out.push(collection[i].name);
        } catch (_) {}
        return out;
    }
    function labels(collection) {
        var out = [];
        try {
            var items = collection.everyItem().getElements();
            for (var i = 0; i < items.length; i++) {
                if (items[i].label) out.push(items[i].label);
            }
        } catch (_) {}
        return out;
    }
    function textContents() {
        var out = [];
        try {
            var frames = doc.textFrames.everyItem().getElements();
            for (var i = 0; i < frames.length; i++) out.push(frames[i].contents);
        } catch (_) {}
        return out;
    }
    var result = {
        ok: true,
        pageCount: doc.pages.length,
        layerNames: names(doc.layers),
        swatchNames: names(doc.swatches),
        paragraphStyleNames: names(doc.paragraphStyles),
        characterStyleNames: names(doc.characterStyles),
        objectStyleNames: names(doc.objectStyles),
        labels: labels(doc.pageItems),
        textContents: textContents(),
        linkCount: doc.links.length
    };
    return JSON.stringify(result);
})();`;
}

function closeDocScript() {
  return `(function () {
    if (app.documents.length > 0) {
        app.activeDocument.close(SaveOptions.NO);
    }
    return "{\\"ok\\":true}";
})();`;
}

module.exports = {
  writeCompilerExecutorWorkspace,
};
