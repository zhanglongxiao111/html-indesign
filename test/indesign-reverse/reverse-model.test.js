const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel } = require('../../src/indesign-reverse');
const { validateSemanticModel } = require('../../src/semantic-model');

test('reverseSnapshotToSemanticModel restores tagged InDesign as DocumentModel', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.id, 'architecture-report');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.parentPages[0].id, 'report-parent');
  assert.equal(model.layers[0].token, 'text');
  assert.equal(model.pages[0].id, 'agenda-page');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.equal(model.pages[0].items[0].semantic, 'page-title');
  assert.equal(model.sourcePackage.config, 'deck.config.json');
  assert.equal(model.pages[0].sourceFile, 'pages/01-agenda.html');
  assert.equal(model.pages[0].sourceNode.tagName, 'section');
  assert.equal(model.pages[0].grid.columns, 12);
  assert.equal(model.pages[0].items[0].sourceFile, 'pages/01-agenda.html');
  assert.equal(model.pages[0].items[0].sourceNode.tagName, 'h2');
  assert.deepEqual(model.pages[0].items[0].layout.grid, { col: 1, span: 4, row: 1, rowSpan: 1 });
  assert.equal(model.pages[0].items[0].structure.parentId, 'agenda-page');
});

test('reverseSnapshotToSemanticModel preserves parent page decorative items', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'parent.indd', mode: 'structured' },
    document: { name: 'parent.indd', labels: [] },
    parentPages: [
      {
        name: 'A-正文',
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'parent-rule',
            type: 'GraphicLine',
            bounds: { x: 40, y: 420, width: 720, height: 0 },
            layerName: '母版装饰',
            vectorGeometry: {
              kind: 'line',
              x1: 40,
              y1: 420,
              x2: 760,
              y2: 420,
            },
            visualStyle: {
              strokeColor: '#c8102e',
              strokeWeight: 2,
            },
            labels: [],
          },
        ],
      },
    ],
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        appliedParentPageName: 'A-正文',
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [],
      },
    ],
  }, { mode: 'observation' });

  assert.equal(model.parentPages[0].bounds.width, 800);
  assert.equal(model.parentPages[0].items.length, 1);
  assert.equal(model.parentPages[0].items[0].role, 'line');
  assert.equal(model.pages[0].parentPageName, 'A-正文');
});

