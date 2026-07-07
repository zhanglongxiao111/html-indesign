const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  auditParentPageFurniture,
} = require('../../src/adapters/indesign/audit/parent-page-furniture');

test('auditParentPageFurniture measures promoted repeated page furniture', () => {
  const source = snapshot([
    page('1', [
      lineItem('rule-p1', { y: 32 }),
      textItem('folio-p1', { text: '01', x: 740, y: 540 }),
      imageItem('hero-p1', { path: '\\\\nas\\project\\hero-a.pdf', x: 120, y: 120 }),
    ]),
    page('2', [
      lineItem('rule-p2', { y: 32 }),
      textItem('folio-p2', { text: '02', x: 740, y: 540 }),
      imageItem('hero-p2', { path: '\\\\nas\\project\\hero-b.pdf', x: 120, y: 120 }),
    ]),
    page('3', [
      lineItem('rule-p3', { y: 32 }),
      textItem('folio-p3', { text: '03', x: 740, y: 540 }),
      imageItem('hero-p3', { path: '\\\\nas\\project\\hero-c.pdf', x: 120, y: 120 }),
    ]),
  ]);
  const actual = snapshot([
    page('1', [imageItem('hero-p1', { path: '\\\\nas\\project\\hero-a.pdf', x: 120, y: 120 })]),
    page('2', [imageItem('hero-p2', { path: '\\\\nas\\project\\hero-b.pdf', x: 120, y: 120 })]),
    page('3', [imageItem('hero-p3', { path: '\\\\nas\\project\\hero-c.pdf', x: 120, y: 120 })]),
  ], {
    parentPages: [{
      name: '规范汇报母版',
      items: [
        lineItem('parent-rule', { y: 32 }),
        textItem('parent-folio', { text: '3', x: 740, y: 540, semantic: 'folio' }),
      ],
    }],
  });

  const report = auditParentPageFurniture(source, actual);

  assert.equal(report.summary.sourceCandidateCount, 2);
  assert.equal(report.summary.promotedCount, 2);
  assert.equal(report.summary.missedCount, 0);
  assert.equal(report.summary.falsePromotionCount, 0);
  assert.equal(report.metrics.promotionRate, 1);
  assert.equal(report.metrics.falsePromotionRate, 0);
  assert.equal(report.metrics.pageFurnitureResidueRate, 0);
  assert.deepEqual(report.candidates.map((candidate) => candidate.kind).sort(), ['decorative-rule', 'folio']);
});

test('auditParentPageFurniture reports page residue and false promoted content', () => {
  const source = snapshot([
    page('1', [lineItem('rule-p1', { y: 32 }), imageItem('hero-p1', { path: '\\\\nas\\project\\hero-a.pdf' })]),
    page('2', [lineItem('rule-p2', { y: 32 }), imageItem('hero-p2', { path: '\\\\nas\\project\\hero-b.pdf' })]),
    page('3', [lineItem('rule-p3', { y: 32 }), imageItem('hero-p3', { path: '\\\\nas\\project\\hero-c.pdf' })]),
  ]);
  const actual = snapshot([
    page('1', [lineItem('rule-p1-out', { y: 32 })]),
    page('2', [lineItem('rule-p2-out', { y: 32 })]),
    page('3', [lineItem('rule-p3-out', { y: 32 })]),
  ], {
    parentPages: [{
      name: '错误母版',
      items: [imageItem('wrong-parent-image', { path: '\\\\nas\\project\\hero-a.pdf' })],
    }],
  });

  const report = auditParentPageFurniture(source, actual);

  assert.equal(report.summary.sourceCandidateCount, 1);
  assert.equal(report.summary.promotedCount, 0);
  assert.equal(report.summary.missedCount, 1);
  assert.equal(report.summary.falsePromotionCount, 1);
  assert.equal(report.summary.actualPageFurnitureResidueCount, 3);
  assert.equal(report.metrics.promotionRate, 0);
  assert.equal(report.metrics.falsePromotionRate, 1);
  assert.equal(report.metrics.pageFurnitureResidueRate, 1);
  assert.equal(report.falsePromotions[0].kind, 'content-like');
});

test('auditParentPageFurniture does not classify title pages or pasteboard notes as furniture', () => {
  const source = snapshot([], {
    parentPages: [{
      name: '人工页面模板',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      items: [
        textItem('chapter-title', {
          text: '01中文篇章标题/ English Chapter Title',
          x: 360,
          y: 80,
          width: 360,
          height: 420,
          paragraphStyleName: '标题页标题（45点左对齐）',
        }),
        textItem('pasteboard-note', {
          text: '本页用于进行说明，页面划分四象限。',
          x: 820,
          y: 24,
          width: 120,
          height: 240,
          paragraphStyleName: '标准正文（18点左对齐）',
        }),
        textItem('unmarked-header-text', {
          text: 'SA Architects',
          x: 420,
          y: 24,
          width: 160,
          height: 24,
          paragraphStyleName: '封面项目标题',
        }),
        lineItem('real-rule', { y: 32 }),
      ],
    }],
  });
  const actual = snapshot([], {
    parentPages: [{ name: '规范母版', items: [lineItem('real-rule-out', { y: 32 })] }],
  });

  const report = auditParentPageFurniture(source, actual);

  assert.equal(report.summary.sourceCandidateCount, 1);
  assert.equal(report.candidates[0].kind, 'decorative-rule');
  assert.equal(report.summary.promotedCount, 1);
});

