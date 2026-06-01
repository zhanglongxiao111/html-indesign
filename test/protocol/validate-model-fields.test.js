const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateModelFields,
  scanModelPaths,
  fieldRegistry,
} = require('../../src/protocol');

test('scanModelPaths deterministically scans known model surfaces', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    assets: [{ path: 'drawings/site.pdf' }],
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        asset: { pageNumber: 2 },
        madeUpField: 1,
      }],
    }],
  };

  assert.deepEqual(scanModelPaths(model), [
    'document.id',
    'assets[].path',
    'pages[].id',
    'items[].asset.pageNumber',
    'pages[].items[].madeUpField',
  ]);
});

test('validateModelFields accepts registered model paths and warns for unknown paths by default', () => {
  const result = validateModelFields(fieldRegistry, [
    'assets[].path',
    'pages[].items[].madeUpField',
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['assets[].path']);
  assert.deepEqual(result.unknown, ['pages[].items[].madeUpField']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_NOT_REGISTERED'
      && warning.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});

test('scanModelPaths maps legal document and parent page label metadata paths', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'document',
      id: 'doc',
      profile: 'architecture-report',
    }],
    parentPages: [{
      id: 'parent-a',
      labels: [{
        protocol: 'html-indesign',
        version: 1,
        kind: 'parentPage',
        id: 'parent-a',
        provides: ['grid'],
      }],
    }],
    pages: [{ id: 'p1' }],
  });

  assert.equal(scannedPaths.includes('document.profile'), true);
  assert.equal(scannedPaths.includes('parentPages[].provides'), true);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, true);
  assert.deepEqual(strict.unknown, []);
});

test('validateModelFields rejects unknown model paths in strict mode', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    assets: [{ path: 'drawings/site.pdf' }],
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        madeUpField: 1,
      }],
    }],
  };

  const result = validateModelFields(fieldRegistry, scanModelPaths(model), { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, [
    'document.id',
    'assets[].path',
    'pages[].id',
  ]);
  assert.deepEqual(result.unknown, ['pages[].items[].madeUpField']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});

test('validateModelFields can scan a DocumentModel object input explicitly', () => {
  const result = validateModelFields(fieldRegistry, {
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        asset: { placement: { fakePlacement: true } },
      }],
    }],
  }, { strict: true, domains: ['asset.placement'] });

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].asset.placement.fakePlacement'
    )),
    true,
  );
});

test('validateModelFields rejects non-path-array and non-DocumentModel inputs', () => {
  for (const input of [
    'labels[].x',
    42,
    { kind: 'NotDocumentModel' },
    null,
  ]) {
    assert.throws(
      () => validateModelFields(fieldRegistry, input),
      /MODEL_FIELD_INPUT_INVALID/,
    );
  }
});

test('validateModelFields rejects nested ghosts on registered root surfaces in strict mode', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    parentPages: [{ id: 'parent-a', ghost: true }],
    layers: [{ token: 'text', ghost: true }],
    styles: [{ name: 'Title', ghost: true }],
    pages: [{
      id: 'p1',
      effectiveLabel: { semantic: 'agenda-page', ghost: true },
      observedLabel: { rejectionReasons: ['unknown-layout'], ghost: true },
      items: [],
    }],
  };

  const scannedPaths = scanModelPaths(model);
  for (const path of [
    'parentPages[].ghost',
    'layers[].ghost',
    'styles[].ghost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
  ]) {
    assert.equal(scannedPaths.includes(path), true, `${path} should be scanned`);
  }

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.unknown, [
    'parentPages[].ghost',
    'layers[].ghost',
    'styles[].ghost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
  ]);
  for (const path of strict.unknown) {
    assert.equal(
      strict.errors.some((error) => (
        error.code === 'MODEL_FIELD_NOT_REGISTERED'
        && error.path === path
      )),
      true,
      `${path} should be a strict error`,
    );
  }
});

