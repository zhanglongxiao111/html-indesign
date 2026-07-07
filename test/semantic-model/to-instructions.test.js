const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, snapshotToSemanticModel } = require('../../src/adapters/html');
const { semanticModelToInstructions } = require('../../src/writers/indesign');

test('semanticModelToInstructions produces current executor schema', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.unitMode, 'presentation');
  assert.equal(instructions.document.coordinateUnit, 'pt');
  assert.equal(instructions.document.pages.length, model.pages.length);
  assert.equal(instructions.pages.length, model.pages.length);
  assert.equal(Array.isArray(instructions.layers), true);
  assert.equal(instructions.pages[0].items.every((item) => item.id && item.type && item.bounds), true);
});

test('semanticModelToInstructions carries labels for document pages guides layers and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.labels[0].kind, 'document');
  assert.equal(instructions.document.pages[0].labels[0].kind, 'page');
  assert.equal(instructions.document.pages[0].guides[0].labels[0].kind, 'guide');
  assert.equal(instructions.layers.every((layer) => Array.isArray(layer.labels) && layer.labels.length > 0), true);
  assert.equal(instructions.pages[0].items.every((item) => Array.isArray(item.labels) && item.labels.length > 0), true);
});

test('semanticModelToInstructions preserves semantic preset document label metadata', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'document',
      id: 'doc',
      source: 'html-to-indesign',
      semanticPreset: {
        source: 'project',
        id: 'architecture-report',
        relativePath: 'semantic-preset.json',
      },
    }],
    parentPages: [],
    pages: [],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);

  assert.deepEqual(instructions.document.labels[0].semanticPreset, {
    source: 'project',
    id: 'architecture-report',
    relativePath: 'semantic-preset.json',
  });
});

test('semanticModelToInstructions emits parent pages and page parent references', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'doc', source: 'html-to-indesign' }],
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      semantic: 'report-parent',
      provides: ['guides'],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'report-parent', source: 'html-to-indesign' }],
      items: [{
        id: 'parent-rule',
        role: 'line',
        semantic: null,
        bounds: { x: 10, y: 12, width: 80, height: 1 },
        styleRefs: { objectStyle: '装饰线' },
        visualStyle: { strokeColor: '#999999', strokeWeight: 1 },
        vectorGeometry: { kind: 'line', paths: [] },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'parent-rule', source: 'html-to-indesign' }],
      }],
    }],
    pages: [{
      id: 'p1',
      index: 0,
      width: 100,
      height: 80,
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      layout: 'contents-grid',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      guides: [],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'page', id: 'p1', source: 'html-to-indesign' }],
      items: [],
    }],
    styles: {},
    assets: [],
  };
  const instructions = semanticModelToInstructions(model);

  assert.equal(instructions.document.parentPages[0].id, 'report-parent');
  assert.equal(instructions.document.parentPages[0].items.length, 1);
  assert.equal(instructions.document.parentPages[0].items[0].id, 'parent-rule');
  assert.equal(instructions.document.parentPages[0].items[0].type, 'LINE');
  assert.deepEqual(instructions.document.parentPages[0].guides, []);
  assert.equal(instructions.document.pages[0].parentPageId, 'report-parent');
  assert.equal(instructions.document.pages[0].parentPageName, '汇报母版');
  assert.equal(instructions.document.pages[0].layout, 'contents-grid');
  assert.equal(instructions.pages[0].parentPageId, 'report-parent');
  assert.equal(instructions.pages[0].layout, 'contents-grid');
});

test('semanticModelToInstructions prunes blank and unused parent pages', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'parent-prune-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [
      { id: 'blank-applied', name: '空白已应用母版', guides: [], items: [] },
      {
        id: 'unused-guided',
        name: '未使用参考线母版',
        guides: [{ orientation: 'horizontal', position: 10, source: 'parent-page' }],
        items: [],
      },
      {
        id: 'used-guided',
        name: '有效参考线母版',
        guides: [{ orientation: 'vertical', position: 20, source: 'parent-page' }],
        items: [],
      },
    ],
    pages: [
      {
        id: 'blank-page',
        index: 0,
        width: 800,
        height: 450,
        parentPageId: 'blank-applied',
        parentPageName: '空白已应用母版',
        guides: [],
        labels: [],
        items: [],
      },
      {
        id: 'guided-page',
        index: 1,
        width: 800,
        height: 450,
        parentPageId: 'used-guided',
        parentPageName: '有效参考线母版',
        guides: [],
        labels: [],
        items: [],
      },
    ],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);

  assert.deepEqual(instructions.document.parentPages.map((page) => page.id), ['used-guided']);
  assert.equal(instructions.document.pages[0].parentPageId, null);
  assert.equal(instructions.document.pages[0].parentPageName, null);
  assert.equal(instructions.pages[0].parentPageId, null);
  assert.equal(instructions.pages[1].parentPageId, 'used-guided');
});

