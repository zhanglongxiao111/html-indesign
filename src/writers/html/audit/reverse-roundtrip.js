const fs = require('fs');
const path = require('path');
const { checkAuthorPackageEntry } = require('../../../authoring');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const { auditReverseAuthorPackage: auditEditableAuthorPackage } = require('./author-audit');
const {
  auditAuthorSourceRoundtrip,
  measureAuthorSourceDrift,
} = require('./source-roundtrip-diff');
const {
  authorPackageContentInventory,
  compareContentInventories,
} = require('./content-inventory');
const {
  authorPackageStructureSignature,
  compareStructureSignatures,
} = require('./structure-signature');

function auditReverseHtmlSemantics(html) {
  const text = String(html || '');
  const counts = {
    dataPage: attributeCount(text, 'data-page'),
    parentPage: attributeCount(text, HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE),
    layout: attributeCount(text, HTML_DATA_ID_ATTRIBUTES.LAYOUT),
    semantic: attributeCount(text, HTML_DATA_ID_ATTRIBUTES.SEMANTIC),
  };
  const missing = [];
  if (counts.dataPage === 0) missing.push('data-page');
  if (counts.parentPage === 0) missing.push(HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE);
  if (counts.layout === 0) missing.push(HTML_DATA_ID_ATTRIBUTES.LAYOUT);
  if (counts.semantic === 0) missing.push(HTML_DATA_ID_ATTRIBUTES.SEMANTIC);
  return {
    ok: missing.length === 0,
    counts,
    missing,
  };
}

function assertReverseHtmlSemantics(html, source = 'reverse HTML') {
  const audit = auditReverseHtmlSemantics(html);
  if (!audit.ok) {
    throw new Error(`${source} is missing required bidirectional semantic tags: ${audit.missing.join(', ')}`);
  }
  return audit;
}

function auditReverseAuthorPackage(author) {
  if (!author || !author.config || !fs.existsSync(author.config)) {
    return { ok: false, missing: ['author/deck.config.json'] };
  }
  let check;
  try {
    check = checkAuthorPackageEntry(author.config);
  } catch (error) {
    return {
      ok: false,
      config: author.config,
      error: error && error.message ? error.message : String(error),
    };
  }
  const config = JSON.parse(fs.readFileSync(author.config, 'utf8'));
  const pageFiles = (config.pages || []).map((page) => path.join(path.dirname(author.config), page.file));
  const missingPages = pageFiles.filter((file) => !fs.existsSync(file));
  const outDir = author.outDir || path.dirname(author.config);
  const editable = auditEditableAuthorPackage(outDir);
  const sourceRoundtrip = author.sourceRoot
    ? auditAuthorSourceRoundtrip({
      sourceRoot: author.sourceRoot,
      reverseRoot: outDir,
      strict: !!author.strictSourceRoundtrip,
      includeSourceDrift: true,
    })
    : null;
  if (sourceRoundtrip) {
    const reportDir = path.join(outDir, 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'source-roundtrip-report.json'), JSON.stringify(sourceRoundtrip, null, 2), 'utf8');
  }
  let contentInventory = null;
  let structureSignature = null;
  if (author.sourceRoot) {
    const reportDir = path.join(outDir, 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    contentInventory = compareContentInventories(
      authorPackageContentInventory(author.sourceRoot),
      authorPackageContentInventory(outDir),
      { strictGeometry: false },
    );
    structureSignature = compareStructureSignatures(
      authorPackageStructureSignature(author.sourceRoot),
      authorPackageStructureSignature(outDir),
    );
    fs.writeFileSync(path.join(reportDir, 'content-inventory-report.json'), JSON.stringify(contentInventory, null, 2), 'utf8');
    fs.writeFileSync(path.join(reportDir, 'structure-signature-report.json'), JSON.stringify(structureSignature, null, 2), 'utf8');
  }
  const contentOk = contentInventory ? contentInventory.ok : true;
  const strictStructureSignature = !!author.strictStructureSignature;
  const structureOk = structureSignature ? (structureSignature.ok || !strictStructureSignature) : true;
  const sourceRoundtripAdvisoryWarnings = sourceRoundtrip && !sourceRoundtrip.ok
    ? [{
      code: 'SOURCE_ROUNDTRIP_DIFF_ADVISORY',
      severity: 'warning',
      message: 'Source exact diff changed but content inventory and structure signature remain the hard integrity gates.',
      errorCount: (sourceRoundtrip.errors || []).length,
      report: 'reports/source-roundtrip-report.json',
    }]
    : [];
  const structureSignatureAdvisoryWarnings = structureSignature && !structureSignature.ok && !strictStructureSignature
    ? [{
      code: 'STRUCTURE_SIGNATURE_DIFF_ADVISORY',
      severity: 'warning',
      message: 'Source author structure changed; first-pass structure signature is recorded as advisory and second-pass canonical drift remains the hard stability gate.',
      errorCount: (structureSignature.errors || []).length,
      report: 'reports/structure-signature-report.json',
    }]
    : [];
  return {
    ok: check.ok && missingPages.length === 0 && editable.ok && contentOk && structureOk,
    config: author.config,
    entry: check.entryPath,
    pages: pageFiles.length,
    missingPages,
    editable,
    sourceRoundtrip,
    contentInventory,
    structureSignature,
    errors: [
      ...(editable.errors || []),
      ...(contentInventory && !contentInventory.ok ? contentInventory.errors : []),
      ...(structureSignature && !structureSignature.ok && strictStructureSignature ? structureSignature.errors : []),
    ],
    warnings: [
      ...(editable.warnings || []),
      ...sourceRoundtripAdvisoryWarnings,
      ...structureSignatureAdvisoryWarnings,
      ...(sourceRoundtrip ? sourceRoundtrip.warnings : []),
      ...(contentInventory ? contentInventory.warnings : []),
      ...(structureSignature ? structureSignature.warnings : []),
    ],
  };
}

