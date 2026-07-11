const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { copyAuthorAssets } = require('./author-asset-packager');
const { toBrowserAssetPath, isNasReference } = require('../../shared/nas-paths');
const {
  normalizePathKey,
  sourceFileKey,
  resolveLocalAssetReference,
  sanitizeRelative,
  isRemoteReference,
} = require('../../shared/assets');

function prepareAuthorAssets(model, options = {}) {
  const policy = options.assetPolicy || 'reference';
  if (policy === 'copy') {
    const result = copyAuthorAssets(model, options);
    return {
      pathMap: result.pathMap,
      report: {
        policy: 'copy',
        referenced: 0,
        generated: 0,
        ...result.report,
      },
    };
  }
  if (policy !== 'reference') {
    throw new Error(`Unknown author asset policy: ${policy}`);
  }
  return referenceAuthorAssets(model, options);
}

function referenceAuthorAssets(model, options = {}) {
  const records = collectAssetReferences(model);
  const pathMap = new Map();
  const entries = [];
  const seen = new Set();
  const generated = [];
  const missing = [];
  const copiedBySource = new Map();
  const used = new Map();
  for (const record of records) {
    if (record.kind === 'generated-preview') {
      copyGeneratedPreview(record, {
        outDir: options.outDir,
        pathMap,
        generated,
        missing,
        copiedBySource,
        used,
      });
      continue;
    }
    let htmlPath = toBrowserAssetPath(record.value, { nasRoot: options.nasPublicRoot || '/nas' });
    let reason = reasonForReference(record.value, htmlPath);
    if (shouldResolveLocalReference(record.value, options)) {
      const resolved = resolveLocalReference(record, options.sourceRoot);
      if (resolved) {
        htmlPath = pathToFileURL(resolved).href;
        reason = 'local-file-reference';
      } else {
        missing.push({ path: record.value, reason: 'local-reference-missing' });
      }
    }
    if (!htmlPath) continue;
    for (const value of [record.value, record.fallback, ...(record.aliases || [])]) addPathMap(pathMap, value, htmlPath);
    const key = normalizePathKey(record.value);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      originalPath: record.value,
      htmlPath,
      reason,
    });
  }
  return {
    pathMap,
    report: {
      policy: 'reference',
      referenced: entries.length,
      copied: 0,
      copiedFiles: [],
      generated: generated.length,
      generatedFiles: generated.map((entry) => entry.path),
      missing,
      entries,
    },
  };
}

function shouldResolveLocalReference(original, options = {}) {
  if (isRemoteReference(original)) return false;
  if (isNasReference(original)) return false;
  return Boolean(options.sourceRoot) || /^file:/i.test(String(original || '')) || path.isAbsolute(String(original || ''));
}

