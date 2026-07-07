const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, snapshotToSemanticModel } = require('../../src/adapters/html');

function captureThrow(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('Expected function to throw');
}

test('snapshotToSemanticModel builds document pages, styles, assets, and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, {
    unitMode: 'presentation',
    targetSize: 'same',
  });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.unitMode, 'presentation');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].items.length > 0, true);
  assert.equal(model.pages[0].labels[0].kind, 'page');
  assert.equal(model.styles.paragraphStyles && typeof model.styles.paragraphStyles, 'object');
  assert.equal(Array.isArray(model.assets), true);
});

test('snapshotToSemanticModel emits InDesign effects through item extensions', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'gradient-wash',
        role: 'shape',
        tagName: 'div',
        classList: ['wash'],
        attributes: { 'data-id-object': '' },
        rectPx: { x: 10, y: 12, width: 40, height: 20 },
        boundsMm: { x: 10, y: 12, width: 40, height: 20 },
        computedStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0))',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
        },
        authoredStyle: {},
        text: '',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'print' });

  const wash = model.pages[0].items[0];
  assert.equal(Object.hasOwn(wash, 'effects'), false);
  assert.equal(wash.extensions.indesign.effects.gradientFeather.scope, 'fill');
});

test('snapshotToSemanticModel throws when normalized output contains an unregistered field', () => {
  const error = captureThrow(() => snapshotToSemanticModel({
    metadata: { source: 'bad-style-surface.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [],
    }],
    styles: {
      adapterGhostStyles: {},
    },
    assets: [],
  }, { unitMode: 'print' }));

  assert.equal(error.code, 'SEMANTIC_MODEL_VALIDATION_FAILED');
  assert.equal(error.adapter, 'html snapshotToSemanticModel');
  assert.equal(error.validation.valid, false);
  assert.equal(
    error.validation.errors.some((issue) => (
      issue.code === 'MODEL_FIELD_NOT_REGISTERED'
      && issue.path === 'styles.adapterGhostStyles'
    )),
    true,
  );
  assert.match(error.message, /styles\.adapterGhostStyles/);
});

test('snapshotToSemanticModel preserves page layout and parent page metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      widthMm: 508,
      heightMm: 285.75,
      rectPx: { x: 0, y: 0, width: 1920, height: 1080 },
      classList: ['page'],
      attributes: {
        'data-page': 'agenda',
        'data-id-semantic': 'agenda',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-name': '汇报母版',
        'data-id-layout': 'contents-grid',
        'data-id-margin': '14mm',
        'data-id-grid': '12x6',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].semantic, 'agenda');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.deepEqual(model.pages[0].margins, { top: 14, right: 14, bottom: 14, left: 14 });
});

test('snapshotToSemanticModel restores parent page items from reverse author HTML markers', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [
        {
          id: 'page-1-parent-rule',
          role: 'shape',
          tagName: 'svg',
          classList: ['id-object', 'id-parent-page-object'],
          attributes: {
            'data-id-object': '',
            'data-id-role': 'line',
            'data-id-object-style': '装饰线',
            'data-id-parent-page-item': 'A-正文',
            'data-id-parent-page-source-id': 'parent-rule',
          },
          sourceNode: {
            tagName: 'svg',
            id: 'page-1-parent-rule',
            classList: ['id-object', 'id-parent-page-object'],
            attributes: {
              'data-id-parent-page-item': 'A-正文',
              'data-id-parent-page-source-id': 'parent-rule',
            },
          },
          rectPx: { x: 10, y: 12, width: 80, height: 1 },
          computedStyle: {},
          visualStyle: { strokeColor: '#999999', strokeWeight: 1 },
          vectorGeometry: { kind: 'line', paths: [] },
          text: '',
          runs: [],
        },
        {
          id: 'body-copy',
          role: 'text',
          tagName: 'p',
          classList: ['id-object'],
          attributes: {},
          rectPx: { x: 20, y: 30, width: 50, height: 10 },
          text: '正文',
          runs: [],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].parentPageId, 'A-正文');
  assert.equal(model.pages[0].parentPageName, 'A-正文');
  assert.deepEqual(model.pages[0].items.map((item) => item.id), ['body-copy']);
  assert.equal(model.parentPages.length, 1);
  assert.equal(model.parentPages[0].id, 'A-正文');
  assert.equal(model.parentPages[0].items.length, 1);
  assert.equal(model.parentPages[0].items[0].id, 'parent-rule');
  assert.equal(model.parentPages[0].items[0].parentPageItem, true);
});