test('auditParentPageFurniture ignores unlabeled observed guides as promotion targets', () => {
  const source = snapshot([
    page('1', [], [
      { orientation: 'horizontal', position: 120, source: null },
      { orientation: 'vertical', position: 40, source: 'grid' },
    ]),
    page('2', [], [
      { orientation: 'horizontal', position: 120, source: null },
      { orientation: 'vertical', position: 40, source: 'grid' },
    ]),
  ]);
  const actual = snapshot([]);

  const report = auditParentPageFurniture(source, actual);

  assert.equal(report.summary.sourceCandidateCount, 1);
  assert.equal(report.candidates[0].kind, 'guide');
  assert.equal(report.candidates[0].sample.source, 'grid');
});

test('auditParentPageFurniture measures second pass parent page stability', () => {
  const source = snapshot([
    page('1', [lineItem('rule-p1', { y: 32 })]),
    page('2', [lineItem('rule-p2', { y: 32 })]),
    page('3', [lineItem('rule-p3', { y: 32 })]),
  ]);
  const actual = snapshot([], {
    parentPages: [{ name: '规范汇报母版', items: [lineItem('parent-rule', { y: 32 })] }],
  });
  const secondPass = snapshot([], {
    parentPages: [
      { name: '规范汇报母版', items: [lineItem('parent-rule', { y: 32 })] },
      { name: '重复母版', items: [lineItem('duplicated-rule', { y: 32 })] },
    ],
  });

  const report = auditParentPageFurniture(source, actual, { secondPassSnapshot: secondPass });

  assert.equal(report.stability.available, true);
  assert.equal(report.stability.stable, false);
  assert.equal(report.stability.parentPageItemDelta, 1);
  assert.equal(report.stability.duplicateParentFurnitureCount, 1);
});

test('audit-parent-page-furniture invalid-input 必须 fail', () => {
  const empty = auditParentPageFurniture(snapshot([]), snapshot([]));
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.some((issue) => issue.code === 'PARENT_PAGE_FURNITURE_INPUT_INVALID'), true);

  const missingBoundsItem = lineItem('rule-without-bounds');
  delete missingBoundsItem.bounds;
  const malformed = auditParentPageFurniture(
    snapshot([page('1', [missingBoundsItem])]),
    snapshot([page('1', [])]),
  );

  assert.equal(malformed.ok, false);
  assert.equal(malformed.errors.some((issue) => issue.code === 'PARENT_PAGE_FURNITURE_INPUT_INVALID'), true);

  const root = path.resolve('test/workspace/parent-page-furniture-invalid-input');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const sourcePath = path.join(root, 'source.json');
  const actualPath = path.join(root, 'actual.json');
  fs.writeFileSync(sourcePath, JSON.stringify(snapshot([])), 'utf8');
  fs.writeFileSync(actualPath, JSON.stringify(snapshot([])), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-parent-page-furniture.js'),
    '--source', sourcePath,
    '--actual', actualPath,
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0, result.stdout);
});

function snapshot(pages, overrides = {}) {
  return {
    metadata: { coordinateUnit: 'pt' },
    parentPages: overrides.parentPages || [],
    pages,
  };
}

function page(id, items, guides = []) {
  return {
    id,
    index: Number(id) - 1,
    bounds: { x: 0, y: 0, width: 800, height: 600 },
    guides,
    items,
    auditItems: items,
  };
}

function lineItem(id, overrides = {}) {
  const y = overrides.y == null ? 32 : overrides.y;
  return {
    id,
    type: 'GraphicLine',
    bounds: { x: 40, y, width: 720, height: 0 },
    objectStyleName: overrides.objectStyleName || '装饰线',
    visualStyle: { strokeColor: '#999999', strokeWeight: 1, fillColor: null },
    vectorGeometry: {
      kind: 'line',
      paths: [{
        closed: false,
        points: [
          point(40, y),
          point(760, y),
        ],
      }],
    },
    text: '',
    labels: overrides.semantic ? [{ kind: 'item', id, semantic: overrides.semantic }] : [],
  };
}

function textItem(id, overrides = {}) {
  return {
    id,
    type: 'TextFrame',
    bounds: {
      x: overrides.x == null ? 740 : overrides.x,
      y: overrides.y == null ? 540 : overrides.y,
      width: overrides.width == null ? 24 : overrides.width,
      height: overrides.height == null ? 18 : overrides.height,
    },
    paragraphStyleName: overrides.paragraphStyleName || (overrides.semantic === 'folio' ? '页码' : '页码'),
    objectStyleName: '[基本文本框架]',
    text: overrides.text || '01',
    labels: overrides.semantic ? [{ kind: 'item', id, semantic: overrides.semantic }] : [],
    visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
  };
}

function imageItem(id, overrides = {}) {
  return {
    id,
    type: 'Rectangle',
    bounds: {
      x: overrides.x == null ? 100 : overrides.x,
      y: overrides.y == null ? 100 : overrides.y,
      width: 420,
      height: 280,
    },
    objectStyleName: '主图框',
    visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    placedAsset: {
      path: overrides.path || '\\\\nas\\project\\hero.pdf',
      graphicType: 'PDF',
      placement: { pageNumber: 1, fit: 'manual' },
    },
    text: '',
    labels: [],
  };
}

function point(x, y) {
  return {
    anchor: { x, y },
    leftDirection: { x, y },
    rightDirection: { x, y },
    pointType: null,
  };
}