test('semanticModelToInstructions keeps parent pages used through nested parent references', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'nested-parent-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [
      {
        id: '0-参考线页面（无需填充）',
        name: '0-参考线页面（无需填充）',
        guides: [{ orientation: 'vertical', position: 42.52, source: 'parent-page' }],
        items: [],
      },
      {
        id: 'I-两张竖构图',
        name: 'I-两张竖构图',
        parentPageId: '0-参考线页面（无需填充）',
        parentPageName: '0-参考线页面（无需填充）',
        guides: [],
        items: [],
      },
    ],
    pages: [
      {
        id: 'page-12',
        index: 11,
        width: 1496.69,
        height: 841.89,
        parentPageId: 'I-两张竖构图',
        parentPageName: 'I-两张竖构图',
        guides: [],
        labels: [],
        items: [],
      },
    ],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);

  assert.deepEqual(
    instructions.document.parentPages.map((parentPage) => parentPage.id),
    ['0-参考线页面（无需填充）', 'I-两张竖构图'],
  );
  const layoutParent = instructions.document.parentPages.find((parentPage) => parentPage.id === 'I-两张竖构图');
  assert.equal(layoutParent.parentPageId, '0-参考线页面（无需填充）');
  assert.equal(layoutParent.parentPageName, '0-参考线页面（无需填充）');
  assert.equal(instructions.pages[0].parentPageId, 'I-两张竖构图');
});

test('semanticModelToInstructions does not emit default white page backgrounds as page items', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'white-background-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      index: 0,
      width: 100,
      height: 80,
      computedStyle: { backgroundColor: 'rgb(255, 255, 255)' },
      labels: [],
      items: [],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);

  assert.equal(instructions.pages[0].items.some((item) => item.role === 'background'), false);
  assert.equal(instructions.document.parentPages.length, 0);
  assert.equal(instructions.document.pages[0].parentPageId, null);
});

test('semanticModelToInstructions emits non-default page backgrounds through a parent page', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'tinted-background-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      index: 0,
      width: 100,
      height: 80,
      computedStyle: { backgroundColor: 'rgb(245, 241, 232)' },
      labels: [],
      items: [],
    }, {
      id: 'p2',
      index: 1,
      width: 100,
      height: 80,
      computedStyle: { backgroundColor: 'rgb(245, 241, 232)' },
      labels: [],
      items: [],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);
  const backgroundParent = instructions.document.parentPages.find((entry) => entry.id === 'background-245-241-232-100x80');

  assert.equal(instructions.pages.every((page) => page.items.every((item) => item.role !== 'background')), true);
  assert.equal(backgroundParent.items.length, 1);
  assert.equal(backgroundParent.items[0].id, 'background-245-241-232-100x80-fill');
  assert.equal(backgroundParent.items[0].role, 'background');
  assert.equal(backgroundParent.items[0].styleOverride.fillColor, '颜色-245-241-232');
  assert.equal(instructions.pages[0].parentPageId, 'background-245-241-232-100x80');
  assert.equal(instructions.pages[1].parentPageId, 'background-245-241-232-100x80');
  assert.equal(instructions.document.pages[0].parentPageId, 'background-245-241-232-100x80');
  assert.equal(instructions.document.pages[1].parentPageId, 'background-245-241-232-100x80');
});

test('semanticModelToInstructions emits bounded text fit for observed reverse text frames', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'text-1',
        role: 'text',
        semantic: null,
        bounds: { x: 10, y: 20, width: 80, height: 20 },
        content: { text: '2026年1月26日区委专题会' },
        sourceNode: { attributes: { 'data-id-observed': 'true', 'data-id-reverse-mode': 'observation' } },
        structure: { parentId: 'p1', order: 1 },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'text-1');

  assert.deepEqual(item.textFit, {
    mode: 'expand-frame-to-content',
    maxGrowX: 96,
    maxGrowY: 48,
    preservePosition: true,
  });
});