test('snapshotToSemanticModel does not synthesize CSS grid guides for observed reverse pages', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'reverse-observation.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
      },
      parentPages: [{
        id: '0-参考线页面（无需填充）',
        name: '0-参考线页面（无需填充）',
        guides: [
          { orientation: 'vertical', position: 42.52, source: 'parent-page' },
          { orientation: 'vertical', position: 125.43, source: 'parent-page' },
        ],
      }],
    },
    pages: [{
      id: 'page-6',
      index: 5,
      widthMm: 1496.69,
      heightMm: 841.89,
      rectPx: { x: 0, y: 0, width: 1496.69, height: 841.89 },
      classList: ['page'],
      attributes: {
        'data-page': '6',
        'data-id-observed': 'true',
        'data-id-reverse-mode': 'observation',
        'data-id-parent-page': '0-参考线页面（无需填充）',
        'data-id-parent-page-name': '0-参考线页面（无需填充）',
        'data-id-margin': '56.69px 42.52px 28.35px 42.52px',
      },
      computedStyle: {
        display: 'grid',
        gridTemplateColumns: '117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px 117.63px',
        gridTemplateRows: '94.59px 94.59px 94.59px 94.59px 94.59px 94.59px 94.59px 94.59px',
      },
      items: [],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.deepEqual(model.pages[0].guides, []);
  assert.equal(model.pages[0].parentPageId, '0-参考线页面（无需填充）');
  assert.equal(model.parentPages.length, 1);
  assert.deepEqual(model.parentPages[0].guides, [
    { orientation: 'vertical', position: 42.52, source: 'parent-page' },
    { orientation: 'vertical', position: 125.43, source: 'parent-page' },
  ]);
});

test('snapshotToSemanticModel restores nested parent pages from source package metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'reverse-observation.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
      },
      parentPages: [
        {
          id: '0-参考线页面（无需填充）',
          name: '0-参考线页面（无需填充）',
          guides: [{ orientation: 'vertical', position: 42.52, source: 'parent-page' }],
        },
        {
          id: 'I-两张竖构图',
          name: 'I-两张竖构图',
          parentPageId: '0-参考线页面（无需填充）',
          parentPageName: '0-参考线页面（无需填充）',
        },
      ],
    },
    pages: [{
      id: 'page-12',
      index: 11,
      widthMm: 1496.69,
      heightMm: 841.89,
      rectPx: { x: 0, y: 0, width: 1496.69, height: 841.89 },
      classList: ['page'],
      attributes: {
        'data-page': '12',
        'data-id-observed': 'true',
        'data-id-reverse-mode': 'observation',
        'data-id-parent-page': 'I-两张竖构图',
        'data-id-parent-page-name': 'I-两张竖构图',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  const layoutParent = model.parentPages.find((parentPage) => parentPage.id === 'I-两张竖构图');
  assert.equal(layoutParent.parentPageId, '0-参考线页面（无需填充）');
  assert.equal(layoutParent.parentPageName, '0-参考线页面（无需填充）');
  assert.deepEqual(
    model.parentPages.find((parentPage) => parentPage.id === '0-参考线页面（无需填充）').guides,
    [{ orientation: 'vertical', position: 42.52, source: 'parent-page' }],
  );
});

test('snapshotToSemanticModel restores observed page-local guides from protocol attrs', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'reverse-observation.html' },
    pages: [{
      id: 'page-8',
      index: 7,
      widthMm: 1496.69,
      heightMm: 841.89,
      rectPx: { x: 0, y: 0, width: 1496.69, height: 841.89 },
      classList: ['page'],
      attributes: {
        'data-page': '8',
        'data-id-observed': 'true',
        'data-id-reverse-mode': 'observation',
        'data-id-margin': '56.69px 42.52px 28.35px 42.52px',
        'data-id-guides': '[{"orientation":"horizontal","position":512.125,"source":"page"}]',
      },
      computedStyle: {
        display: 'grid',
        gridTemplateRows: '100px 100px 100px',
      },
      items: [],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.deepEqual(model.pages[0].guides, [
    { orientation: 'horizontal', position: 512.125, source: 'page' },
  ]);
});

test('snapshotToSemanticModel does not infer page semantic from data-page', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'sheet-01',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'cover' },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].sourceNode.attributes['data-page'], 'cover');
  assert.equal(model.pages[0].semantic, null);
  assert.equal(model.pages[0].labels[0].semantic, null);
});