test('reverseSnapshotToSemanticModel output is strict-valid for registered reverse surfaces', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'strict-valid.indd', mode: 'structured' },
    document: {
      name: 'strict-valid.indd',
      labels: [{
        protocol: 'html-indesign',
        version: 1,
        kind: 'document',
        id: 'strict-doc',
        title: 'Strict reverse document',
        unitMode: 'presentation',
        coordinateUnit: 'pt',
        sourcePackage: { config: 'deck.config.json', profile: 'architecture-report' },
      }],
    },
    parentPages: [
      {
        name: 'A-Parent',
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'parent-a' }],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [],
      },
    ],
    layers: [{ name: 'Text', visible: true, printable: true }],
    styles: {
      paragraphStyles: [
        { name: 'Title', safeName: 'title', css: 'font-size:32pt' },
      ],
    },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [{
          protocol: 'html-indesign',
          version: 1,
          kind: 'page',
          id: 'page-1',
          semantic: 'agenda-page',
          sourceFile: 'pages/01-agenda.html',
          sourceNode: { tagName: 'section', id: 'page-1' },
          grid: { columns: 12 },
        }],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        guides: [{ axis: 'x', position: 40 }],
        items: [
          {
            id: 'title',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            layerName: 'Text',
            paragraphStyleName: 'Title',
            text: 'Title',
            textRuns: [{ text: 'Title', characterStyle: null }],
            visualStyle: {
              fillColor: '#ffffff',
              strokeColor: '#123456',
              strokeWeight: 1,
              opacity: 90,
              cornerRadius: 8,
            },
            effects: { transparency: { opacity: 90 } },
            textFrameStyle: { insetSpacing: 8 },
            inlineStyle: 'font-size:32pt',
            zIndex: 1,
            firstLineFont: 'Title Composite',
            labels: [{
              protocol: 'html-indesign',
              version: 1,
              kind: 'item',
              id: 'title',
              role: 'text',
              semantic: 'page-title',
              layout: { grid: { col: 1, span: 4, row: 1 } },
              sourceFile: 'pages/01-agenda.html',
              sourceText: 'Title',
              sourceHtml: '<h1>Title</h1>',
              htmlTag: 'h1',
              className: 'page-title',
              sourceNode: { tagName: 'h1', id: 'title', classList: ['page-title'] },
              sourceRuns: [{ text: 'Title', tagName: 'span', classList: [], attributes: {} }],
            }],
          },
          {
            id: 'hero',
            type: 'Rectangle',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            placedAsset: {
              name: 'hero.pdf',
              path: '\\\\server\\share\\hero.pdf',
              status: 'NORMAL',
              graphicType: 'PDF',
              imageTypeName: 'Adobe PDF',
              cropped: false,
              placement: {
                pageNumber: 2,
                crop: 'trim',
                transparentBackground: true,
                visibleLayers: ['base'],
                hiddenLayers: ['notes'],
                layers: [{ name: 'base', currentVisibility: true, originalVisibility: true }],
              },
              preview: {
                path: 'D:\\tmp\\hero.png',
                relativePath: 'previews/hero.png',
                source: 'indesign-frame-export',
                format: 'png',
              },
            },
            labels: [{
              protocol: 'html-indesign',
              version: 1,
              kind: 'item',
              id: 'hero',
              role: 'graphic',
              semantic: 'hero-image',
            }],
          },
        ],
      },
    ],
  }, {
    mode: 'structured',
    strictFields: true,
    semanticPreset: {
      semantics: {
        'agenda-page': {},
        'page-title': { roles: ['text'] },
        'hero-image': { roles: ['graphic'] },
      },
    },
  });

  const strictResult = validateSemanticModel(model, { strictFields: true });
  assert.equal(strictResult.valid, true);
  assert.deepEqual(strictResult.fieldValidation.unknown, []);

  model.pages[0].items[0].adapterPrivateGhost = true;
  model.pages[0].effectiveLabel.ghost = true;
  model.pages[0].observedLabel.ghost = true;
  model.styles.paragraphStyles.Title.ghost = true;
  model.parentPages[0].ghost = true;
  model.layers[0].ghost = true;
  const rejected = validateSemanticModel(model, { strictFields: true });
  assert.equal(rejected.valid, false);
  for (const path of [
    'pages[].items[].adapterPrivateGhost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
    'styles.paragraphStyles[].ghost',
    'parentPages[].ghost',
    'layers[].ghost',
  ]) {
    assert.equal(
      rejected.errors.some((error) => (
        error.code === 'MODEL_FIELD_NOT_REGISTERED'
        && error.path === path
      )),
      true,
      `${path} should be a strict model field error`,
    );
  }
});

test('reverseSnapshotToSemanticModel surfaces observation label field warnings', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'observed-label.indd', mode: 'observation' },
    document: { name: 'observed-label.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [
          {
            protocol: 'html-indesign',
            version: 1,
            kind: 'page',
            id: 'page-1',
            copiedTemplateSlot: 'old-slot',
          },
        ],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [],
      },
    ],
  }, { mode: 'observation' });

  assert.equal(model.valid, true);
  assert.equal(model.errors.length, 0);
  assert.equal(model.report.warningCount, 1);
  assert.equal(model.report.errorCount, 0);
  assert.equal(model.warnings[0].code, 'LABEL_FIELD_NOT_REGISTERED');
  assert.equal(model.warnings[0].path, 'copiedTemplateSlot');
  assert.equal(model.warnings[0].labelKind, 'page');
  assert.equal(model.fieldValidation.length, 1);
  assert.equal(model.fieldValidation[0].labelKind, 'page');
  assert.deepEqual(model.fieldValidation[0].unknown, ['copiedTemplateSlot']);
  assert.equal(model.pages[0].observedLabel.copiedTemplateSlot, 'old-slot');
});

