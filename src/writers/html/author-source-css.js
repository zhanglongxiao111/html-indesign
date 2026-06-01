const fs = require('fs');
const path = require('path');

function authorStyleFiles({ sourceCss, generatedCss, sourceRoot }) {
  if (sourceRoot && sourceCss.requested.length) {
    return unique([
      ...sourceCss.requested.filter((relativePath) => sourceCss.copiedSet.has(relativePath) || Object.prototype.hasOwnProperty.call(generatedCss, relativePath)),
      'styles/reverse-overrides.css',
    ]);
  }
  return Object.keys(generatedCss).map(slash);
}

function planSourceCss(model, { sourceRoot, generatedCss }) {
  const requested = ((model.sourcePackage && model.sourcePackage.styleFiles) || [])
    .map(slash)
    .filter(Boolean);
  const copied = [];
  const missing = [];
  const files = [];
  const copiedSet = new Set();
  if (sourceRoot) {
    for (const relativePath of requested) {
      const sourcePath = path.resolve(sourceRoot, relativePath);
      if (isInside(sourceRoot, sourcePath) && fs.existsSync(sourcePath)) {
        copied.push(relativePath);
        copiedSet.add(relativePath);
        files.push({ relativePath, sourcePath });
      } else {
        missing.push(relativePath);
      }
    }
  }
  return {
    requested,
    copiedSet,
    files,
    report: { copied: copied.length, copiedFiles: copied, missing },
  };
}

function copySourceCssFiles(outDir, sourceCss) {
  for (const file of sourceCss.files) {
    const target = path.join(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file.sourcePath, target);
  }
}

function isInside(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target === root || target.startsWith(rootWithSeparator);
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value != null && value !== '')));
}

module.exports = {
  authorStyleFiles,
  copySourceCssFiles,
  planSourceCss,
};
