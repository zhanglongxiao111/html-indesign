const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  parseArgs,
  run,
} = require('../../scripts/audit-trusted-source-preservation');

test('audit-trusted-source-preservation CLI writes a trusted source mutation report', () => {
  const root = path.resolve('test/workspace/trusted-source-preservation-cli');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const before = writeJson(root, 'before.json', trustedDocumentModel('page-1'));
  const afterModel = trustedDocumentModel('page-1');
  afterModel.pages[0].items[0].structure.parentId = 'generated-container';
  const after = writeJson(root, 'after.json', afterModel);
  const out = path.join(root, 'trusted-source-report.json');

  const summary = JSON.parse(run(parseArgs([
    '--expected', before,
    '--actual', after,
    '--out', out,
  ])));
  const report = JSON.parse(fs.readFileSync(out, 'utf8'));

  assert.equal(summary.ok, false);
  assert.equal(summary.mutations, 1);
  assert.equal(report.kind, 'TrustedSourcePreservationAudit');
  assert.equal(report.failures[0].code, 'TRUSTED_SOURCE_STRUCTURE_MUTATED');
});

test('audit-trusted-source-preservation invalid-input 必须 fail', () => {
  const root = path.resolve('test/workspace/trusted-source-preservation-invalid-input');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const before = writeJson(root, 'before.json', { kind: 'ObservedModel', pages: [] });
  const after = writeJson(root, 'after.json', trustedDocumentModel('page-1'));

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-trusted-source-preservation.js'),
    '--expected', before,
    '--actual', after,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TRUSTED_SOURCE_INVALID_INPUT/);
});

function trustedDocumentModel(pageId) {
  return {
    kind: 'DocumentModel',
    id: 'trusted-deck',
    pages: [
      {
        id: pageId,
        labelStatus: 'accepted',
        sourceNode: { tagName: 'section', id: pageId, classList: ['page'], attributes: {} },
        items: [
          {
            id: 'copy-1',
            role: 'text',
            semantic: 'body-copy',
            labelStatus: 'accepted',
            tagName: 'p',
            sourceNode: {
              tagName: 'p',
              id: 'copy-1',
              classList: ['body-copy'],
              attributes: { 'data-id-paragraph-style': '正文' },
            },
            structure: { parentId: pageId, order: 1 },
            content: { text: '正文' },
          },
        ],
      },
    ],
  };
}

function writeJson(root, file, value) {
  const out = path.join(root, file);
  fs.writeFileSync(out, JSON.stringify(value, null, 2), 'utf8');
  return out;
}
