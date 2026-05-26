const test = require('node:test');
const assert = require('node:assert/strict');
const { loadStandardSemanticPreset } = require('../../src/semantic-preset');
const { collectSemanticCandidates } = require('../../src/indesign-reverse/semantic-candidates');

test('collectSemanticCandidates reports unknown object and layer tokens', () => {
  const preset = loadStandardSemanticPreset('architecture-report').preset;
  const report = collectSemanticCandidates({
    kind: 'DocumentModel',
    pages: [{
      items: [
        { id: 'known-card', role: 'shape', semantic: 'metric-card', layer: 'content' },
        { id: 'custom-card', role: 'shape', semantic: 'custom-panel', layer: 'custom-layer' },
      ],
    }],
  }, preset);

  assert.deepEqual(report.candidates, [
    {
      kind: 'layers',
      token: 'custom-layer',
      suggestedName: 'custom-layer',
      source: 'reverse-export',
      count: 1,
    },
    {
      kind: 'objectStyles',
      token: 'custom-panel',
      suggestedName: 'custom-panel',
      source: 'reverse-export',
      count: 1,
    },
  ]);
});

test('collectSemanticCandidates counts repeated unknown tokens', () => {
  const preset = loadStandardSemanticPreset('architecture-report').preset;
  const report = collectSemanticCandidates({
    kind: 'DocumentModel',
    pages: [{
      items: [
        { id: 'a', role: 'graphic', semantic: 'drawing-pdf' },
        { id: 'b', role: 'graphic', semantic: 'drawing-pdf' },
      ],
    }],
  }, preset);

  assert.deepEqual(report.candidates, [
    {
      kind: 'objectStyles',
      token: 'drawing-pdf',
      suggestedName: 'drawing-pdf',
      source: 'reverse-export',
      count: 2,
    },
  ]);
});

test('collectSemanticCandidates treats preset display names as known InDesign terms', () => {
  const preset = loadStandardSemanticPreset('architecture-report').preset;
  const report = collectSemanticCandidates({
    kind: 'DocumentModel',
    pages: [{
      items: [
        { id: 'text', role: 'text', semantic: '正文', layerName: '文字' },
        { id: 'shape', role: 'shape', semantic: '指标卡片', layerName: '内容' },
      ],
    }],
  }, preset);

  assert.deepEqual(report.candidates, []);
});
