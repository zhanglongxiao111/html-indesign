const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  auditEffectiveDiff,
  classifyEffectiveDiffIssue,
} = require('../../src/adapters/indesign/audit/effective-diff');

const {
  parseArgs,
  run,
} = require('../../scripts/audit-effective-diff');

test('auditEffectiveDiff fails hard for text or asset content loss', () => {
  const report = auditEffectiveDiff(
    snapshot([
      textItem('title', { text: '原始标题', objectStyleName: '原始文本框' }),
      vectorItem('rule', { strokeColor: '#c8102e' }),
    ]),
    snapshot([
      textItem('title', { text: '生成标题', objectStyleName: '规范文本框' }),
      vectorItem('rule', { strokeColor: '#000000' }),
    ]),
    { p1Budget: 10 },
  );

  assert.equal(report.ok, false);
  assert.equal(report.p0.ok, false);
  assert.equal(report.p0.count, 1);
  assert.equal(report.p1.count, 1);
  assert.equal(report.p2.count, 1);
  assert.equal(report.edi, 111);
  assert.equal(report.p0.issues[0].code, 'REVERSE_SNAPSHOT_TEXT_CHANGED');
});

test('auditEffectiveDiff gates P1 against a baseline budget while P2 remains advisory', () => {
  const expected = snapshot([
    vectorItem('shape-a', { strokeColor: '#c8102e' }),
    vectorItem('shape-b', { strokeColor: '#c8102e' }),
    textItem('caption', { objectStyleName: '人工样式' }),
  ]);
  const actual = snapshot([
    vectorItem('shape-a', { strokeColor: '#000000' }),
    vectorItem('shape-b', { strokeColor: '#111111' }),
    textItem('caption', { objectStyleName: '规范样式' }),
  ]);

  const failed = auditEffectiveDiff(expected, actual, { p1Budget: 1 });
  const passed = auditEffectiveDiff(expected, actual, { p1Budget: 2 });

  assert.equal(failed.ok, false);
  assert.equal(failed.p0.count, 0);
  assert.equal(failed.p1.count, 2);
  assert.equal(failed.p1.budget, 1);
  assert.equal(failed.p1.ok, false);
  assert.equal(failed.p2.count, 1);

  assert.equal(passed.ok, true);
  assert.equal(passed.p1.ok, true);
  assert.equal(passed.p2.ok, true);
});

test('auditEffectiveDiff can require provided second pass stability audits to be clean', () => {
  const clean = auditEffectiveDiff(snapshot([]), snapshot([]), {
    requireStabilityAudits: true,
    stabilityAudits: [{ ok: true, comparison: { errors: [], warnings: [] } }],
  });
  const dirty = auditEffectiveDiff(snapshot([]), snapshot([]), {
    requireStabilityAudits: true,
    stabilityAudits: [{ ok: false, comparison: { errors: [{ code: 'DRIFT' }], warnings: [] } }],
  });

  assert.equal(clean.ok, true);
  assert.equal(clean.stability.ok, true);
  assert.equal(clean.stability.available, true);

  assert.equal(dirty.ok, false);
  assert.equal(dirty.stability.ok, false);
  assert.equal(dirty.stability.auditCount, 1);
});