test('semanticModelToInstructions reads InDesign effects from item extensions', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'reverse-effects-deck',
    unitMode: 'print',
    coordinateUnit: 'mm',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 100,
      height: 80,
      items: [{
        id: 'gradient-veil',
        role: 'shape',
        bounds: { x: 10, y: 12, width: 40, height: 20 },
        styleRefs: {},
        extensions: {
          indesign: {
            effects: {
              gradientFeather: {
                scope: 'fill',
                type: 'linear',
                angle: 0,
                start: { x: 10, y: 12 },
                length: 40,
                stops: [
                  { offset: 0, opacity: 94 },
                  { offset: 100, opacity: 8 },
                ],
              },
            },
          },
        },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'gradient-veil');

  assert.notEqual(item.effects, null);
  assert.deepEqual(
    item.effects.gradientFeather,
    model.pages[0].items[0].extensions.indesign.effects.gradientFeather,
  );
});

test('semanticModelToInstructions does not fill current item fields from raw fallback dialects', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'raw-fallback-retirement',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 100,
      height: 80,
      items: [{
        id: 'shape-with-raw-text',
        role: 'shape',
        bounds: { x: 10, y: 10, width: 40, height: 20 },
        raw: {
          role: 'text',
          content: { text: 'retired raw text' },
          styleRefs: { paragraphStyle: 'raw-paragraph' },
          visualStyle: { fillColor: '#ff0000' },
        },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);
  const item = instructions.pages[0].items.find((entry) => entry.id === 'shape-with-raw-text');

  assert.equal(item.type, 'SHAPE');
  assert.equal(item.role, 'shape');
  assert.equal(item.text, undefined);
  assert.deepEqual(item.styleRefs, {});
  assert.equal(item.visualStyle, undefined);
});

test('semanticModelToInstructions does not backfill protocol label role from instruction output type', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'label-role-retirement',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 100,
      height: 80,
      items: [{
        id: 'missing-role-item',
        bounds: { x: 10, y: 10, width: 40, height: 20 },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);
  const item = instructions.pages[0].items.find((entry) => entry.id === 'missing-role-item');

  assert.equal(item.type, 'SHAPE');
  assert.equal(item.role, undefined);
  assert.equal(item.labels[0].role, null);
});

test('semanticModelToInstructions preserves observed text frame bounds despite larger line height', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-fixed-bounds-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    layoutInfo: {
      unitMode: 'presentation',
      targetUnit: 'pt',
      targetSize: { width: 1000, height: 600 },
      scale: 1,
    },
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'space-text-frame',
        role: 'text',
        semantic: null,
        bounds: { x: 370.5, y: 610.13, width: 36.26, height: 15.43 },
        computedStyle: { fontSize: '18px', lineHeight: '28px' },
        content: { text: ' ' },
        sourceNode: {
          classList: ['observed-text', 'id-object'],
          attributes: { class: 'observed-text id-object' },
        },
        structure: { parentId: 'p1', order: 1 },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'space-text-frame');

  assert.deepEqual(item.bounds, { x: 370.5, y: 610.13, width: 36.26, height: 15.43 });
  assert.equal(item.textFit.mode, 'expand-frame-to-content');
});

test('semanticModelToInstructions emits bounded text fit for observed source nodes stored in protocol labels', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'text-1',
        role: 'text',
        semantic: null,
        bounds: { x: 10, y: 20, width: 80, height: 20 },
        content: { text: '2026年1月26日区委专题会' },
        labels: [{
          protocol: 'html-indesign',
          kind: 'item',
          sourceNode: {
            tagName: 'p',
            classList: ['observed-text', 'id-object'],
            attributes: { class: 'observed-text id-object' },
          },
        }],
        structure: { parentId: 'p1', order: 1 },
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'text-1');

  assert.equal(item.textFit.mode, 'expand-frame-to-content');
});

