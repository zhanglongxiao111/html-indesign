const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateModelFields,
  scanModelPaths,
  fieldRegistry,
} = require('../../src/protocol');
const { validateSemanticModel } = require('../../src/semantic-model/validator');

test('scanModelPaths deterministically scans known model surfaces', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    assets: [{
      path: 'drawings/site.pdf',
      fileName: 'site.pdf',
      linked: true,
      placement: { fit: 'contain' },
      sourceSelector: '#site-plan',
    }],
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
    'assets[].fileName',
    'assets[].linked',
    'assets[].placement',
    'assets[].sourceSelector',
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

test('validateModelFields rejects registered allowedValues violations in strict mode', () => {
  const result = validateModelFields(fieldRegistry, {
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [{
        id: 'item-1',
        role: 'bogus',
        effectiveLabel: { role: ' text ' },
      }],
    }],
  }, { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidValues.map((entry) => entry.path), [
    'items[].role',
    'items[].effectiveLabel.role',
  ]);
  for (const path of ['items[].role', 'items[].effectiveLabel.role']) {
    assert.equal(
      result.errors.some((error) => (
        error.code === 'MODEL_FIELD_VALUE_NOT_ALLOWED'
        && error.path === path
      )),
      true,
      `${path} should be a strict value-domain error`,
    );
  }
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

test('validateModelFields treats retired item type as retired instead of active accepted', () => {
  const result = validateModelFields(fieldRegistry, ['items[].type'], { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.retired.map((item) => item.path), ['items[].type']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'items[].type'
    )),
    true,
  );
});

test('validateModelFields treats retired flat InDesign surfaces as retired model fields', () => {
  const result = validateModelFields(
    fieldRegistry,
    ['items[].effects', 'items[].textFrameStyle'],
    { strict: true },
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(
    result.retired.map((item) => item.path),
    ['items[].effects', 'items[].textFrameStyle'],
  );
  assert.deepEqual(
    result.errors
      .filter((error) => error.code === 'MODEL_FIELD_RETIRED')
      .map((error) => error.path),
    ['items[].effects', 'items[].textFrameStyle'],
  );
});

test('scanModelPaths scans retired item type from DocumentModel objects without accepting root or page type', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    type: 'root-structural',
    id: 'doc',
    pages: [{
      id: 'p1',
      type: 'page-structural',
      items: [{
        id: 'i1',
        type: 'TextFrame',
        sourceType: 'TextFrame',
      }],
    }],
  });

  assert.equal(scannedPaths.includes('type'), false);
  assert.equal(scannedPaths.includes('pages[].type'), false);
  assert.equal(scannedPaths.includes('items[].type'), true);

  const result = validateModelFields(fieldRegistry, scannedPaths, { strict: true });

  assert.equal(result.valid, false);
  assert.equal(result.accepted.includes('items[].sourceType'), true);
  assert.equal(result.accepted.includes('items[].type'), false);
  assert.deepEqual(result.retired.map((item) => item.path), ['items[].type']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'items[].type'
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

test('scanModelPaths maps observedLabel styleRefs as observation metadata', () => {
  const scannedPaths = scanModelPaths({
    pages: [{
      items: [{
        observedLabel: {
          semantic: 'foreign-title',
          styleRefs: {
            paragraphStyle: 'missing-style',
          },
        },
      }],
    }],
  });

  assert.deepEqual(scannedPaths, [
    'items[].observedLabel',
    'items[].observedLabel.semantic',
    'items[].observedLabel.styleRefs',
  ]);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, true);
  assert.deepEqual(strict.unknown, []);
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
    assets: [{
      name: 'site-plan.pdf',
      path: '\\\\nas\\share\\site-plan.pdf',
      status: 'NORMAL',
    }],
    pages: [{
      id: 'p1',
      items: [{
        id: 'asset-1',
        madeUpField: true,
        asset: {
          name: 'site-plan.pdf',
          status: 'NORMAL',
          bounds: { x: 20, y: 30, width: 200, height: 100 },
          placement: {
            pageNumber: 1,
            crop: 'trim',
            fit: 'manual',
            transparentBackground: true,
            visibleLayers: ['site'],
            hiddenLayers: ['notes'],
            layers: ['site', 'notes'],
            frameBounds: { x: 20, y: 30, width: 200, height: 100 },
            contentBounds: { x: 10, y: 25, width: 240, height: 120 },
            contentOffset: { x: -10, y: -5 },
            contentSize: { width: 240, height: 120 },
            contentScale: { x: 1.2, y: 1.2 },
            pdfCrop: 'CROP_CONTENT_VISIBLE_LAYERS',
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
    'assets[].name',
    'assets[].path',
    'assets[].status',
    'items[].asset.name',
    'items[].asset.status',
    'items[].asset.bounds',
    'items[].asset.placement.pageNumber',
    'items[].asset.placement.crop',
    'items[].asset.placement.fit',
    'items[].asset.placement.transparentBackground',
    'items[].asset.placement.visibleLayers',
    'items[].asset.placement.hiddenLayers',
    'items[].asset.placement.layers',
    'items[].asset.placement.frameBounds',
    'items[].asset.placement.contentBounds',
    'items[].asset.placement.contentOffset',
    'items[].asset.placement.contentSize',
    'items[].asset.placement.contentScale',
    'items[].asset.placement.pdfCrop',
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

test('source metadata domain strict accepts scanned item effective-label source facts only as bare paths', () => {
  const registeredEffectiveLabelSourcePaths = [
    'effectiveLabel.sourceFile',
    'effectiveLabel.sourceNode',
    'effectiveLabel.sourceAncestorNodes',
    'effectiveLabel.sourceText',
    'effectiveLabel.sourceHtml',
    'effectiveLabel.sourceRuns',
    'effectiveLabel.structure',
  ];
  const falseItemEffectiveLabelSourcePaths = [
    'items[].effectiveLabel.sourceFile',
    'items[].effectiveLabel.sourceNode',
    'items[].effectiveLabel.sourceAncestorNodes',
    'items[].effectiveLabel.sourceText',
    'items[].effectiveLabel.sourceHtml',
    'items[].effectiveLabel.sourceRuns',
    'items[].effectiveLabel.structure',
  ];

  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      items: [{
        id: 'item-1',
        effectiveLabel: {
          semantic: 'caption',
          sourceFile: 'pages/01.html',
          sourceNode: { tagName: 'p' },
          sourceAncestorNodes: [{ tagName: 'section' }],
          sourceText: 'Caption',
          sourceHtml: '<p>Caption</p>',
          sourceRuns: [{ text: 'Caption' }],
          structure: { parentId: 'p1' },
        },
      }],
    }],
  });

  for (const path of registeredEffectiveLabelSourcePaths) {
    assert.equal(Boolean(fieldRegistry.getByPath(path)), true, `${path} should be registered`);
    assert.equal(scannedPaths.includes(path), true, `${path} should be scanned`);
  }
  for (const path of falseItemEffectiveLabelSourcePaths) {
    assert.equal(Boolean(fieldRegistry.getByPath(path)), false, `${path} should not be registered`);
    assert.equal(scannedPaths.includes(path), false, `${path} should not be scanned`);
  }

  const scannedStrict = validateModelFields(
    fieldRegistry,
    scannedPaths,
    { strict: true, domains: ['source.metadata'] },
  );
  assert.equal(scannedStrict.valid, true);
  assert.deepEqual(scannedStrict.accepted, registeredEffectiveLabelSourcePaths);

  const falsePathStrict = validateModelFields(
    fieldRegistry,
    falseItemEffectiveLabelSourcePaths,
    { strict: true, domains: ['source.metadata'] },
  );
  assert.equal(falsePathStrict.valid, true);
  assert.deepEqual(falsePathStrict.accepted, []);
  assert.deepEqual(falsePathStrict.unknown, falseItemEffectiveLabelSourcePaths);
  assert.equal(falsePathStrict.errors.length, 0);
  for (const path of falseItemEffectiveLabelSourcePaths) {
    assert.equal(
      falsePathStrict.warnings.some((warning) => (
        warning.code === 'MODEL_FIELD_NOT_REGISTERED'
        && warning.path === path
      )),
      true,
      `${path} should remain an unknown warning`,
    );
  }
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
    'items[].visualStyle.strokeAlignment',
    'items[].visualStyle.lineStartMarker',
    'items[].visualStyle.lineEndMarker',
    'items[].visualStyle.blendMode',
    'items[].vectorGeometry.kind',
    'items[].vectorGeometry.paths',
  ]) {
    assert.equal(result.accepted.includes(path), true, `${path} should be accepted`);
    assert.equal(result.unknown.includes(path), false, `${path} should not be unknown`);
  }
  for (const path of [
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

test('strict DocumentModel validation rejects retired flat InDesign surface paths', () => {
  const model = minimalDocumentModel({
    effects: { gradientFeather: { scope: 'fill' } },
    textFrameStyle: { inset: { top: 4, right: 6, bottom: 4, left: 6 } },
  });

  const scannedPaths = scanModelPaths(model);
  assert.equal(scannedPaths.includes('items[].effects'), true);
  assert.equal(scannedPaths.includes('items[].textFrameStyle'), true);
  assert.equal(scannedPaths.includes('pages[].items[].effects'), false);
  assert.equal(scannedPaths.includes('pages[].items[].textFrameStyle'), false);

  const result = validateSemanticModel(model, { strictFields: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.fieldValidation.unknown, []);
  assert.deepEqual(
    result.fieldValidation.retired.map((item) => item.path),
    ['items[].effects', 'items[].textFrameStyle'],
  );
  assert.equal(
    result.fieldValidation.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'items[].effects'
    )),
    true,
  );
  assert.equal(
    result.fieldValidation.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'items[].textFrameStyle'
    )),
    true,
  );
});

test('strict DocumentModel validation accepts current InDesign extension surface paths', () => {
  const model = minimalDocumentModel({
    extensions: {
      indesign: {
        effects: { gradientFeather: { scope: 'fill' } },
        textFrameStyle: { inset: { top: 4, right: 6, bottom: 4, left: 6 } },
      },
    },
  });

  const scannedPaths = scanModelPaths(model);
  assert.equal(scannedPaths.includes('items[].extensions.indesign.effects'), true);
  assert.equal(scannedPaths.includes('items[].extensions.indesign.textFrameStyle'), true);

  const result = validateSemanticModel(model, { strictFields: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.fieldValidation.unknown, []);
  assert.deepEqual(result.fieldValidation.retired, []);
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
            textStyle: { fillColor: '#123456' },
            inlineStyle: 'color:#123456',
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
              textStyle: { pointSize: 10, fillColor: '#111111' },
              padding: { top: 4 },
              borders: { left: { color: '#111111' } },
              runs: [{
                text: 'Area',
                tagName: 'span',
                classList: ['metric'],
                attributes: {},
                characterStyle: 'emphasis',
                textStyle: { fillColor: '#123456' },
                inlineStyle: 'color:#123456',
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
    'items[].content.runs[].textStyle',
    'items[].content.runs[].inlineStyle',
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
    'items[].table.rows[].cells[].textStyle',
    'items[].table.rows[].cells[].padding',
    'items[].table.rows[].cells[].borders',
    'items[].table.rows[].cells[].runs',
    'items[].table.rows[].cells[].runs[].text',
    'items[].table.rows[].cells[].runs[].tagName',
    'items[].table.rows[].cells[].runs[].classList',
    'items[].table.rows[].cells[].runs[].attributes',
    'items[].table.rows[].cells[].runs[].characterStyle',
    'items[].table.rows[].cells[].runs[].textStyle',
    'items[].table.rows[].cells[].runs[].inlineStyle',
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

function minimalDocumentModel(itemFields = {}) {
  return {
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'document',
      id: 'doc',
    }],
    pages: [{
      id: 'p1',
      labels: [{
        protocol: 'html-indesign',
        version: 1,
        kind: 'page',
        id: 'p1',
      }],
      items: [{
        id: 'i1',
        labels: [{
          protocol: 'html-indesign',
          version: 1,
          kind: 'item',
          id: 'i1',
        }],
        ...itemFields,
      }],
    }],
  };
}