test('reverseSnapshotToSemanticModel surfaces strict label field errors', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'strict-label.indd', mode: 'structured' },
    document: { name: 'strict-label.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'title',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            text: 'Title',
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'title',
                role: 'text',
                unknownPayload: 'bad',
              },
            ],
          },
        ],
      },
    ],
  }, { strictFields: true });

  assert.equal(model.valid, false);
  assert.equal(model.errors.length, 1);
  assert.equal(model.errors[0].code, 'LABEL_FIELD_NOT_REGISTERED');
  assert.equal(model.errors[0].path, 'unknownPayload');
  assert.equal(model.errors[0].labelKind, 'item');
  assert.equal(model.report.errorCount, 1);
  assert.equal(
    model.fieldValidation.some((validation) => (
      validation.labelKind === 'item'
      && validation.valid === false
      && validation.unknown.includes('unknownPayload')
    )),
    true,
  );
});

test('reverseSnapshotToSemanticModel accepts registered page parent label fields through effective label', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'parent-label.indd', mode: 'structured' },
    document: { name: 'parent-label.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [
          {
            protocol: 'html-indesign',
            version: 1,
            kind: 'page',
            id: 'page-1',
            parentPageId: 'report-parent',
            parentPageName: '汇报母版',
          },
        ],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [],
      },
    ],
  }, { strictFields: true });

  assert.equal(model.valid, true);
  assert.equal(model.errors.length, 0);
  assert.equal(model.report, null);
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.pages[0].effectiveLabel.parentPageId, 'report-parent');
  assert.equal(model.pages[0].effectiveLabel.parentPageName, '汇报母版');
});

test('reverseSnapshotToSemanticModel preserves observed visual style and placed asset per item', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'visual.indd', mode: 'structured' },
    document: { name: 'visual.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'card-frame',
            type: 'Rectangle',
            bounds: { x: 40, y: 50, width: 240, height: 120 },
            objectStyleName: '指标卡片',
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: '#c8102e',
              strokeWeight: 3,
              opacity: 72,
              cornerRadius: 8,
            },
            labels: [],
          },
          {
            id: 'hero-image',
            type: 'Rectangle',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            placedAsset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              status: 'NORMAL',
              cropped: true,
            },
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'hero-image',
                role: 'graphic',
                semantic: 'hero-image',
              },
            ],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const card = model.pages[0].items.find((item) => item.id === 'card-frame');
  assert.equal(card.role, 'shape');
  assert.equal(card.visualStyle.fillColor, '#fbfaf7');
  assert.equal(card.visualStyle.strokeColor, '#c8102e');
  assert.equal(card.visualStyle.strokeWeight, 3);
  assert.equal(card.visualStyle.opacity, 72);
  assert.equal(card.visualStyle.cornerRadius, 8);

  const hero = model.pages[0].items.find((item) => item.id === 'hero-image');
  assert.equal(hero.role, 'graphic');
  assert.equal(hero.asset.path, 'D:\\assets\\hero.png');
  assert.equal(hero.asset.cropped, true);
});

test('reverseSnapshotToSemanticModel preserves placed asset preview page and layer visibility facts', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'placed.indd', mode: 'structured' },
    document: { name: 'placed.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'linked-pdf',
            type: 'Rectangle',
            bounds: { x: 80, y: 40, width: 500, height: 300 },
            placedAsset: {
              name: 'drawing.pdf',
              path: '\\\\daga-nas5\\share\\drawing.pdf',
              status: 'NORMAL',
              graphicType: 'PDF',
              imageTypeName: 'Adobe PDF',
              cropped: false,
              placement: {
                pageNumber: 3,
                crop: 'trim',
                transparentBackground: true,
                visibleLayers: ['结构', '标注'],
                hiddenLayers: ['家具'],
                layers: [
                  { name: '结构', currentVisibility: true, originalVisibility: true, locked: false },
                  { name: '家具', currentVisibility: false, originalVisibility: true, locked: false },
                ],
              },
              preview: {
                path: 'D:\\tmp\\reverse-previews\\linked-pdf.png',
                relativePath: 'previews/linked-pdf.png',
                source: 'indesign-frame-export',
                format: 'png',
              },
            },
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const item = model.pages[0].items[0];
  assert.equal(item.role, 'graphic');
  assert.equal(item.asset.preview.relativePath, 'previews/linked-pdf.png');
  assert.equal(item.asset.placement.pageNumber, 3);
  assert.equal(item.asset.placement.crop, 'trim');
  assert.deepEqual(item.asset.placement.visibleLayers, ['结构', '标注']);
  assert.deepEqual(item.asset.placement.hiddenLayers, ['家具']);
});

