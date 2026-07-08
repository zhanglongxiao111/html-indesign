const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const fs = require('fs');
const path = require('path');
const {
  normalizePathKey,
  sourceFileKey,
  sanitizeRelative,
  isRemoteReference,
} = require('../../shared/assets');

function copyAuthorAssets(model, { outDir, sourceRoot, assetRoot }) {
  const records = collectAssetReferences(model);
  const pathMap = new Map();
  const copied = [];
  const missing = [];
  const used = new Map();
  const copiedBySource = new Map();
  for (const record of records) {
    const resolved = resolveAssetRecord(record, sourceRoot);
    if (!resolved) {
      missing.push(record.value);
      continue;
    }
    const sourceKey = sourceFileKey(resolved);
    let relativePath = copiedBySource.get(sourceKey);
    if (!relativePath) {
      relativePath = assetPackagePath(record.value, resolved, { assetRoot, used });
      const target = path.join(outDir, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(resolved, target);
      copied.push({ source: resolved, path: relativePath });
      copiedBySource.set(sourceKey, relativePath);
    }
    addPathMap(pathMap, record.value, relativePath);
    addPathMap(pathMap, resolved, relativePath);
    for (const alias of record.aliases || []) addPathMap(pathMap, alias, relativePath);
    copyPdfPreviewAsset(record, resolved, relativePath, { outDir, pathMap });
  }
  return {
    pathMap,
    report: {
      copied: copied.length,
      copiedFiles: copied.map((entry) => entry.path),
      missing: unique(missing),
    },
  };
}

function collectAssetReferences(model) {
  const records = [];
  const seen = new Set();
  for (const page of model.pages || []) {
    for (const item of page.items || []) collectAssetReferencesForItem(item, records, seen);
  }
  for (const asset of model.assets || []) {
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
  for (const name of ['src', 'data', 'href', HTML_DATA_ID_ATTRIBUTES.SOURCE_CSV, HTML_DATA_ID_ATTRIBUTES.SOURCE_XML]) {
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
  if (assetPath) {
    pushAssetRecord(records, seen, { value: assetPath, fallback: assetPath, pdfPageNumber });
  }
}

function pushAssetRecord(records, seen, record) {
  const value = String(record.value || '').trim();
  if (!value || isRemoteReference(value) || value.startsWith('#')) return;
  const key = normalizePathKey(value);
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ ...record, value });
}

function resolveAssetRecord(record, sourceRoot) {
  const candidates = [];
  for (const value of [record.value, record.fallback, ...(record.aliases || [])]) {
    if (!value || isRemoteReference(value)) continue;
    if (path.isAbsolute(value)) candidates.push(path.resolve(value));
    if (sourceRoot) candidates.push(path.resolve(sourceRoot, value));
  }
  for (const candidate of unique(candidates)) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
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

function copyPdfPreviewAsset(record, resolvedPath, relativePath, { outDir, pathMap }) {
  if (!/\.pdf$/i.test(resolvedPath)) return;
  const pageNumber = normalizePositiveInteger(record.pdfPageNumber);
  if (pageNumber == null) return;
  const originalPreview = pdfPreviewPath(record.value, pageNumber);
  const sourcePreview = resolvedPath.replace(/\.pdf$/i, `-page${pageNumber}.png`);
  if (!fs.existsSync(sourcePreview)) return;
  const targetRelative = relativePath.replace(/\.pdf$/i, `-page${pageNumber}.png`);
  const target = path.join(outDir, targetRelative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePreview, target);
  addPathMap(pathMap, originalPreview, targetRelative);
  addPathMap(pathMap, sourcePreview, targetRelative);
}

function pdfPreviewPath(pdfPath, page) {
  const value = String(pdfPath || '');
  const pageNumber = normalizePositiveInteger(page);
  if (pageNumber == null) return '';
  if (!/\.pdf(?:[?#].*)?$/i.test(value)) return '';
  return value.replace(/\.pdf(?:[?#].*)?$/i, `-page${pageNumber}.png`);
}

function addPathMap(pathMap, from, to) {
  if (!from || !to) return;
  pathMap.set(normalizePathKey(from), slash(to));
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value != null && value !== '')));
}

function pdfPageNumberForAsset(asset = {}, attrs = {}) {
  return normalizePositiveInteger(
    attrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE]
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
  copyAuthorAssets,
};