test('validateModelFields rejects unknown parent page item fields in strict mode', () => {
  const scannedPaths = scanModelPaths({
    parentPages: [{
      id: 'parent-a',
      items: [{
        id: 'parent-rule',
        role: 'line',
        layerName: 'Decor',
        vectorGeometry: { kind: 'line', paths: [] },
        visualStyle: { strokeColor: '#c8102e', strokeWeight: 2 },
        ghost: true,
      }],
    }],
    pages: [{ id: 'p1' }],
  });

  assert.deepEqual(scannedPaths, [
    'parentPages',
    'parentPages[].id',
    'parentPages[].items',
    'items[].role',
    'items[].layerName',
    'items[].vectorGeometry.kind',
    'items[].vectorGeometry.paths',
    'items[].visualStyle.strokeColor',
    'items[].visualStyle.strokeWeight',
    'parentPages[].items[].ghost',
    'pages[].id',
  ]);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.equal(strict.accepted.includes('parentPages[].items'), true);
  assert.equal(strict.accepted.includes('items[].role'), true);
  assert.equal(strict.accepted.includes('items[].layerName'), true);
  assert.equal(strict.accepted.includes('items[].vectorGeometry.kind'), true);
  assert.equal(strict.accepted.includes('items[].visualStyle.strokeColor'), true);
  assert.deepEqual(strict.unknown, ['parentPages[].items[].ghost']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'parentPages[].items[].ghost'
    )),
    true,
  );
});

test('validateModelFields scans table cell surfaces and rejects unknown cell fields in strict mode', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [{
        id: 'area-table',
        table: {
          rowCount: 1,
          columnCount: 1,
          columnWidths: [260],
          rowHeights: [32],
          rows: [{
            index: 0,
            cells: [{
              index: 0,
              text: 'Space',
              header: true,
              rowSpan: 1,
              colSpan: 1,
              paragraphStyle: 'table-body',
              cellStyle: 'table-cell',
              padding: { top: 8, right: 10, bottom: 8, left: 10 },
              borders: { left: { color: '#cfd6d2', borderWeight: 1 } },
              ghost: true,
            }],
          }],
        },
      }],
    }],
  });

  for (const path of [
    'items[].table.rowCount',
    'items[].table.columnCount',
    'items[].table.columnWidths',
    'items[].table.rowHeights',
    'items[].table.rows[].index',
    'items[].table.rows[].cells[].index',
    'items[].table.rows[].cells[].text',
    'items[].table.rows[].cells[].header',
    'items[].table.rows[].cells[].rowSpan',
    'items[].table.rows[].cells[].colSpan',
    'items[].table.rows[].cells[].paragraphStyle',
    'items[].table.rows[].cells[].cellStyle',
    'items[].table.rows[].cells[].padding',
    'items[].table.rows[].cells[].borders',
    'items[].table.rows[].cells[].ghost',
  ]) {
    assert.equal(scannedPaths.includes(path), true, `${path} should be scanned`);
  }

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.equal(strict.unknown.includes('items[].table.rows[].cells[].ghost'), true);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].table.rows[].cells[].ghost'
    )),
    true,
  );
  assert.equal(strict.unknown.includes('items[].table.rows[].cells[].text'), false);
  assert.equal(strict.unknown.includes('items[].table.rows[].cells[].borders'), false);
});

test('validateModelFields rejects unknown style collection fields in strict mode', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    styles: {
      paragraphStyles: {
        title: {
          name: 'Title',
          css: 'font-size:32pt',
          ghost: true,
        },
      },
      ghostCollection: {},
    },
  });

  assert.equal(scannedPaths.includes('styles.paragraphStyles[].ghost'), true);
  assert.equal(scannedPaths.includes('styles.ghostCollection'), true);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.unknown, [
    'styles.paragraphStyles[].ghost',
    'styles.ghostCollection',
  ]);
});

