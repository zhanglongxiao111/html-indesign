'use strict';

const fs = require('fs');
const path = require('path');
const { copyAuthorAssets } = require('./author-asset-packager');
const { toBrowserAssetPath } = require('../../shared/nas-paths');

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
  const copied = [];
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
    if (shouldCopyLocalReference(record.value, htmlPath, options)) {
      const copiedPath = copyLocalReference(record, {
        outDir: options.outDir,
        sourceRoot: options.sourceRoot,
        assetRoot: options.assetRoot,
        copied,
        copiedBySource,
        used,
        pathMap,
      });
      if (copiedPath) {
        htmlPath = copiedPath;
        reason = 'local-copy-for-preview';
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
      copied: copied.length,
      copiedFiles: copied.map((entry) => entry.path),
      generated: generated.length,
      generatedFiles: generated.map((entry) => entry.path),
      missing,
      entries,
    },
  };
}

function shouldCopyLocalReference(original, htmlPath, options = {}) {
  if (!options.outDir || !options.sourceRoot) return false;
  if (!htmlPath || String(htmlPath).startsWith('/nas/')) return false;
  if (isRemoteReference(original)) return false;
  return true;
}

function copyLocalReference(record, context) {
  const resolved = resolveLocalReference(record, context.sourceRoot);
  if (!resolved) return '';
  const sourceKey = sourceFileKey(resolved);
  let relativePath = context.copiedBySource.get(sourceKey);
  if (!relativePath) {
    relativePath = assetPackagePath(record.value, resolved, {
      assetRoot: context.assetRoot || 'assets',
      used: context.used,
    });
    const target = path.join(context.outDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(resolved, target);
    context.copied.push({ source: resolved, path: relativePath });
    context.copiedBySource.set(sourceKey, relativePath);
  }
  addPathMap(context.pathMap, record.value, relativePath);
  addPathMap(context.pathMap, resolved, relativePath);
  for (const alias of record.aliases || []) addPathMap(context.pathMap, alias, relativePath);
  copyLocalPdfPreview(record, resolved, relativePath, context);
  return relativePath;
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
    const candidate = path.isAbsolute(value) ? path.resolve(value) : path.resolve(value);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
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
    if (path.isAbsolute(value)) candidates.push(path.resolve(value));
    if (sourceRoot) candidates.push(path.resolve(sourceRoot, value));
  }
  for (const candidate of unique(candidates)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return '';
}

function assetPackagePath(value, resolvedPath, { assetRoot, used }) {
  const root = slash(assetRoot || 'assets').replace(/^\/+|\/+$/g, '') || 'assets';
  const subPath = assetSubPath(value, resolvedPath, root);
  let relativePath = slash(path.posix.join(root, subPath));
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

function assetSubPath(value, resolvedPath, assetRoot) {
  const normalized = slash(value || '');
  if (normalized && !path.isAbsolute(value) && !isRemoteReference(value)) {
    const parts = normalized.split('/').filter((part) => part && part !== '.');
    while (parts[0] === '..') parts.shift();
    if (parts[0] === assetRoot) parts.shift();
    if (parts.length) return sanitizeRelative(parts.join('/'));
  }
  return sanitizeRelative(path.basename(resolvedPath));
}

function copyLocalPdfPreview(record, resolvedPath, relativePath, context) {
  if (!/\.pdf$/i.test(resolvedPath)) return;
  const pageNumber = normalizePositiveInteger(record.pdfPageNumber);
  if (pageNumber == null) return;
  const originalPreview = pdfPreviewPath(record.value, pageNumber);
  const sourcePreview = resolvedPath.replace(/\.pdf$/i, `-page${pageNumber}.png`);
  if (!fs.existsSync(sourcePreview)) return;
  const targetRelative = relativePath.replace(/\.pdf$/i, `-page${pageNumber}.png`);
  const target = path.join(context.outDir, targetRelative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePreview, target);
  addPathMap(context.pathMap, originalPreview, targetRelative);
  addPathMap(context.pathMap, sourcePreview, targetRelative);
}

function pdfPreviewPath(pdfPath, page) {
  const value = String(pdfPath || '');
  const pageNumber = normalizePositiveInteger(page);
  if (pageNumber == null) return '';
  if (!/\.pdf(?:[?#].*)?$/i.test(value)) return '';
  return value.replace(/\.pdf(?:[?#].*)?$/i, `-page${pageNumber}.png`);
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
        pdfPageNumber: pdfPageNumberForAsset(asset, {}),
      });
    }
  }
  return records;
}

function collectAssetReferencesForItem(item, records, seen) {
  const sourceNode = item.sourceNode || {};
  const attrs = sourceNode.attributes || {};
  const asset = item.sourceAsset || item.asset || item.placedAsset || {};
  const assetPath = asset.path || '';
  const pdfPageNumber = pdfPageNumberForAsset(asset, attrs);
  for (const name of ['src', 'data', 'href', 'data-id-source-csv', 'data-id-source-xml']) {
    if (!attrs[name]) continue;
    pushAssetRecord(records, seen, {
      value: attrs[name],
      fallback: assetPath,
      aliases: assetPath ? [assetPath] : [],
      pdfPageNumber,
    });
  }
  if (sourceNode.previewNode && sourceNode.previewNode.attributes && sourceNode.previewNode.attributes.src) {
    pushAssetRecord(records, seen, {
      value: sourceNode.previewNode.attributes.src,
      fallback: sourceNode.previewNode.attributes.src,
    });
  }
  const sourcePreview = attrs['data-id-preview-src'] || attrs['data-id-preview-asset-path'] || '';
  if (sourcePreview && !attrs['data-id-asset-path'] && assetPath) {
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
  if (assetPath) pushAssetRecord(records, seen, { value: assetPath, fallback: assetPath, pdfPageNumber });
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

function normalizePathKey(value) {
  return slash(String(value || '')).toLowerCase();
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isSkippedReference(value) {
  const input = String(value || '');
  if (input.startsWith('#')) return true;
  return isRemoteReference(input);
}

function isRemoteReference(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value || '')) && !/^file:/i.test(String(value || '')) && !/^[a-z]:[\\/]/i.test(String(value || ''));
}

function isNasReference(value) {
  const input = slash(String(value || ''));
  return /^\/\/[^/]+\/.+/.test(input) || input.startsWith('/nas/');
}

function sourceFileKey(value) {
  return process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
}

function sanitizeRelative(value) {
  return slash(value)
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replace(/[<>:"|?*]/g, '_'))
    .join('/') || 'asset';
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value != null && value !== '')));
}

function pdfPageNumberForAsset(asset = {}, attrs = {}) {
  return normalizePositiveInteger(
    attrs['data-id-pdf-page']
      ?? (asset.placement && asset.placement.pageNumber)
      ?? asset.pageNumber
  );
}

function normalizePositiveInteger(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

module.exports = {
  prepareAuthorAssets,
  referenceAuthorAssets,
  collectAssetReferences,
  shouldConsiderGeneratedPreviewPath,
};
