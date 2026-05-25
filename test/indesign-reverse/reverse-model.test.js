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