test('validateModelFields reports model root unknown fields in warning-only and strict modes', () => {
  const model = {
    kind: 'DocumentModel',
    madeUpRoot: 1,
    pages: [{ id: 'p1', items: [] }],
  };
  const scannedPaths = scanModelPaths(model);

  assert.deepEqual(scannedPaths, [
    'madeUpRoot',
    'pages[].id',
  ]);

  const nonStrict = validateModelFields(fieldRegistry, scannedPaths);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, ['pages[].id']);
  assert.deepEqual(nonStrict.unknown, ['madeUpRoot']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_NOT_REGISTERED'
      && warning.path === 'madeUpRoot'
    )),
    true,
  );

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, ['pages[].id']);
  assert.deepEqual(strict.unknown, ['madeUpRoot']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'madeUpRoot'
    )),
    true,
  );
});

test('validateModelFields rejects retired paths only in strict mode', () => {
  const nonStrict = validateModelFields(fieldRegistry, ['retired.htmlAttrs.dataIdPage']);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, []);
  assert.deepEqual(nonStrict.retired.map((item) => item.path), ['retired.htmlAttrs.dataIdPage']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_RETIRED'
      && warning.path === 'retired.htmlAttrs.dataIdPage'
    )),
    true,
  );

  const strict = validateModelFields(fieldRegistry, ['retired.htmlAttrs.dataIdPage'], { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, []);
  assert.deepEqual(strict.retired.map((item) => item.path), ['retired.htmlAttrs.dataIdPage']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'retired.htmlAttrs.dataIdPage'
    )),
    true,
  );
});

test('scanModelPaths scans effectiveLabel nested registered and unknown fields', () => {
  const scannedPaths = scanModelPaths({
    pages: [{
      items: [{
        effectiveLabel: {
          semantic: 'figure',
          sourceNode: {},
          madeUp: 1,
        },
      }],
    }],
  });

  assert.deepEqual(scannedPaths, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.semantic',
    'effectiveLabel.sourceNode',
    'items[].effectiveLabel.madeUp',
  ]);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.semantic',
    'effectiveLabel.sourceNode',
  ]);
  assert.deepEqual(strict.unknown, ['items[].effectiveLabel.madeUp']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].effectiveLabel.madeUp'
    )),
    true,
  );
});

test('scanModelPaths maps effectiveLabel style refs while preserving nested unknowns', () => {
  const scannedPaths = scanModelPaths({
    pages: [{
      items: [{
        effectiveLabel: {
          styleRefs: {
            paragraphStyle: 'body-copy',
            objectStyleToken: 'card-frame',
            ghost: true,
          },
        },
      }],
    }],
  });

  assert.deepEqual(scannedPaths, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.styleRefs',
    'items[].styleRefs.paragraphStyle',
    'items[].styleRefs.objectStyle',
    'items[].effectiveLabel.styleRefs.ghost',
  ]);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.styleRefs',
    'items[].styleRefs.paragraphStyle',
    'items[].styleRefs.objectStyle',
  ]);
  assert.deepEqual(strict.unknown, ['items[].effectiveLabel.styleRefs.ghost']);
});

test('validateModelFields rejects invalid model field domain names', () => {
  assert.throws(
    () => validateModelFields(fieldRegistry, ['pages[].id'], { strict: true, domains: ['asset.missing'] }),
    /MODEL_FIELD_DOMAIN_UNKNOWN:asset\.missing/,
  );
});