function copyGeneratedPreview(record, context) {
  if (!context.outDir) return '';
  const resolved = resolveGeneratedPreview(record);
  const aliases = [record.value, record.fallback, ...(record.aliases || [])].filter(Boolean);
  if (!resolved) {
    context.missing.push({ path: record.value, reason: 'generated-preview-missing' });
    for (const alias of aliases) {
      if (record.relativePath) addPathMap(context.pathMap, alias, record.relativePath);
    }
    return '';
  }
  const sourceKey = sourceFileKey(resolved);
  let relativePath = context.copiedBySource.get(sourceKey);
  if (!relativePath) {
    relativePath = previewPackagePath(record, resolved, context.used);
    const target = path.join(context.outDir, relativePath);
    if (path.resolve(resolved) !== path.resolve(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(resolved, target);
    }
    context.copiedBySource.set(sourceKey, relativePath);
    context.generated.push({ source: resolved, path: relativePath });
  }
  for (const alias of aliases) addPathMap(context.pathMap, alias, relativePath);
  addPathMap(context.pathMap, resolved, relativePath);
  addPathMap(context.pathMap, relativePath, relativePath);
  return relativePath;
}

function resolveGeneratedPreview(record) {
  for (const value of [record.value, record.fallback, ...(record.aliases || [])]) {
    if (!shouldConsiderGeneratedPreviewPath(value)) continue;
    const candidate = resolveLocalAssetReference(value, { resolveRelativeToCwd: true });
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return '';
}

function shouldConsiderGeneratedPreviewPath(value) {
  if (!value) return false;
  return !isRemoteReference(value);
}

function previewPackagePath(record, resolvedPath, used) {
  const root = 'previews';
  const preferred = record.relativePath && /^previews\//i.test(slash(record.relativePath))
    ? sanitizeRelative(record.relativePath)
    : slash(path.posix.join(root, sanitizeRelative(path.basename(resolvedPath))));
  let relativePath = preferred;
  const existing = used.get(relativePath);
  if (existing && path.resolve(existing) !== path.resolve(resolvedPath)) {
    const parsed = path.posix.parse(relativePath);
    let index = 2;
    do {
      relativePath = slash(path.posix.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`));
      index += 1;
    } while (used.has(relativePath));
  }
  used.set(relativePath, resolvedPath);
  return relativePath;
}

function resolveLocalReference(record, sourceRoot) {
  const candidates = [];
  for (const value of [record.value, record.fallback, ...(record.aliases || [])]) {
    if (!value || isRemoteReference(value) || isNasReference(value)) continue;
    const resolved = resolveLocalAssetReference(value, { sourceRoot });
    if (resolved) candidates.push(resolved);
  }
  for (const candidate of unique(candidates)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return '';
}

function collectAssetReferences(model) {
  const records = [];
  const seen = new Set();
  for (const page of model && model.pages || []) {
    for (const item of page.items || []) collectAssetReferencesForItem(item, records, seen);
  }
  for (const asset of model && model.assets || []) {
    const value = asset && asset.path;
    if (value) {
      pushAssetRecord(records, seen, {
        value,
        fallback: value,
      });
    }
  }
  return records;
}

function collectAssetReferencesForItem(item, records, seen) {
  const sourceNode = item && item.effectiveLabel && item.effectiveLabel.sourceNode || item.sourceNode || {};
  const attrs = sourceNode.attributes || {};
  const asset = item.sourceAsset || item.asset || item.placedAsset || {};
  const assetPath = asset.path || '';
  for (const name of ['src', 'data', 'href', HTML_DATA_ID_ATTRIBUTES.SOURCE_CSV, HTML_DATA_ID_ATTRIBUTES.SOURCE_XML]) {
    if (!attrs[name]) continue;
    pushAssetRecord(records, seen, {
      value: attrs[name],
      fallback: assetPath,
      aliases: assetPath ? [assetPath] : [],
    });
  }
  if (sourceNode.previewNode && sourceNode.previewNode.attributes && sourceNode.previewNode.attributes.src) {
    pushAssetRecord(records, seen, {
      value: sourceNode.previewNode.attributes.src,
      fallback: sourceNode.previewNode.attributes.src,
    });
  }
  const sourcePreview = attrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] || attrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_ASSET_PATH] || '';
  if (sourcePreview && !attrs[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH] && assetPath) {
    pushAssetRecord(records, seen, {
      kind: 'generated-preview',
      value: assetPath,
      fallback: sourcePreview,
      aliases: [sourcePreview],
      relativePath: sourcePreview,
    });
  }
  if (asset.preview) {
    const preview = typeof asset.preview === 'string' ? { path: asset.preview } : asset.preview;
    const previewValue = preview.path || preview.htmlPath || preview.relativePath || '';
    if (previewValue) {
      pushAssetRecord(records, seen, {
        kind: 'generated-preview',
        value: previewValue,
        fallback: preview.relativePath || preview.htmlPath || preview.path || previewValue,
        aliases: [preview.path, preview.relativePath, preview.htmlPath].filter(Boolean),
        relativePath: preview.relativePath || null,
      });
    }
  }
  if (assetPath) pushAssetRecord(records, seen, { value: assetPath, fallback: assetPath });
}

function pushAssetRecord(records, seen, record) {
  const value = String(record.value || '').trim();
  if (!value || isSkippedReference(value)) return;
  const key = normalizePathKey(value);
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ ...record, value });
}

function addPathMap(pathMap, from, to) {
  if (!from || !to) return;
  pathMap.set(normalizePathKey(from), slash(to));
}

function reasonForReference(original, htmlPath) {
  if (String(htmlPath || '').startsWith('/nas/')) return 'nas-reference';
  if (original === htmlPath) return 'relative-reference';
  return 'reference';
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isSkippedReference(value) {
  const input = String(value || '');
  if (input.startsWith('#')) return true;
  return isRemoteReference(input);
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value != null && value !== '')));
}

module.exports = {
  prepareAuthorAssets,
  referenceAuthorAssets,
  collectAssetReferences,
  shouldConsiderGeneratedPreviewPath,
};
