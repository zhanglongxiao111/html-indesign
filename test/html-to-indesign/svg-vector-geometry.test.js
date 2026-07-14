const test = require('node:test');
const assert = require('node:assert/strict');
const { vectorFactsFromSvgItem } = require('../../src/adapters/html/normalizer/svg-vector-geometry');

const BOUNDS = { x: 0, y: 0, width: 100, height: 100 };

function svgItem(pathMarkup) {
  return {
    tagName: 'svg',
    attributes: { viewBox: '0 0 100 100' },
    sourceHtml: pathMarkup,
  };
}

test('path with unsupported arc command terminates and keeps supported segments', () => {
  // 回归：A 命令曾被分词器静默丢弃，残留奇数个数字令 parsePathPoints 死循环（CPU 100% 永不返回）。
  const facts = vectorFactsFromSvgItem(
    svgItem('<path d="M0,0 A10,10 0 0 1 10,10"></path>'),
    BOUNDS
  );
  assert.ok(facts, 'vector facts should be produced');
  assert.equal(facts.vectorGeometry.paths.length, 1);
  assert.equal(facts.vectorGeometry.paths[0].points.length, 1); // 仅 M 点，弧段跳过
});

test('unsupported command in the middle skips its params but keeps later segments', () => {
  const facts = vectorFactsFromSvgItem(
    svgItem('<path d="M0,0 L50,50 A10,10 0 0 1 10,10 L90,90 C1,2 3,4 5,6 Z"></path>'),
    BOUNDS
  );
  const points = facts.vectorGeometry.paths[0].points;
  // M0,0 + L50,50 + L90,90 + C 终点 5,6 = 4 个锚点；弧段参数被整体跳过
  assert.equal(points.length, 4);
  assert.deepEqual(points[0].anchor, { x: 0, y: 0 });
  assert.deepEqual(points[1].anchor, { x: 50, y: 50 });
  assert.deepEqual(points[2].anchor, { x: 90, y: 90 });
  assert.equal(facts.vectorGeometry.paths[0].closed, true);
});

test('quadratic/H/V commands do not stall the parser', () => {
  const facts = vectorFactsFromSvgItem(
    svgItem('<path d="M0,0 Q5,5 10,10 H50 V50 L20,20"></path>'),
    BOUNDS
  );
  const points = facts.vectorGeometry.paths[0].points;
  // Q/H/V 参数被跳过，保留 M0,0 与 L20,20
  assert.equal(points.length, 2);
  assert.deepEqual(points[1].anchor, { x: 20, y: 20 });
});

test('supported-only path is unaffected by the guard', () => {
  const facts = vectorFactsFromSvgItem(
    svgItem('<path d="M0,0 L10,0 L10,10 C12,14 16,18 20,20 Z"></path>'),
    BOUNDS
  );
  const points = facts.vectorGeometry.paths[0].points;
  assert.equal(points.length, 4);
  assert.equal(facts.vectorGeometry.paths[0].closed, true);
});