test('asset placement domain strict rejects placement unknowns without escalating unrelated unknowns', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      items: [{
        id: 'asset-1',
        madeUpField: true,
        asset: {
          placement: {
            pageNumber: 1,
            crop: 'trim',
            transparentBackground: true,
            visibleLayers: ['site'],
            hiddenLayers: ['notes'],
            layers: ['site', 'notes'],
            fakePlacement: true,
          },
        },
      }],
    }],
  });

  const result = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['asset.placement'] },
  );

  assert.equal(result.valid, false);
  for (const path of [
    'items[].asset.placement.pageNumber',
    'items[].asset.placement.crop',
    'items[].asset.placement.transparentBackground',
    'items[].asset.placement.visibleLayers',
    'items[].asset.placement.hiddenLayers',
    'items[].asset.placement.layers',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].asset.placement.fakePlacement'
    )),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );
  assert.equal(
    result.warnings.some((warning) => warning.path === 'pages[].items[].madeUpField'),
    true,
  );
});

test('source metadata domain strict rejects unknown source metadata paths and accepts registered source facts', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    sourcePackage: { config: 'deck.config.json' },
    pages: [{
      id: 'p1',
      sourceNode: { tagName: 'section' },
      items: [{
        id: 'item-1',
        madeUpField: true,
        sourceFile: 'pages/01.html',
        sourceNode: { tagName: 'p' },
        sourceAncestorNodes: [{ tagName: 'section' }],
        labels: [{
          kind: 'item',
          sourceText: 'Caption',
          sourceHtml: '<p>Caption</p>',
          sourceRuns: [{ text: 'Caption' }],
          structure: { parentId: 'p1' },
          sourceMystery: true,
        }],
      }],
    }],
  });

  const result = validateModelFields(
    fieldRegistry,
    [
      ...scannedPaths,
      'items[].sourceNode.sourceMystery',
    ],
    { strict: true, domains: ['source.metadata'] },
  );

  assert.equal(result.valid, false);
  for (const path of [
    'document.sourcePackage',
    'pages[].sourceNode',
    'items[].sourceFile',
    'items[].sourceNode',
    'items[].sourceAncestorNodes',
    'labels[].sourceText',
    'labels[].sourceHtml',
    'labels[].sourceRuns',
    'labels[].structure',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].sourceNode.sourceMystery'
    )),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'labels[].sourceMystery'),
    false,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );
});

test('source metadata domain strict does not accept label protocol or derived label carrier fields', () => {
  const result = validateModelFields(
    fieldRegistry,
    [
      'items[].sourceNode',
      'labels[].protocol',
      'labels[].version',
      'labels[].kind',
      'labels[].id',
      'labels[].source',
      'labels[].htmlTag',
      'labels[].className',
      'items[].effectiveLabel',
    ],
    { strict: true, domains: ['source.metadata'] },
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['items[].sourceNode']);
  for (const path of [
    'labels[].protocol',
    'labels[].version',
    'labels[].kind',
    'labels[].id',
    'labels[].source',
    'labels[].htmlTag',
    'labels[].className',
    'items[].effectiveLabel',
  ]) {
    assert.equal(result.accepted.includes(path), false, `${path} should not be source.metadata accepted`);
  }

  const unknownNested = validateModelFields(
    fieldRegistry,
    ['items[].sourceNode.unregistered'],
    { strict: true, domains: ['source.metadata'] },
  );
  assert.equal(unknownNested.valid, false);
  assert.equal(
    unknownNested.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].sourceNode.unregistered'
    )),
    true,
  );
});

test('styleRefs domain strict rejects unknown style refs and accepts style token/name pairs', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      items: [{
        id: 'styled',
        madeUpField: true,
        styleRefs: {
          paragraphStyle: 'body',
          characterStyle: 'accent',
          objectStyle: 'frame',
          frameStyle: 'image-frame',
          tableStyle: 'metrics-table',
          cellStyle: 'metrics-cell',
          layer: 'text',
          fakeStyleToken: 'ghost',
        },
        labels: [{
          kind: 'item',
          styleRefs: {
            paragraphStyleToken: 'body-token',
            characterStyleToken: 'accent-token',
            objectStyleToken: 'frame-token',
            frameStyleToken: 'image-frame-token',
            tableStyleToken: 'metrics-table-token',
            cellStyleToken: 'metrics-cell-token',
            layerToken: 'text-token',
          },
        }],
      }],
    }],
  });

  const result = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['styleRefs'] },
  );

  assert.equal(result.valid, false);
  for (const path of [
    'items[].styleRefs.paragraphStyle',
    'items[].styleRefs.characterStyle',
    'items[].styleRefs.objectStyle',
    'items[].styleRefs.frameStyle',
    'items[].styleRefs.tableStyle',
    'items[].styleRefs.cellStyle',
    'items[].styleRefs.layer',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].styleRefs.fakeStyleToken'
    )),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );
});

