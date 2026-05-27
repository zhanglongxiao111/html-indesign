const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel } = require('../../src/indesign-reverse');

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
  assert.equal(model.styles.paragraphStyles['正文列表'].legacy.list.isCircle, true);
  assert.equal(model.styles.paragraphStyles['正文列表'].legacy.dropCap.lines, 2);
  assert.equal(model.styles.paragraphStyles['正文列表'].legacy.grepStyles[0].charStyleCSS, 'font-weight:bold');
  assert.equal(model.styles.characterStyles['强调'].css, 'color:#c8102e; font-weight:bold');
  assert.equal(model.styles.objectStyles['图片框'].css, 'border:1pt solid #aeb8b8');

  const body = model.pages[0].items[0];
  assert.equal(body.zIndex, 5);
  assert.equal(body.firstLineFont, '建筑复合字体');
});