test('reverseSnapshotToSemanticModel preserves observed item effects', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'effects.indd', mode: 'structured' },
    document: { name: 'effects.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'cover-veil',
            type: 'Rectangle',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            visualStyle: { fillColor: '#fbfaf7' },
            effects: {
              gradientFeather: {
                type: 'linear',
                scope: 'fill',
                angle: 0,
                start: { x: -400, y: 225 },
                length: 0,
                stops: [
                  { location: 0, opacity: 94 },
                  { location: 45, opacity: 55 },
                  { location: 100, opacity: 8 },
                ],
              },
            },
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const veil = model.pages[0].items[0];
  assert.equal(veil.effects.gradientFeather.scope, 'fill');
  assert.deepEqual(veil.effects.gradientFeather.stops.map((stop) => stop.opacity), [94, 55, 8]);
});

test('reverseSnapshotToSemanticModel preserves observed text style per text item', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'type.indd', mode: 'structured' },
    document: { name: 'type.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'title',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            paragraphStyleName: '页面标题',
            textStyle: {
              appliedFont: 'Microsoft YaHei\tBold',
              fontFamily: 'Microsoft YaHei',
              fontStyleName: 'Bold',
              fontWeight: '700',
              fontStyle: null,
              pointSize: 32,
              leading: 38,
              fillColor: '#123456',
              tracking: 20,
              justification: 'center',
            },
            text: '标题文字',
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const title = model.pages[0].items[0];
  assert.equal(title.role, 'text');
  assert.equal(title.textStyle.fontFamily, 'Microsoft YaHei');
  assert.equal(title.textStyle.fontWeight, '700');
  assert.equal(title.textStyle.pointSize, 32);
  assert.equal(title.textStyle.leading, 38);
  assert.equal(title.textStyle.fillColor, '#123456');
  assert.equal(title.textStyle.tracking, 20);
  assert.equal(title.textStyle.justification, 'center');
});

test('reverseSnapshotToSemanticModel infers generic PageItem with text as text instead of graphic', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'generic-page-item.indd', mode: 'structured' },
    document: { name: 'generic-page-item.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'generic-title',
            type: 'PageItem',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            paragraphStyleName: '页面标题',
            textStyle: { pointSize: 32, fillColor: '#123456' },
            text: '真实标题',
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const title = model.pages[0].items[0];
  assert.equal(title.role, 'text');
  assert.equal(title.tagName, 'p');
  assert.equal(title.content.text, '真实标题');
});

test('reverseSnapshotToSemanticModel decodes InDesign special character tokens in observed text', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'special-text.indd', mode: 'structured' },
    document: { name: 'special-text.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'quote-note',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            text: '整体观感DOUBLE_LEFT_QUOTE偏冰冷DOUBLE_RIGHT_QUOTE',
            textRuns: [
              { text: '整体观感DOUBLE_LEFT_QUOTE偏冰冷DOUBLE_RIGHT_QUOTE', characterStyle: null },
            ],
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const note = model.pages[0].items[0];
  assert.equal(note.content.text, '整体观感“偏冰冷”');
  assert.deepEqual(note.content.runs.map((run) => run.text), ['整体观感“偏冰冷”']);
});

test('reverseSnapshotToSemanticModel omits observed items from hidden InDesign layers', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'hidden-layers.indd', mode: 'structured' },
    document: { name: 'hidden-layers.indd', labels: [] },
    layers: [
      { name: 'Comments', visible: false, printable: true },
      { name: 'text', visible: true, printable: true },
    ],
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'hidden-comment',
            type: 'TextFrame',
            layerName: 'Comments',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            text: 'UPDATE RENDER',
            labels: [],
          },
          {
            id: 'visible-title',
            type: 'TextFrame',
            layerName: 'text',
            bounds: { x: 40, y: 140, width: 360, height: 72 },
            text: '真实标题',
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  assert.deepEqual(model.layers.map((layer) => [layer.name, layer.visible]), [['Comments', false], ['text', true]]);
  assert.deepEqual(model.pages[0].items.map((item) => item.id), ['visible-title']);
});