test('labels domain strict rejects unknown label model paths', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    madeUpRoot: true,
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'document',
      id: 'doc',
      profile: 'architecture-report',
      foreignLabelField: true,
    }],
    pages: [{ id: 'p1' }],
  });

  const result = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['labels'] },
  );

  assert.equal(result.valid, false);
  assert.equal(result.accepted.includes('labels[].protocol'), true);
  assert.equal(result.accepted.includes('labels[].version'), true);
  assert.equal(result.accepted.includes('labels[].kind'), true);
  assert.equal(result.accepted.includes('labels[].id'), true);
  assert.equal(result.accepted.includes('document.profile'), true);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'labels[].foreignLabelField'
    )),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'madeUpRoot'),
    false,
  );
});

test('visualStyle/vectorGeometry domain strict rejects unsupported visual fields and accepts implemented fields', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      items: [{
        id: 'shape-1',
        madeUpField: true,
        visualStyle: {
          fillColor: '#ffffff',
          fillOpacity: 0.5,
          strokeColor: '#111111',
          strokeWeight: 1,
          opacity: 0.9,
          strokeOpacity: 0.75,
          strokeStyle: 'solid',
          strokeLineCap: 'round',
          strokeLineJoin: 'miter',
          strokeMiterLimit: 4,
          cornerRadius: 8,
          strokeAlignment: 'center',
          lineStartMarker: 'none',
          lineEndMarker: 'arrow',
          blendMode: 'multiply',
          effects: { shadow: true },
          rawIndesignBlendMode: 'Multiply',
        },
        vectorGeometry: {
          kind: 'path',
          paths: [],
        },
      }],
    }],
  });

  const result = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['visualStyle/vectorGeometry'] },
  );

  assert.equal(result.valid, false);
  for (const path of [
    'items[].visualStyle.fillColor',
    'items[].visualStyle.fillOpacity',
    'items[].visualStyle.strokeColor',
    'items[].visualStyle.strokeWeight',
    'items[].visualStyle.opacity',
    'items[].visualStyle.strokeOpacity',
    'items[].visualStyle.strokeStyle',
    'items[].visualStyle.strokeLineCap',
    'items[].visualStyle.strokeLineJoin',
    'items[].visualStyle.strokeMiterLimit',
    'items[].visualStyle.cornerRadius',
    'items[].vectorGeometry.kind',
    'items[].vectorGeometry.paths',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  for (const path of [
    'items[].visualStyle.strokeAlignment',
    'items[].visualStyle.lineStartMarker',
    'items[].visualStyle.lineEndMarker',
    'items[].visualStyle.blendMode',
    'items[].visualStyle.effects',
    'items[].visualStyle.rawIndesignBlendMode',
  ]) {
    assert.equal(result.accepted.includes(path), false, `${path} should not be accepted`);
    assert.equal(
      result.errors.some((error) => (
        error.code === 'MODEL_FIELD_NOT_REGISTERED'
        && error.path === path
      )),
      true,
      `${path} should be a strict visualStyle/vectorGeometry error`,
    );
  }
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );

  const extensionPath = 'items[].extensions.indesign.rawIndesignBlendMode';
  const extension = validateModelFields(
    fieldRegistry,
    [extensionPath],
    { strict: true, domains: ['visualStyle/vectorGeometry'] },
  );
  assert.equal(extension.valid, true);
  assert.equal(extension.errors.length, 0);
  assert.deepEqual(extension.unknown, [extensionPath]);

  const formatExtension = validateModelFields(
    fieldRegistry,
    ['items[].effects'],
    { strict: true, domains: ['visualStyle/vectorGeometry'] },
  );
  assert.equal(formatExtension.valid, true);
  assert.deepEqual(formatExtension.accepted, []);
});