test('snapshotToSemanticModel does not infer item semantic from style tokens', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [
        {
          id: 'title',
          role: 'text',
          tagName: 'h1',
          classList: ['page-title'],
          attributes: { 'data-id-paragraph-style': 'page-title' },
          sourceNode: { tagName: 'h1', id: 'title', classList: ['page-title'], attributes: { 'data-id-paragraph-style': 'page-title' } },
          rectPx: { x: 10, y: 10, width: 40, height: 10 },
          text: '标题',
          runs: [],
        },
        {
          id: 'card',
          role: 'shape',
          tagName: 'div',
          classList: ['chapter-card'],
          attributes: { 'data-id-object-style': 'chapter-card', 'data-id-layer': '原始图层' },
          sourceNode: { tagName: 'div', id: 'card', classList: ['chapter-card'], attributes: { 'data-id-object-style': 'chapter-card', 'data-id-layer': '原始图层' } },
          rectPx: { x: 10, y: 30, width: 40, height: 20 },
          text: '',
          runs: [],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.deepEqual(model.pages[0].items.map((item) => item.semantic), [null, null]);
  assert.deepEqual(model.pages[0].items.map((item) => item.labels[0].semantic), [null, null]);
  assert.equal(model.pages[0].items[1].layer, '原始图层');
  assert.equal(model.pages[0].items[1].styleRefs.layer, '原始图层');
});

test('snapshotToSemanticModel uses authored page-local bounds for observed reverse absolute objects', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 40, y: 1000, width: 1496, height: 841.5 },
      attributes: {
        'data-page': 'page-1',
        'data-id-observed': 'true',
        'data-id-reverse-mode': 'observation',
      },
      computedStyle: {},
      items: [{
        id: 'caption',
        role: 'text',
        tagName: 'figcaption',
        classList: ['observed-text', 'id-object'],
        attributes: { id: 'caption' },
        rectPx: { x: 1040, y: 1250, width: 216, height: 37 },
        authoredStyle: {
          position: 'absolute',
          left: '100px',
          top: '200px',
          width: '216px',
          height: '37px',
        },
        computedStyle: {},
        text: '材料标题',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.deepEqual(model.pages[0].items[0].bounds, {
    x: 100,
    y: 200,
    width: 216,
    height: 37,
  });
});

test('snapshotToSemanticModel restores SVG vector point types from metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 0, y: 0, width: 1000, height: 562.5 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'observed-vector',
        role: 'shape',
        tagName: 'svg',
        classList: ['id-object'],
        attributes: {
          id: 'observed-vector',
          'data-id-vector': 'polygon',
          viewBox: '0 0 100 50',
        },
        rectPx: { x: 10, y: 20, width: 100, height: 50 },
        computedStyle: {},
        sourceHtml: '<path d="M0 0 C20 0 40 50 50 25 L100 50" data-id-point-types="CORNER CORNER SMOOTH" fill="none" stroke="#000000" stroke-width="1"></path>',
        text: '',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  const points = model.pages[0].items[0].vectorGeometry.paths[0].points;
  assert.deepEqual(points.map((point) => point.pointType), ['CORNER', 'CORNER', 'SMOOTH']);
});

test('snapshotToSemanticModel restores full SVG vector handles from metadata', () => {
  const vectorPoints = [[
    {
      anchor: { x: 10, y: 20 },
      leftDirection: { x: 10, y: 20 },
      rightDirection: { x: 30, y: 10 },
      pointType: 'SMOOTH',
    },
    {
      anchor: { x: 90, y: 20 },
      leftDirection: { x: 70, y: 10 },
      rightDirection: { x: 90, y: 20 },
      pointType: 'PLAIN',
    },
    {
      anchor: { x: 60, y: 60 },
      leftDirection: { x: 70, y: 70 },
      rightDirection: { x: 48, y: 52 },
      pointType: 'SMOOTH',
    },
  ]];
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 0, y: 0, width: 1000, height: 562.5 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'observed-vector',
        role: 'shape',
        tagName: 'svg',
        classList: ['id-object'],
        attributes: {
          id: 'observed-vector',
          'data-id-vector': 'polygon',
          viewBox: '0 0 100 80',
        },
        rectPx: { x: 100, y: 200, width: 100, height: 80 },
        computedStyle: {},
        sourceHtml: `<path d="M10 20 C30 10 70 10 90 20 L60 60 Z" data-id-vector-points='${JSON.stringify(vectorPoints)}' fill="#efffec" stroke="none"></path>`,
        text: '',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  const points = model.pages[0].items[0].vectorGeometry.paths[0].points;
  assert.deepEqual(points[2].rightDirection, { x: 148, y: 252 });
  assert.equal(points[2].pointType, 'SMOOTH');
});