test('classifyEffectiveDiffIssue keeps normalization noise out of hard gates', () => {
  assert.equal(classifyEffectiveDiffIssue({ code: 'REVERSE_SNAPSHOT_TEXT_CHANGED' }).level, 'p0');
  assert.equal(classifyEffectiveDiffIssue({ code: 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED' }).level, 'p1');
  assert.equal(classifyEffectiveDiffIssue({ code: 'REVERSE_SNAPSHOT_ITEM_FIELD_CHANGED', field: 'objectStyleName' }).level, 'p2');
  assert.equal(classifyEffectiveDiffIssue({ code: 'REVERSE_SNAPSHOT_PAGE_GUIDES_CHANGED' }).level, 'p2');
});

test('auditEffectiveDiff treats line indentation and trailing blank text differences as advisory normalization noise', () => {
  const report = auditEffectiveDiff(
    snapshot([
      textItem('indented-copy', { text: '团队最终采用暖色清水\n      混凝土为立面主材料，\n      ' }),
      textItem('blank-frame', { text: '  ' }),
    ]),
    snapshot([
      textItem('indented-copy', { text: '团队最终采用暖色清水\n混凝土为立面主材料，\n' }),
      textItem('blank-frame', { text: '' }),
    ]),
  );

  assert.equal(report.ok, true);
  assert.equal(report.p0.count, 0);
  assert.equal(report.p2.count, 1);
});

test('audit-effective-diff CLI writes a gate report with baseline and stability inputs', () => {
  const root = path.resolve('test/workspace/effective-diff-cli');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const expectedPath = path.join(root, 'expected.json');
  const actualPath = path.join(root, 'actual.json');
  const baselinePath = path.join(root, 'baseline.json');
  const stabilityPath = path.join(root, 'stability.json');
  const outPath = path.join(root, 'effective-diff.json');
  fs.writeFileSync(expectedPath, JSON.stringify(snapshot([
    vectorItem('shape-a', { strokeColor: '#c8102e' }),
  ])), 'utf8');
  fs.writeFileSync(actualPath, JSON.stringify(snapshot([
    vectorItem('shape-a', { strokeColor: '#000000' }),
  ])), 'utf8');
  fs.writeFileSync(baselinePath, JSON.stringify({ p1: { count: 1 } }), 'utf8');
  fs.writeFileSync(stabilityPath, JSON.stringify({ ok: true, comparison: { errors: [], warnings: [] } }), 'utf8');

  const options = parseArgs([
    '--expected', expectedPath,
    '--actual', actualPath,
    '--baseline', baselinePath,
    '--stability-audit', stabilityPath,
    '--require-stability-audits',
    '--out', outPath,
  ]);
  const summary = JSON.parse(run(options));
  const report = JSON.parse(fs.readFileSync(outPath, 'utf8'));

  assert.equal(summary.ok, true);
  assert.equal(report.ok, true);
  assert.equal(report.p1.budget, 1);
  assert.equal(report.p1.count, 1);
  assert.equal(report.stability.ok, true);
});

test('audit-effective-diff invalid-input 必须 fail', () => {
  const report = auditEffectiveDiff({ pages: [] }, { pages: [] });
  assert.equal(report.ok, false);
  assert.equal(report.p0.issues.some((issue) => issue.code === 'REVERSE_SNAPSHOT_INPUT_INVALID'), true);

  const root = path.resolve('test/workspace/effective-diff-invalid-input');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const expectedPath = path.join(root, 'expected.json');
  const actualPath = path.join(root, 'actual.json');
  fs.writeFileSync(expectedPath, JSON.stringify({ pages: [] }), 'utf8');
  fs.writeFileSync(actualPath, JSON.stringify({ pages: [] }), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-effective-diff.js'),
    '--expected', expectedPath,
    '--actual', actualPath,
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0, result.stdout);
});

function snapshot(items) {
  return {
    pages: [{
      id: '1',
      index: 0,
      bounds: { x: 0, y: 0, width: 1000, height: 600 },
      guides: [],
      items,
      auditItems: items,
    }],
  };
}

function textItem(id, overrides = {}) {
  return {
    id,
    type: 'TextFrame',
    bounds: overrides.bounds || { x: 100, y: 120, width: 300, height: 40 },
    objectStyleName: overrides.objectStyleName || '正文框',
    paragraphStyleName: overrides.paragraphStyleName || '正文',
    text: Object.prototype.hasOwnProperty.call(overrides, 'text') ? overrides.text : '正文',
    visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    labels: [{ kind: 'item', id }],
  };
}

function vectorItem(id, overrides = {}) {
  return {
    id,
    type: 'GraphicLine',
    bounds: overrides.bounds || { x: 100, y: 180, width: 300, height: 0 },
    objectStyleName: overrides.objectStyleName || '线条',
    paragraphStyleName: null,
    text: '',
    visualStyle: {
      fillColor: null,
      strokeColor: overrides.strokeColor || '#c8102e',
      strokeWeight: 1,
      strokeStyle: '实底',
    },
    vectorGeometry: {
      kind: 'line',
      paths: [{
        closed: false,
        points: [
          point(100, 180),
          point(400, 180),
        ],
      }],
    },
    labels: [{ kind: 'item', id }],
  };
}

function point(x, y) {
  return {
    anchor: { x, y },
    leftDirection: { x, y },
    rightDirection: { x, y },
    pointType: 'PLAIN',
  };
}