test('reverseSnapshotToSemanticModel preserves vector path geometry and line role', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'vectors.indd' },
    document: { name: 'vectors.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        bounds: { x: 0, y: 0, width: 400, height: 240 },
        labels: [],
        items: [
          {
            id: 'line-1',
            type: 'GraphicLine',
            bounds: { x: 10, y: 20, width: 180, height: 0 },
            visualStyle: { strokeColor: '#c8102e', strokeWeight: 2, strokeOpacity: 65 },
            vectorGeometry: {
              kind: 'line',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 10, y: 20 }, leftDirection: { x: 10, y: 20 }, rightDirection: { x: 10, y: 20 } },
                    { anchor: { x: 190, y: 20 }, leftDirection: { x: 190, y: 20 }, rightDirection: { x: 190, y: 20 } },
                  ],
                },
              ],
            },
            labels: [],
          },
        ],
      },
    ],
    styles: {},
    layers: [],
    assets: [],
  }, { mode: 'observation' });

  const item = model.pages[0].items[0];
  assert.equal(item.role, 'line');
  assert.equal(item.vectorGeometry.kind, 'line');
  assert.equal(item.vectorGeometry.paths[0].points[1].anchor.x, 190);
  assert.equal(item.visualStyle.strokeOpacity, 65);
});

test('reverseSnapshotToSemanticModel observes labels outside the active whitelist without losing visual facts', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'copied-template.indd', mode: 'structured' },
    document: { name: 'copied-template.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'copied-title',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            paragraphStyleName: '页面标题',
            textStyle: {
              fontFamily: 'Microsoft YaHei',
              pointSize: 32,
              leading: 38,
              fillColor: '#123456',
              tracking: 20,
              justification: 'center',
            },
            text: '旧模板标题',
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'copied-title',
                role: 'text',
                semantic: 'foreign-slot',
                htmlTag: 'h1',
                className: 'old-title',
                sourceNode: {
                  tagName: 'h1',
                  id: 'copied-title',
                  classList: ['old-title'],
                  attributes: { 'data-id-paragraph-style': 'missing-style' },
                },
                structure: { parentId: 'old-card', order: 1 },
              },
            ],
          },
        ],
      },
    ],
  }, {
    mode: 'structured',
    semanticPreset: {
      semantics: { 'page-title': { roles: ['text'] } },
      styles: { paragraphStyles: { 'page-title': {} } },
    },
  });

  const item = model.pages[0].items[0];
  assert.equal(item.semantic, 'unknown');
  assert.equal(item.labelStatus, 'observed');
  assert.equal(item.effectiveLabel.semantic, null);
  assert.equal(item.sourceNode, null);
  assert.equal(item.structure, null);
  assert.equal(item.observedLabel.semantic, 'foreign-slot');
  assert.equal(item.observedLabel.sourceNode.tagName, 'h1');
  assert.deepEqual(item.rejectionReasons.sort(), ['unknown-paragraph-style', 'unknown-semantic'].sort());
  assert.equal(item.textStyle.pointSize, 32);
  assert.equal(item.textStyle.fillColor, '#123456');
});

test('reverseSnapshotToSemanticModel preserves observed character runs per text item', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'type-runs.indd', mode: 'structured' },
    document: { name: 'type-runs.indd', labels: [] },
    styles: {
      characterStyles: [
        { name: '封面强调', safeName: '封面强调', css: 'color:#c8102e; font-style:italic' },
      ],
    },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'cover-title',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 500, height: 120 },
            paragraphStyleName: '封面标题',
            text: '冰球场首层平面\n排布汇报',
            textRuns: [
              {
                text: '冰球场首层平面\n',
                characterStyle: null,
                textStyle: { fillColor: '#123456', fontStyle: null },
              },
              {
                text: '排布汇报',
                characterStyle: '封面强调',
                textStyle: { fillColor: '#c8102e', fontStyle: 'italic' },
              },
            ],
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const title = model.pages[0].items[0];
  assert.equal(title.content.text, '冰球场首层平面\n排布汇报');
  assert.deepEqual(title.content.runs.map((run) => run.text), ['冰球场首层平面\n', '排布汇报']);
  assert.equal(title.content.runs[1].characterStyle, '封面强调');
  assert.equal(title.content.runs[1].textStyle.fillColor, '#c8102e');
  assert.equal(title.content.runs[1].textStyle.fontStyle, 'italic');
});