test('snapshotToSemanticModel restores open SVG vector fill from protocol attrs', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 0, y: 0, width: 1000, height: 562.5 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'filled-open-line',
        role: 'line',
        tagName: 'svg',
        classList: ['id-object'],
        attributes: {
          id: 'filled-open-line',
          'data-id-vector': 'line',
          viewBox: '0 0 2 100',
        },
        rectPx: { x: 10, y: 20, width: 2, height: 100 },
        computedStyle: {},
        sourceHtml: '<path d="M1 0 L1 100" fill="none" data-id-fill-color="#000000" stroke="#000000" stroke-width="2"></path>',
        text: '',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.pages[0].items[0].visualStyle.fillColor, '#000000');
  assert.equal(model.pages[0].items[0].visualStyle.strokeColor, '#000000');
  assert.equal(model.pages[0].items[0].visualStyle.strokeWeight, 2);
});

test('snapshotToSemanticModel compiles observed InDesign paragraph composer from protocol attrs', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 0, y: 0, width: 1000, height: 562.5 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'date-caption',
        role: 'text',
        tagName: 'p',
        classList: ['observed-text', 'id-object'],
        attributes: {
          id: 'date-caption',
          'data-id-paragraph-style': 'date-caption',
          'data-id-paragraph-composer': 'Adobe 段落排版器',
        },
        rectPx: { x: 10, y: 20, width: 128, height: 50 },
        computedStyle: {
          fontFamily: '微软雅黑',
          fontSize: '18px',
          lineHeight: '22px',
          color: 'rgb(102, 102, 102)',
          textAlign: 'right',
          marginBottom: '28.3465px',
        },
        text: '2026年3月27日\n线上会议',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.styles.paragraphStyles['date-caption'].composer, 'Adobe 段落排版器');
  assert.equal(model.styles.paragraphStyles['date-caption'].spaceAfter, 28.3465);
});

test('snapshotToSemanticModel uses observed panel style names as executable style names', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      rectPx: { x: 0, y: 0, width: 1000, height: 562.5 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'observed-copy',
        role: 'text',
        tagName: 'p',
        classList: ['observed-text', 'id-object'],
        attributes: {
          id: 'observed-copy',
          'data-id-paragraph-style': '标准正文（18点左对齐）',
          'data-id-paragraph-style-name': '标准正文-18点左对齐-57801789',
          'data-id-object-style': '[基本文本框架]',
          'data-id-object-style-name': '基本文本框架',
        },
        rectPx: { x: 10, y: 20, width: 128, height: 50 },
        computedStyle: {
          fontFamily: '微软雅黑',
          fontSize: '18px',
          lineHeight: '22px',
          color: 'rgb(102, 102, 102)',
          textAlign: 'right',
        },
        text: '观察文本',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.pages[0].items[0].styleRefs.paragraphStyle, '标准正文-18点左对齐-57801789');
  assert.equal(model.pages[0].items[0].styleRefs.objectStyle, '基本文本框架');
});

test('snapshotToSemanticModel emits canonical role without retired item type', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'copy',
        role: 'text',
        tagName: 'p',
        classList: ['id-object'],
        attributes: {},
        rectPx: { x: 10, y: 20, width: 60, height: 10 },
        computedStyle: {},
        text: '正文',
        runs: [],
      }],
    }],
    assets: [],
    styles: {},
  }, { unitMode: 'print' });

  const item = model.pages[0].items[0];
  assert.equal(item.role, 'text');
  assert.equal(Object.hasOwn(item, 'type'), false);
});