test('table/text domain strict rejects unknown text and table fields while accepting current static spec fields', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      items: [{
        id: 'table-1',
        madeUpField: true,
        content: {
          text: 'Area',
          sourceHtml: '<strong>Area</strong>',
          fakeTextField: true,
          runs: [{
            text: 'Area',
            tagName: 'strong',
            classList: ['metric'],
            attributes: { 'data-id-character-style': 'emphasis' },
            characterStyle: 'emphasis',
          }],
        },
        table: {
          tableStyle: 'metrics-table',
          rowCount: 1,
          columnCount: 1,
          columnWidths: [160],
          rowHeights: [32],
          fakeTableField: true,
          rows: [{
            index: 0,
            cells: [{
              index: 0,
              text: 'Area',
              header: true,
              rowSpan: 1,
              colSpan: 1,
              paragraphStyle: 'table-body',
              cellStyle: 'table-cell',
              fillColor: '#ffffff',
              textColor: '#111111',
              pointSize: 10,
              leading: 12,
              textAlign: 'center',
              padding: { top: 4 },
              borders: { left: { color: '#111111' } },
              runs: [{
                text: 'Area',
                tagName: 'span',
                classList: ['metric'],
                attributes: {},
                characterStyle: 'emphasis',
              }],
            }],
          }],
        },
      }],
    }],
  });

  const result = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['table/text'] },
  );

  assert.equal(result.valid, false);
  for (const path of [
    'items[].content.text',
    'items[].content.sourceHtml',
    'items[].content.runs',
    'items[].content.runs[].text',
    'items[].content.runs[].tagName',
    'items[].content.runs[].classList',
    'items[].content.runs[].attributes',
    'items[].content.runs[].characterStyle',
    'items[].table.tableStyle',
    'items[].table.rowCount',
    'items[].table.columnCount',
    'items[].table.columnWidths',
    'items[].table.rowHeights',
    'items[].table.rows',
    'items[].table.rows[].index',
    'items[].table.rows[].cells',
    'items[].table.rows[].cells[].index',
    'items[].table.rows[].cells[].text',
    'items[].table.rows[].cells[].header',
    'items[].table.rows[].cells[].rowSpan',
    'items[].table.rows[].cells[].colSpan',
    'items[].table.rows[].cells[].paragraphStyle',
    'items[].table.rows[].cells[].cellStyle',
    'items[].table.rows[].cells[].fillColor',
    'items[].table.rows[].cells[].textColor',
    'items[].table.rows[].cells[].pointSize',
    'items[].table.rows[].cells[].leading',
    'items[].table.rows[].cells[].textAlign',
    'items[].table.rows[].cells[].padding',
    'items[].table.rows[].cells[].borders',
    'items[].table.rows[].cells[].runs',
    'items[].table.rows[].cells[].runs[].text',
    'items[].table.rows[].cells[].runs[].tagName',
    'items[].table.rows[].cells[].runs[].classList',
    'items[].table.rows[].cells[].runs[].attributes',
    'items[].table.rows[].cells[].runs[].characterStyle',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  for (const path of [
    'items[].content.fakeTextField',
    'items[].table.fakeTableField',
  ]) {
    assert.equal(
      result.errors.some((error) => (
        error.code === 'MODEL_FIELD_NOT_REGISTERED'
        && error.path === path
      )),
      true,
      `${path} should be a strict domain error`,
    );
  }
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );
});