test('reverseSnapshotToSemanticModel maps InDesign display style names back to source tokens', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'tokens.indd', mode: 'structured' },
    document: { name: 'tokens.indd', labels: [] },
    styles: {
      paragraphStyles: [
        {
          name: '正文',
          labels: [{ protocol: 'html-indesign', version: 1, kind: 'style', id: 'body-copy', token: 'body-copy', displayName: '正文', styleKind: 'paragraphStyles' }],
          css: 'font-size:12pt',
        },
        {
          name: '表格正文',
          labels: [{ protocol: 'html-indesign', version: 1, kind: 'style', id: 'table-body', token: 'table-body', displayName: '表格正文', styleKind: 'paragraphStyles' }],
          css: 'font-size:10pt',
        },
      ],
      characterStyles: [
        {
          name: '术语强调',
          labels: [{ protocol: 'html-indesign', version: 1, kind: 'style', id: 'term-accent', token: 'term-accent', displayName: '术语强调', styleKind: 'characterStyles' }],
          css: 'color:#c8102e',
        },
      ],
    },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'copy',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            paragraphStyleName: '正文',
            text: '流线和 PDF 置入 校核。',
            textRuns: [
              { text: '流线和 ', characterStyle: null },
              { text: 'PDF 置入', characterStyle: '术语强调' },
              { text: ' 校核。', characterStyle: null },
            ],
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'copy',
                role: 'text',
                sourceText: '流线和 PDF 置入 校核。',
                sourceHtml: '流线和 <span class="accent" data-id-character-style="term-accent">PDF 置入</span> 校核。',
                sourceRuns: [
                  { text: 'PDF 置入', tagName: 'span', classList: ['accent'], attributes: { 'data-id-character-style': 'term-accent' } },
                ],
              },
            ],
          },
          {
            id: 'table',
            type: 'TextFrame',
            bounds: { x: 40, y: 160, width: 360, height: 120 },
            labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'table', role: 'table' }],
            table: {
              tableStyle: '面积指标表',
              rows: [
                { index: 0, cells: [{ index: 0, text: 'Space', paragraphStyle: '表格正文' }] },
              ],
            },
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const copy = model.pages[0].items[0];
  const table = model.pages[0].items[1];

  assert.equal(copy.styleRefs.paragraphStyle, 'body-copy');
  assert.equal(copy.content.sourceHtml, '流线和 <span class="accent" data-id-character-style="term-accent">PDF 置入</span> 校核。');
  assert.equal(copy.content.runs[0].attributes['data-id-character-style'], 'term-accent');
  assert.equal(copy.content.runs[0].classList[0], 'accent');
  assert.equal(model.styles.characterStyles['term-accent'].displayName, '术语强调');
  assert.equal(table.table.rows[0].cells[0].paragraphStyle, 'table-body');
});

