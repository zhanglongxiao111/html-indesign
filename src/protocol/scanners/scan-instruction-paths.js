const hasOwn = Object.prototype.hasOwnProperty;

const ITEM_FIELD_PATHS = Object.freeze({
  text: 'pages[].items[].text',
});

const TABLE_FIELD_PATHS = Object.freeze({
  rows: 'pages[].items[].table.rows',
});

const TABLE_ROW_FIELD_PATHS = Object.freeze({
  cells: 'pages[].items[].table.rows[].cells',
});

const STRUCTURAL_KEYS = new Set(['id', 'kind', 'type']);

function scanInstructionPaths(instructions) {
  const paths = [];
  const seen = new Set();

  if (!isPlainObject(instructions) || !Array.isArray(instructions.pages)) {
    return paths;
  }

  for (const page of instructions.pages) {
    if (!isPlainObject(page) || !Array.isArray(page.items)) {
      continue;
    }

    for (const item of page.items) {
      scanInstructionItem(paths, seen, item);
    }
  }

  return paths;
}

function scanInstructionItem(paths, seen, item) {
  if (!isPlainObject(item)) {
    return;
  }

  for (const [key, value] of Object.entries(item)) {
    if (key === 'placed') {
      scanObjectSurface(paths, seen, value, 'pages[].items[].placed');
    } else if (key === 'table') {
      scanTable(paths, seen, value);
    } else if (key === 'appearance') {
      scanObjectSurface(paths, seen, value, 'pages[].items[].appearance');
    } else if (hasOwn.call(ITEM_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `pages[].items[].${key}`);
    }
  }
}

function scanTable(paths, seen, table) {
  if (!isPlainObject(table)) {
    return;
  }

  for (const [key, value] of Object.entries(table)) {
    if (key === 'rows') {
      addPath(paths, seen, TABLE_FIELD_PATHS.rows);
      if (Array.isArray(value)) {
        for (const row of value) {
          scanObjectWithMap(paths, seen, row, TABLE_ROW_FIELD_PATHS, 'pages[].items[].table.rows[]');
        }
      }
    } else if (hasOwn.call(TABLE_FIELD_PATHS, key)) {
      addPath(paths, seen, TABLE_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `pages[].items[].table.${key}`);
    }
  }
}

function scanObjectWithMap(paths, seen, value, pathByKey, prefix) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (hasOwn.call(pathByKey, key)) {
      addPath(paths, seen, pathByKey[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function scanObjectSurface(paths, seen, value, prefix) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function addPath(paths, seen, path) {
  if (seen.has(path)) {
    return;
  }
  seen.add(path);
  paths.push(path);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  scanInstructionPaths,
});
