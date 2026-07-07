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
    for (const expression of extractRequireExpressions(source, file)) {
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

function extractRequireExpressions(source, file) {
  const expressions = [];
  let index = 0;

  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index, file);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index, file);
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index, file);
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index, file);
    } else if (isRequireIdentifierAt(source, index)) {
      const openParenIndex = findRequireOpenParen(source, index + 'require'.length);
      if (openParenIndex === null) {
        index += 'require'.length;
      } else {
        const closeParenIndex = findCallCloseParen(source, openParenIndex, file);
        expressions.push(source.slice(openParenIndex + 1, closeParenIndex).trim());
        index = closeParenIndex + 1;
      }
    } else {
      index += 1;
    }
  }

  return expressions;
}

function isRequireIdentifierAt(source, index) {
  if (!source.startsWith('require', index)) {
    return false;
  }
  const previous = source[index - 1];
  const next = source[index + 'require'.length];
  if (isIdentifierCharacter(previous) || isIdentifierCharacter(next)) {
    return false;
  }
  return previousSignificantCharacter(source, index) !== '.';
}

function isIdentifierCharacter(character) {
  return typeof character === 'string' && /[$\w]/.test(character);
}

function previousSignificantCharacter(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) {
    cursor -= 1;
  }
  return source[cursor];
}

function findRequireOpenParen(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }
  return source[cursor] === '(' ? cursor : null;
}

function findCallCloseParen(source, openParenIndex, file) {
  let depth = 1;
  let index = openParenIndex + 1;

  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index, file);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index, file);
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index, file);
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index, file);
    } else if (source[index] === '(') {
      depth += 1;
      index += 1;
    } else if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
      index += 1;
    } else {
      index += 1;
    }
  }

  throw new Error(`Unclosed require(...) in ${file}`);
}

function skipLineComment(source, index) {
  const newlineIndex = source.indexOf('\n', index + 2);
  return newlineIndex === -1 ? source.length : newlineIndex + 1;
}

function skipBlockComment(source, index, file) {
  const closeIndex = source.indexOf('*/', index + 2);
  if (closeIndex === -1) {
    throw new Error(`Unclosed block comment in ${file}`);
  }
  return closeIndex + 2;
}

function skipQuotedString(source, index, file) {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
    } else if (source[cursor] === quote) {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  throw new Error(`Unclosed string literal in ${file}`);
}

function skipTemplateLiteral(source, index, file) {
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
    } else if (source[cursor] === '`') {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  throw new Error(`Unclosed template literal in ${file}`);
}

function startsRegexLiteral(source, index) {
  const previousIndex = previousSignificantIndex(source, index);
  if (previousIndex === -1) {
    return true;
  }

  const previous = source[previousIndex];
  if (/[[({=,:;!&|?+\-*~^<>%]/.test(previous)) {
    return true;
  }

  const token = previousIdentifierToken(source, previousIndex);
  return ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'yield', 'await'].includes(token);
}

function previousSignificantIndex(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) {
    cursor -= 1;
  }
  return cursor;
}

function previousIdentifierToken(source, index) {
  if (!isIdentifierCharacter(source[index])) {
    return '';
  }
  let start = index;
  while (start > 0 && isIdentifierCharacter(source[start - 1])) {
    start -= 1;
  }
  return source.slice(start, index + 1);
}

function skipRegexLiteral(source, index, file) {
  let cursor = index + 1;
  let inCharacterClass = false;

  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\\') {
      cursor += 2;
    } else if (character === '[') {
      inCharacterClass = true;
      cursor += 1;
    } else if (character === ']') {
      inCharacterClass = false;
      cursor += 1;
    } else if (character === '/' && !inCharacterClass) {
      cursor += 1;
      while (cursor < source.length && /[A-Za-z]/.test(source[cursor])) {
        cursor += 1;
      }
      return cursor;
    } else {
      cursor += 1;
    }
  }

  throw new Error(`Unclosed regular expression literal in ${file}`);
}

function staticRequireRequest(expression) {
  const normalizedExpression = stripRequireExpressionComments(expression).trim();
  if (normalizedExpression.startsWith('`')) {
    if (normalizedExpression.includes('${')) {
      return null;
    }
    return literalValue(normalizedExpression, '`');
  }
  if (normalizedExpression.startsWith("'") || normalizedExpression.startsWith('"')) {
    return literalValue(normalizedExpression, normalizedExpression[0]);
  }
  return null;
}

function stripRequireExpressionComments(expression) {
  let output = '';
  let index = 0;

  while (index < expression.length) {
    if (expression.startsWith('//', index)) {
      index = skipLineComment(expression, index);
    } else if (expression.startsWith('/*', index)) {
      const closeIndex = expression.indexOf('*/', index + 2);
      if (closeIndex === -1) {
        throw new Error(`Unclosed block comment in require(...) expression: ${expression}`);
      }
      index = closeIndex + 2;
    } else if (expression[index] === '"' || expression[index] === "'") {
      const endIndex = skipQuotedString(expression, index, 'require(...) expression');
      output += expression.slice(index, endIndex);
      index = endIndex;
    } else if (expression[index] === '`') {
      const endIndex = skipTemplateLiteral(expression, index, 'require(...) expression');
      output += expression.slice(index, endIndex);
      index = endIndex;
    } else {
      output += expression[index];
      index += 1;
    }
  }

  return output;
}

function literalValue(expression, quote) {
  let value = '';
  let index = 1;

  while (index < expression.length) {
    if (expression[index] === '\\') {
      value += expression[index + 1] || '';
      index += 2;
    } else if (expression[index] === quote) {
      return expression.slice(index + 1).trim() === '' ? value : null;
    } else {
      value += expression[index];
      index += 1;
    }
  }

  throw new Error(`Unclosed string literal in require(...) expression: ${expression}`);
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
