const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function collectRequireGraph(rootDirs) {
  if (!Array.isArray(rootDirs) || rootDirs.length === 0) {
    throw new Error('rootDirs must be a non-empty array');
  }

  const roots = rootDirs.map((rootDir, index) => {
    if (typeof rootDir !== 'string' || rootDir.trim() === '') {
      throw new Error(`rootDirs[${index}] must be a non-empty string`);
    }
    const resolved = path.resolve(rootDir);
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`rootDirs[${index}] must be a directory: ${resolved}`);
    }
    return resolved;
  });

  const files = roots.flatMap((root) => collectJavaScriptFiles(root)).sort();
  const edges = [];
  const observations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\brequire\s*\(([^)]*)\)/g)) {
      const expression = match[1].trim();
      const staticRequest = staticRequireRequest(expression);
      if (staticRequest === null) {
        observations.push({ from: file, expression });
        continue;
      }
      if (!staticRequest.startsWith('.')) {
        continue;
      }
      edges.push({ from: file, to: resolveRelativeRequire(file, staticRequest) });
    }
  }

  return { edges, observations };
}

function collectJavaScriptFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(fullPath));
    } else if (entry.isFile() && ['.js', '.cjs'].includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function staticRequireRequest(expression) {
  const match = /^(['"])(.*)\1$/.exec(expression);
  return match ? match[2] : null;
}

function resolveRelativeRequire(fromFile, request) {
  try {
    return createRequire(fromFile).resolve(request);
  } catch (error) {
    throw new Error(`Cannot resolve relative require '${request}' from ${fromFile}: ${error.message}`);
  }
}

module.exports = {
  collectRequireGraph,
};