test('semanticModelToInstructions preserves observed source html line breaks in text instructions', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'date-1',
        role: 'text',
        bounds: { x: 10, y: 20, width: 128, height: 50 },
        content: {
          text: '2026年1月26日区委专题会',
          runs: [{ text: '2026年1月26日区委专题会', characterStyle: null }],
        },
        labels: [{
          protocol: 'html-indesign',
          kind: 'item',
          sourceHtml: '2026年1月26日<br>区委专题会',
          sourceNode: {
            tagName: 'p',
            classList: ['observed-text', 'id-object'],
            attributes: { class: 'observed-text id-object' },
          },
        }],
      }],
    }],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'date-1');

  assert.equal(item.text, '2026年1月26日\n区委专题会');
  assert.deepEqual(item.runs, [{ text: '2026年1月26日\n区委专题会', characterStyle: null }]);
});

test('semanticModelToInstructions emits observed zero-width vector objects as native lines', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'line-1',
        role: 'line',
        raw: {
          id: 'line-1',
          role: 'line',
          boundsMm: { x: 120, y: 80, width: 0, height: 109 },
          computedStyle: {},
        },
        bounds: { x: 120, y: 80, width: 0, height: 109 },
        labels: [{
          protocol: 'html-indesign',
          kind: 'item',
          sourceHtml: '<path d="M0.25 0 L0.25 109" fill="none" stroke="#8ca064" stroke-width="0.5"></path>',
          sourceNode: {
            tagName: 'svg',
            attributes: { 'data-id-vector': 'line', viewBox: '0 0 0.5 109' },
          },
        }],
      }],
    }],
    styles: {
      swatches: {
        '颜色-140-160-100': { name: '颜色-140-160-100', model: 'process', space: 'RGB', value: '#8ca064' },
      },
    },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'line-1');

  assert.equal(item.type, 'LINE');
  assert.deepEqual(item.bounds, { x: 120, y: 80, width: 0, height: 109 });
  assert.equal(item.strokeColor, '颜色-140-160-100');
  assert.equal(item.strokeWeight, 0.5);
});

test('semanticModelToInstructions emits zero-width stroked object-style shapes as native lines', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [{
        id: 'line-style-1',
        role: 'shape',
        raw: {
          id: 'line-style-1',
          role: 'shape',
          boundsMm: { x: 120, y: 80, width: 0, height: 33 },
          computedStyle: {},
          styleRefs: { objectStyle: '装饰线-细' },
        },
        bounds: { x: 120, y: 80, width: 0, height: 33 },
        styleRefs: { objectStyle: '装饰线-细' },
        labels: [{
          protocol: 'html-indesign',
          kind: 'item',
          sourceHtml: '<path d="M1 33 L1 0" fill="none" stroke="none" stroke-width="2"></path>',
          sourceNode: {
            tagName: 'svg',
            attributes: { 'data-id-vector': 'polygon', viewBox: '0 0 2 33' },
          },
        }],
      }],
    }],
    styles: {
      objectStyles: {
        '装饰线-细': {
          strokeColor: '颜色-153-153-153',
          strokeWeight: 1,
          fillColor: null,
        },
      },
      swatches: {
        '颜色-153-153-153': { name: '颜色-153-153-153', model: 'process', space: 'RGB', value: '#999999' },
      },
    },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'line-style-1');

  assert.equal(item.type, 'LINE');
  assert.equal(item.objectStyle, '装饰线-细');
  assert.deepEqual(item.bounds, { x: 120, y: 80, width: 0, height: 33 });
  assert.equal(item.strokeColor, '颜色-153-153-153');
  assert.equal(item.strokeWeight, 1);
});