test('reverseSnapshotToSemanticModel preserves native InDesign table structure', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'table.indd', mode: 'structured' },
    document: { name: 'table.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'area-table',
            type: 'PageItem',
            bounds: { x: 80, y: 100, width: 420, height: 120 },
            text: '\u0016',
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'area-table',
                role: 'table',
                semantic: 'metrics-table',
              },
            ],
            table: {
              tableStyle: '面积指标表',
              rowCount: 2,
              columnCount: 2,
              columnWidths: [260, 160],
              rowHeights: [32, 28],
              rows: [
                {
                  index: 0,
                  cells: [
                    {
                      index: 0,
                      text: 'Space',
                      header: true,
                      rowSpan: 1,
                      colSpan: 1,
                      fillColor: '#123456',
                      textColor: '#ffffff',
                      pointSize: 18,
                      leading: 24,
                      textAlign: 'center',
                      paragraphStyle: '表头文字',
                      padding: { top: 8, right: 10, bottom: 8, left: 10 },
                      borders: {
                        top: { color: '#cfd6d2', borderWeight: 1 },
                        right: { color: '#cfd6d2', borderWeight: 1 },
                        bottom: { color: '#cfd6d2', borderWeight: 1 },
                        left: { color: '#cfd6d2', borderWeight: 1 },
                      },
                    },
                    { index: 1, text: 'Area', header: true, rowSpan: 1, colSpan: 1 },
                  ],
                },
                {
                  index: 1,
                  cells: [
                    { index: 0, text: 'Ice rink', rowSpan: 1, colSpan: 1 },
                    { index: 1, text: '7,600 sqm', rowSpan: 1, colSpan: 1 },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const table = model.pages[0].items[0];
  assert.equal(table.role, 'table');
  assert.equal(table.content.text, '');
  assert.equal(table.table.tableStyle, '面积指标表');
  assert.equal(table.table.rowCount, 2);
  assert.equal(table.table.columnCount, 2);
  assert.deepEqual(table.table.columnWidths, [260, 160]);
  assert.equal(table.table.rows[0].cells[0].text, 'Space');
  assert.equal(table.table.rows[0].cells[0].header, true);
  assert.equal(table.table.rows[0].cells[0].paragraphStyle, '表头文字');
  assert.equal(table.table.rows[0].cells[0].borders.left.color, '#cfd6d2');
});

test('reverseSnapshotToSemanticModel preserves reverse style resources composite fonts and z order', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'styles.indd', mode: 'structured' },
    document: { name: 'styles.indd', labels: [] },
    styles: {
      compositeFonts: [
        {
          name: '建筑复合字体',
          hasBoldCJK: true,
          cjkWeight: '700',
          romanWeight: '400',
          entries: [{ name: '罗马字', fontStyle: 'Regular', size: 82, weight: '400' }],
        },
      ],
      paragraphStyles: [
        {
          name: '正文列表',
          safeName: 'body-list',
          css: 'font-size:12pt; color:#123456',
          list: { type: 'numbered', isCircle: true, charStyleCSS: 'color:#c8102e' },
          dropCap: { chars: 1, lines: 2, styleCSS: 'color:#c8102e' },
          grepStyles: [{ pattern: '^.+?(?=\\n|\\r)', charStyleCSS: 'font-weight:bold' }],
        },
      ],
      characterStyles: [
        { name: '强调', safeName: 'accent', css: 'color:#c8102e; font-weight:bold' },
      ],
      objectStyles: [
        { name: '图片框', safeName: 'image-frame', css: 'border:1pt solid #aeb8b8' },
      ],
    },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'body',
            type: 'TextFrame',
            bounds: { x: 40, y: 50, width: 360, height: 120 },
            paragraphStyleName: '正文列表',
            text: '第一条\nSecond item',
            zIndex: 5,
            firstLineFont: '建筑复合字体',
            labels: [],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  assert.equal(model.styles.compositeFonts['建筑复合字体'].romanWeight, '400');
  assert.equal(model.styles.paragraphStyles['正文列表'].css, 'font-size:12pt; color:#123456');
  assert.equal(model.styles.paragraphStyles['正文列表'].safeName, 'body-list');
  assert.equal(model.styles.paragraphStyles['正文列表'].indesignFeatures.list.isCircle, true);
  assert.equal(model.styles.paragraphStyles['正文列表'].indesignFeatures.dropCap.lines, 2);
  assert.equal(model.styles.paragraphStyles['正文列表'].indesignFeatures.grepStyles[0].charStyleCSS, 'font-weight:bold');
  assert.equal(model.styles.paragraphStyles['正文列表'].indesignFeatures.list.type, 'numbered');
  assert.equal(model.styles.characterStyles['强调'].css, 'color:#c8102e; font-weight:bold');
  assert.equal(model.styles.objectStyles['图片框'].css, 'border:1pt solid #aeb8b8');

  const body = model.pages[0].items[0];
  assert.equal(body.zIndex, 5);
  assert.equal(body.firstLineFont, '建筑复合字体');
});