function auditSecondPassAuthorStability({ sourceRoot, reverseRoot, reportDir }) {
  const sourceDrift = measureAuthorSourceDrift({ sourceRoot, reverseRoot });
  const contentInventory = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot),
  );
  const structureSignature = compareStructureSignatures(
    authorPackageStructureSignature(sourceRoot),
    authorPackageStructureSignature(reverseRoot),
  );
  const outDir = reportDir || path.join(reverseRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'canonical-source-drift-report.json'), JSON.stringify(sourceDrift, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'canonical-content-inventory-report.json'), JSON.stringify(contentInventory, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'canonical-structure-signature-report.json'), JSON.stringify(structureSignature, null, 2), 'utf8');
  const sourceDriftErrors = sourceDrift && sourceDrift.stable === false
    ? [{
      code: 'CANONICAL_SOURCE_DRIFT_UNSTABLE',
      severity: 'error',
      message: 'Second-pass author package must be byte-stable; source drift is a hard stability failure.',
      filesChanged: sourceDrift.stats && sourceDrift.stats.filesChanged,
      normalizedFilesChanged: sourceDrift.stats && sourceDrift.stats.normalizedFilesChanged,
      report: 'reports/canonical-source-drift-report.json',
    }]
    : [];
  const errors = [
    ...sourceDriftErrors,
    ...(contentInventory && !contentInventory.ok ? contentInventory.errors : []),
    ...(structureSignature && !structureSignature.ok ? structureSignature.errors : []),
  ];
  return {
    ok: errors.length === 0,
    sourceDrift,
    contentInventory,
    structureSignature,
    errors,
    warnings: [],
  };
}

function attributeCount(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(html || '').match(new RegExp(`\\b${escaped}\\s*=`, 'g')) || []).length;
}

module.exports = {
  auditReverseHtmlSemantics,
  assertReverseHtmlSemantics,
  auditReverseAuthorPackage,
  auditSecondPassAuthorStability,
};
