function uniquePaths(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const seen = new Set();
  const unique = [];

  for (const path of list) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    unique.push(path);
  }

  return unique;
}

module.exports = {
  uniquePaths,
};