test('semanticModelToInstructions preserves observed vector paths and paint as native vector instructions', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-vector-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'route-arrow',
        role: 'line',
        bounds: { x: 40, y: 60, width: 180, height: 80 },
        visualStyle: {
          fillColor: null,
          strokeColor: '#c8102e',
          strokeWeight: 4,
          strokeOpacity: 75,
          strokeStyle: '虚线（3 和 2）',
          blendMode: 'multiply',
          strokeLineCap: 'round',
          strokeLineJoin: 'bevel',
          strokeMiterLimit: 6,
          lineStartMarker: { type: 'circle', rawName: 'Circle' },
          lineEndMarker: { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
        },
        vectorGeometry: {
          kind: 'path',
          paths: [{
            closed: false,
            points: [
              {
                anchor: { x: 40, y: 60 },
                leftDirection: { x: 40, y: 60 },
                rightDirection: { x: 80, y: 40 },
              },
              {
                anchor: { x: 220, y: 140 },
                leftDirection: { x: 180, y: 160 },
                rightDirection: { x: 220, y: 140 },
              },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }, {
        id: 'filled-zone',
        role: 'shape',
        bounds: { x: 240, y: 60, width: 80, height: 60 },
        visualStyle: {
          fillColor: '#ff9339',
          fillOpacity: 42,
          strokeColor: '#14324a',
          strokeWeight: 1.5,
        },
        vectorGeometry: {
          kind: 'polygon',
          paths: [{
            closed: true,
            points: [
              { anchor: { x: 240, y: 60 }, leftDirection: { x: 240, y: 60 }, rightDirection: { x: 240, y: 60 } },
              { anchor: { x: 320, y: 60 }, leftDirection: { x: 320, y: 60 }, rightDirection: { x: 320, y: 60 } },
              { anchor: { x: 320, y: 120 }, leftDirection: { x: 320, y: 120 }, rightDirection: { x: 320, y: 120 } },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const line = instructions.pages[0].items.find((entry) => entry.id === 'route-arrow');
  const zone = instructions.pages[0].items.find((entry) => entry.id === 'filled-zone');

  assert.equal(line.type, 'LINE');
  assert.deepEqual(line.vectorGeometry, model.pages[0].items[0].vectorGeometry);
  assert.equal(line.styleOverride.strokeColor, '颜色-200-16-46');
  assert.equal(line.styleOverride.strokeWeight, 4);
  assert.equal(line.styleOverride.strokeOpacity, 75);
  assert.equal(line.styleOverride.strokeStyle, '虚线（3 和 2）');
  assert.equal(line.styleOverride.blendMode, 'multiply');
  assert.equal(line.styleOverride.strokeLineCap, 'round');
  assert.equal(line.styleOverride.strokeLineJoin, 'bevel');
  assert.equal(line.styleOverride.strokeMiterLimit, 6);
  assert.deepEqual(line.styleOverride.lineStartMarker, { type: 'circle', rawName: 'Circle' });
  assert.deepEqual(line.styleOverride.lineEndMarker, { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' });
  assert.equal(zone.type, 'SHAPE');
  assert.equal(zone.shapeKind, 'polygon');
  assert.deepEqual(zone.vectorGeometry, model.pages[0].items[1].vectorGeometry);
  assert.equal(zone.styleOverride.fillColor, '颜色-255-147-57');
  assert.equal(zone.styleOverride.fillOpacity, 42);
  assert.equal(zone.styleOverride.strokeColor, '颜色-20-50-74');
  assert.equal(zone.styleOverride.strokeWeight, 1.5);
  assert.equal(instructions.styles.swatches['颜色-200-16-46'].value, '#c8102e');
  assert.equal(instructions.styles.swatches['颜色-255-147-57'].value, '#ff9339');
});

test('semanticModelToInstructions keeps open observed polygon paths as native shapes', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'open-polygon-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'open-triangle',
        role: 'shape',
        bounds: { x: 40, y: 60, width: 80, height: 40 },
        visualStyle: {
          fillColor: null,
          strokeColor: '#000000',
          strokeWeight: 1,
        },
        vectorGeometry: {
          kind: 'polygon',
          paths: [{
            closed: false,
            points: [
              { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 }, pointType: 'CORNER' },
              { anchor: { x: 40, y: 100 }, leftDirection: { x: 40, y: 100 }, rightDirection: { x: 40, y: 100 }, pointType: 'CORNER' },
              { anchor: { x: 120, y: 80 }, leftDirection: { x: 120, y: 80 }, rightDirection: { x: 120, y: 80 }, pointType: 'CORNER' },
              { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 }, pointType: 'CORNER' },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'open-triangle');

  assert.equal(item.type, 'SHAPE');
  assert.equal(item.shapeKind, 'polygon');
  assert.deepEqual(item.vectorGeometry, model.pages[0].items[0].vectorGeometry);
});

test('semanticModelToInstructions preserves observed text frame vector paint overrides', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-text-frame-vector-paint',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'text-arrow-frame',
        role: 'text',
        bounds: { x: 40, y: 60, width: 180, height: 80 },
        content: { text: '' },
        visualStyle: {
          strokeStyle: '虚线（3 和 2）',
          strokeAlignment: 'center',
          lineEndMarker: { type: null, rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'text-arrow-frame');

  assert.equal(item.type, 'TEXT');
  assert.deepEqual(item.styleOverride.lineEndMarker, { type: null, rawName: 'SIMPLE_WIDE_ARROW_HEAD' });
  assert.equal(item.styleOverride.strokeStyle, '虚线（3 和 2）');
});

test('semanticModelToInstructions emits line-like open polygon markers as native lines', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'polygon-marker-line-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'polygon-marker-line',
        role: 'shape',
        bounds: { x: 40, y: 60, width: 24, height: 0 },
        visualStyle: {
          fillColor: null,
          strokeColor: null,
          strokeWeight: 0,
          strokeStyle: '实底',
          lineEndMarker: { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
        },
        vectorGeometry: {
          kind: 'polygon',
          paths: [{
            closed: false,
            points: [
              { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 }, pointType: 'PLAIN' },
              { anchor: { x: 64, y: 60 }, leftDirection: { x: 64, y: 60 }, rightDirection: { x: 64, y: 60 }, pointType: 'PLAIN' },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const item = instructions.pages[0].items.find((entry) => entry.id === 'polygon-marker-line');

  assert.equal(item.type, 'LINE');
  assert.deepEqual(item.bounds, { x: 40, y: 60, width: 24, height: 0 });
  assert.deepEqual(item.vectorGeometry, model.pages[0].items[0].vectorGeometry);
  assert.deepEqual(item.styleOverride.lineEndMarker, { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' });
  assert.equal(item.styleOverride.strokeWeight, 0);
});

test('semanticModelToInstructions can preserve explicit observed layer names without style map translation', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-layer-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'title',
        role: 'text',
        bounds: { x: 40, y: 60, width: 180, height: 40 },
        layer: 'text',
        content: { text: 'Title' },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: {},
    assets: [],
  };

  const mapped = semanticModelToInstructions(model, {
    styleNameMap: { layers: { text: '文字' } },
  });
  const preserved = semanticModelToInstructions(model, {
    preserveObservedLayerNames: true,
    styleNameMap: { layers: { text: '文字' } },
  });

  assert.equal(mapped.pages[0].items.find((item) => item.id === 'title').layer, '文字');
  assert.equal(preserved.pages[0].items.find((item) => item.id === 'title').layer, 'text');
});

test('semanticModelToInstructions keeps unsupported observed stroke style names out of executable overrides', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'observed-custom-stroke-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'vertical-rule',
        role: 'line',
        bounds: { x: 40, y: 60, width: 0, height: 120 },
        visualStyle: {
          fillColor: null,
          strokeColor: '#ff7832',
          strokeWeight: 5,
          strokeStyle: '垂直线',
        },
        vectorGeometry: {
          kind: 'line',
          paths: [{
            closed: false,
            points: [
              { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 } },
              { anchor: { x: 40, y: 180 }, leftDirection: { x: 40, y: 180 }, rightDirection: { x: 40, y: 180 } },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const line = instructions.pages[0].items.find((entry) => entry.id === 'vertical-rule');

  assert.equal(line.visualStyle.strokeStyle, '垂直线');
  assert.equal(Object.hasOwn(line.styleOverride, 'strokeStyle'), false);
  assert.equal(
    instructions.report.messages.some((message) => (
      message.level === 'warning'
      && message.code === 'STROKE_STYLE_UNSUPPORTED'
      && message.details.itemId === 'vertical-rule'
      && message.details.strokeStyle === '垂直线'
    )),
    true,
  );
});

test('semanticModelToInstructions keeps marker-only vector lines as native line instructions', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'marker-only-line-deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [{
      id: 'p1',
      width: 400,
      height: 240,
      items: [{
        id: 'marker-only-line',
        role: 'line',
        bounds: { x: 40, y: 60, width: 0, height: 120 },
        visualStyle: {
          fillColor: null,
          strokeColor: null,
          strokeWeight: null,
          lineStartMarker: { type: 'circle', rawName: 'Circle' },
        },
        vectorGeometry: {
          kind: 'line',
          paths: [{
            closed: false,
            points: [
              { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 } },
              { anchor: { x: 40, y: 180 }, leftDirection: { x: 40, y: 180 }, rightDirection: { x: 40, y: 180 } },
            ],
          }],
        },
        styleRefs: {},
        labels: [],
      }],
    }],
    styles: { swatches: {} },
    assets: [],
  };

  const instructions = semanticModelToInstructions(model, {});
  const line = instructions.pages[0].items.find((entry) => entry.id === 'marker-only-line');

  assert.equal(line.type, 'LINE');
  assert.deepEqual(line.vectorGeometry, model.pages[0].items[0].vectorGeometry);
  assert.equal(line.strokeColor, undefined);
  assert.equal(line.strokeWeight, undefined);
  assert.deepEqual(line.styleOverride.lineStartMarker, { type: 'circle', rawName: 'Circle' });
  assert.equal(line.styleOverride.strokeWeight, 0);
});

test('semanticModelToInstructions carries placed PDF page crop and layer visibility options', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'layered-pdf',
            role: 'graphic',
            bounds: { x: 10, y: 20, width: 300, height: 200 },
            zIndex: 1,
            layer: 'drawing',
            sourceSelector: '#layered-pdf',
            styleRefs: {},
            attributes: {
              src: 'previews/layered-pdf.png',
              'data-id-asset-path': './assets/layered.pdf',
              'data-id-asset-kind': 'pdf',
              'data-id-pdf-page': '5',
              'data-id-crop': 'trim',
              'data-id-visible-layers': '结构|标注',
              'data-id-hidden-layers': '家具',
            },
            computedStyle: { objectFit: 'contain', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-layered-pdf',
        src: './assets/layered.pdf',
        kind: 'pdf',
        sourceSelector: '#layered-pdf',
        placement: {
          pageNumber: 5,
          crop: 'trim',
          visibleLayers: ['结构', '标注'],
          hiddenLayers: ['家具'],
        },
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const placed = instructions.pages[0].items.find((item) => item.id === 'layered-pdf').placed;

  assert.equal(placed.assetId, 'asset-layered-pdf');
  assert.equal(placed.pageNumber, 5);
  assert.equal(placed.crop, 'trim');
  assert.deepEqual(placed.visibleLayers, ['结构', '标注']);
  assert.deepEqual(placed.hiddenLayers, ['家具']);
});

test('semanticModelToInstructions does not compile retired data-id-page as a PDF page number', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'retired-page-field-pdf',
            role: 'graphic',
            bounds: { x: 10, y: 20, width: 300, height: 200 },
            zIndex: 1,
            layer: 'drawing',
            sourceSelector: '#retired-page-field-pdf',
            styleRefs: {},
            attributes: {
              data: './assets/layered.pdf',
              type: 'application/pdf',
              'data-id-asset-kind': 'pdf',
              'data-id-page': '5',
            },
            computedStyle: { objectFit: 'contain', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-layered-pdf',
        src: './assets/layered.pdf',
        kind: 'pdf',
        sourceSelector: '#retired-page-field-pdf',
        placement: {},
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const placed = instructions.pages[0].items.find((item) => item.id === 'retired-page-field-pdf').placed;

  assert.equal(placed.pageNumber, undefined);
});

test('semanticModelToInstructions converts manual placed content geometry to absolute content bounds', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'manual-crop',
            role: 'graphic',
            bounds: { x: 100, y: 80, width: 240, height: 160 },
            zIndex: 1,
            layer: 'image',
            sourceSelector: '#manual-crop',
            styleRefs: {},
            attributes: {
              'data-id-asset-path': './assets/render.jpg',
              'data-id-asset-kind': 'raster',
              'data-id-fit': 'manual',
              'data-id-content-x': '-30px',
              'data-id-content-y': '-20px',
              'data-id-content-width': '320px',
              'data-id-content-height': '210px',
              'data-id-content-scale-x': '1.3333',
              'data-id-content-scale-y': '1.3125',
            },
            computedStyle: { objectFit: 'fill', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-render-jpg',
        src: './assets/render.jpg',
        kind: 'raster',
        sourceSelector: '#manual-crop',
        placement: {},
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const graphic = instructions.pages[0].items.find((item) => item.id === 'manual-crop');

  assert.equal(graphic.placed.fit, 'manual');
  assert.deepEqual(graphic.placed.contentBounds, { x: 70, y: 60, width: 320, height: 210 });
  assert.deepEqual(graphic.contentBounds, { x: 70, y: 60, width: 320, height: 210 });
});