test('snapshotToSemanticModel filters item styleRefs to registry allowed keys', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: { 'data-page': 'page-1' },
      computedStyle: {},
      items: [{
        id: 'styled-copy',
        role: 'text',
        tagName: 'p',
        classList: ['id-object'],
        attributes: {
          'data-id-layer': '正文图层',
          'data-id-style-token': 'synth-copy',
          'data-id-style-name': '正文合成样式',
        },
        rectPx: { x: 10, y: 20, width: 60, height: 10 },
        computedStyle: {},
        styleRefs: {
          paragraphStyle: '正文',
          characterStyle: '强调',
          objectStyle: '文本框',
          frameStyle: '正文框',
          tableStyle: '表格',
          cellStyle: '单元格',
          paragraphStyleDisplayName: '正文显示名',
          characterStyleDisplayName: '强调显示名',
          objectStyleDisplayName: '文本框显示名',
          frameStyleDisplayName: '正文框显示名',
          tableStyleDisplayName: '表格显示名',
          displayName: '通用显示名',
          genericStyle: '通用样式',
          characterStyles: ['旧复数样式'],
          swatch: '旧色板',
        },
        text: '正文',
        runs: [],
      }],
    }],
    assets: [],
    styles: {},
  }, { unitMode: 'print' });

  assert.deepEqual(model.pages[0].items[0].styleRefs, {
    paragraphStyle: '正文',
    characterStyle: '强调',
    objectStyle: '文本框',
    frameStyle: '正文框',
    tableStyle: '表格',
    cellStyle: '单元格',
    paragraphStyleDisplayName: '正文显示名',
    characterStyleDisplayName: '强调显示名',
    objectStyleDisplayName: '文本框显示名',
    frameStyleDisplayName: '正文框显示名',
    tableStyleDisplayName: '表格显示名',
    displayName: '通用显示名',
    genericStyle: '通用样式',
    layer: '正文图层',
    synthesizedToken: 'synth-copy',
    synthesizedName: '正文合成样式',
  });
});

test('snapshotToSemanticModel ignores retired parent page display-name alias', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'p1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: {
        'data-page': 'p1',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-display-name': '汇报母版',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].parentPageName, null);
  assert.equal(model.parentPages[0].name, 'report-parent');
});

test('snapshotToSemanticModel preserves authoring source package labels', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'deck.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
        'data-id-semantic-preset': 'semantic-preset.json',
        'data-id-profile': 'architecture-report',
      },
      styleFiles: ['styles/tokens.css'],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    pages: [
      {
        id: 'agenda-page',
        index: 0,
        widthMm: 420,
        heightMm: 236.25,
        rectPx: { x: 0, y: 0, width: 1587.39, height: 892.91 },
        attributes: {
          'data-page': 'agenda',
          'data-id-source-file': 'pages/01-agenda.html',
          'data-id-layout': 'contents-grid',
          'data-id-grid': '12x6',
          'data-id-column-gutter': '6mm',
          'data-id-row-gutter': '8mm',
          'data-id-baseline': '4mm',
        },
        classList: ['page'],
        computedStyle: { width: '1587.39px', height: '892.91px', backgroundColor: 'rgb(255, 255, 255)' },
        items: [
          {
            id: 'agenda-card',
            role: 'shape',
            tagName: 'div',
            classList: ['chapter-card', 'grid-item'],
            attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            sourceNode: {
              tagName: 'div',
              id: 'agenda-card',
              classList: ['chapter-card', 'grid-item'],
              attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            },
            cssVars: {
              '--grid-col': '5',
              '--grid-span': '3',
              '--grid-row': '2',
              '--grid-row-span': '2',
            },
            rectPx: { x: 100, y: 100, width: 200, height: 100 },
            boundsMm: { x: 10, y: 10, width: 20, height: 10 },
            computedStyle: {},
            authoredStyle: {},
            text: '',
            runs: [],
            table: [],
          },
        ],
      },
    ],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.sourcePackage.config, 'deck.config.json');
  assert.deepEqual(model.sourcePackage.semanticPreset, {
    source: 'project',
    id: 'architecture-report',
    relativePath: 'semantic-preset.json',
  });
  assert.equal(model.pages[0].sourceFile, 'pages/01-agenda.html');
  assert.equal(model.pages[0].grid.columns, 12);
  assert.equal(model.pages[0].items[0].sourceFile, 'pages/01-agenda.html');
  assert.deepEqual(model.pages[0].items[0].layout.grid, { col: 5, span: 3, row: 2, rowSpan: 2 });

  const documentLabel = model.labels.find((label) => label.kind === 'document');
  const pageLabel = model.pages[0].labels.find((label) => label.kind === 'page');
  const itemLabel = model.pages[0].items[0].labels.find((label) => label.kind === 'item');

  assert.equal(documentLabel.sourcePackage.config, 'deck.config.json');
  assert.deepEqual(documentLabel.sourcePackage.semanticPreset, {
    source: 'project',
    id: 'architecture-report',
    relativePath: 'semantic-preset.json',
  });
  assert.equal(pageLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceNode.tagName, 'div');
  assert.equal(itemLabel.structure.parentId, 'agenda-page');
});

test('snapshotToSemanticModel labels source text runs and nonvisual ancestor nodes', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'agenda' },
      computedStyle: {},
      items: [
        {
          id: 'agenda-copy',
          role: 'text',
          tagName: 'p',
          classList: ['body-copy'],
          attributes: { 'data-id-paragraph-style': 'body-copy' },
          sourceNode: { tagName: 'p', id: 'agenda-copy', classList: ['body-copy'], attributes: { 'data-id-paragraph-style': 'body-copy' } },
          sourceAncestorNodes: [
            { sourcePath: 'section>div:nth-of-type(1)', tagName: 'div', id: null, classList: ['legend-item'], attributes: {} },
          ],
          documentOrder: 1,
          text: 'PDF 置入',
          rectPx: { x: 10, y: 10, width: 200, height: 30 },
          runs: [
            { text: 'PDF 置入', tagName: 'span', classList: ['accent'], attributes: { 'data-id-character-style': 'term-accent' } },
          ],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  const label = model.pages[0].items[0].labels[0];

  assert.equal(label.sourceText, 'PDF 置入');
  assert.deepEqual(label.sourceRuns, [
    {
      text: 'PDF 置入',
      tagName: 'span',
      classList: ['accent'],
      attributes: { 'data-id-character-style': 'term-accent' },
    },
  ]);
  assert.equal(label.sourceAncestorNodes[0].classList[0], 'legend-item');
});

test('snapshotToSemanticModel omits whole-item source runs and keeps source inner html', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'title.html' },
    pages: [{
      id: 'cover-page',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'cover' },
      computedStyle: {},
      items: [
        {
          id: 'title',
          role: 'text',
          tagName: 'h1',
          classList: ['cover-title'],
          attributes: { 'data-id-paragraph-style': 'cover-title' },
          sourceNode: {
            tagName: 'h1',
            id: null,
            classList: ['cover-title'],
            attributes: { 'data-id-paragraph-style': 'cover-title' },
            sourceHtml: '冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报</span>',
          },
          documentOrder: 1,
          text: '冰球场首层平面排布汇报',
          rectPx: { x: 10, y: 10, width: 400, height: 80 },
          runs: [
            { text: '冰球场首层平面排布汇报', tagName: 'h1', classList: ['cover-title'], attributes: { 'data-id-paragraph-style': 'cover-title' } },
          ],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  const label = model.pages[0].items[0].labels[0];

  assert.equal(label.sourceHtml, '冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报</span>');
  assert.deepEqual(label.sourceRuns, []);
});

test('snapshotToSemanticModel uses nearest candidate ancestor as structure parent', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'page-1', 'data-id-grid': '12x6' },
      computedStyle: {},
      items: [
        {
          id: 'card-1',
          role: 'shape',
          tagName: 'div',
          classList: ['metric-card'],
          attributes: { 'data-id-object': '' },
          sourceNode: { tagName: 'div', id: 'card-1', classList: ['metric-card'], attributes: { 'data-id-object': '' } },
          documentOrder: 1,
          rectPx: { x: 10, y: 10, width: 300, height: 120 },
        },
        {
          id: 'card-1-value',
          role: 'text',
          tagName: 'p',
          classList: ['metric-value'],
          attributes: { 'data-id-paragraph-style': 'metric-value' },
          sourceNode: { tagName: 'p', id: 'card-1-value', classList: ['metric-value'], attributes: { 'data-id-paragraph-style': 'metric-value' } },
          ancestorCandidateIds: ['card-1'],
          documentOrder: 2,
          text: '243.75m',
          rectPx: { x: 20, y: 20, width: 200, height: 40 },
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  assert.equal(model.pages[0].items[1].structure.parentId, 'card-1');
});
