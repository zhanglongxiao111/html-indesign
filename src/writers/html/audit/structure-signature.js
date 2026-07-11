const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { collapseWhitespace } = require('../../../shared/text');
const { resourceReferenceIdentity } = require('../../../shared/assets');

const STRUCTURE_TAGS = 'section,figure,figcaption,p,h1,h2,h3,h4,h5,h6,ul,ol,li,table,thead,tbody,tr,td,th,img,object,svg';

function authorPackageStructureSignature(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const pages = (config.pages || []).map((page) => {
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    return {
      id: page.id || page.file,
      nodes: pageStructureNodes($, packageRoot),
    };
  });
  return {
    kind: 'AuthorStructureSignature',
    pages,
    summary: {
      pages: pages.length,
      nodes: pages.reduce((sum, page) => sum + page.nodes.length, 0),
    },
  };
}

function compareStructureSignatures(expected, actual) {
  const errors = [];
  const warnings = [];
  validateStructureSignatureInput(expected, 'expected', errors);
  validateStructureSignatureInput(actual, 'actual', errors);
  const expectedPages = signaturePages(expected);
  const actualPages = new Map(signaturePages(actual).map((page) => [page.id, page]));
  for (const expectedPage of expectedPages) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'STRUCTURE_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    if ((expectedPage.nodes || []).length === 0 && (actualPage.nodes || []).length === 0) {
      warnings.push({
        code: 'STRUCTURE_PAGE_NODES_EMPTY',
        pageId: expectedPage.id,
        message: 'Both sides produced zero structure nodes for this page; nothing was actually compared.',
      });
    }
    comparePageNodes(expectedPage, actualPage, errors, warnings);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    expected: expected && expected.summary || null,
    actual: actual && actual.summary || null,
  };
}

function validateStructureSignatureInput(signature, side, errors) {
  if (!signature || !Array.isArray(signature.pages)) {
    errors.push({
      code: 'STRUCTURE_SIGNATURE_INPUT_INVALID',
      side,
      reason: 'pages must be a non-empty array',
    });
    return;
  }
  if (signature.pages.length === 0) {
    errors.push({
      code: 'STRUCTURE_SIGNATURE_INPUT_INVALID',
      side,
      reason: 'pages must not be empty',
    });
  }
}

function signaturePages(signature) {
  return signature && Array.isArray(signature.pages) ? signature.pages : [];
}

function comparePageNodes(expectedPage, actualPage, errors, warnings) {
  const actualByKey = new Map((actualPage.nodes || []).map((node) => [node.key, node]));
  const matchedKeys = new Set();
  for (const expectedNode of expectedPage.nodes || []) {
    const actualNode = actualByKey.get(expectedNode.key);
    if (!actualNode) {
      errors.push({ code: 'STRUCTURE_NODE_MISSING', pageId: expectedPage.id, node: expectedNode });
      continue;
    }
    matchedKeys.add(expectedNode.key);
    if (expectedNode.tag !== actualNode.tag) {
      errors.push({
        code: 'STRUCTURE_NODE_TAG_CHANGED',
        pageId: expectedPage.id,
        key: expectedNode.key,
        expected: expectedNode.tag,
        actual: actualNode.tag,
      });
    }
    if (expectedNode.parentKey !== actualNode.parentKey) {
      errors.push({
        code: 'STRUCTURE_NODE_PARENT_CHANGED',
        pageId: expectedPage.id,
        key: expectedNode.key,
        expected: expectedNode.parentKey,
        actual: actualNode.parentKey,
      });
    }
    if (expectedNode.order !== actualNode.order) {
      errors.push({
        code: 'STRUCTURE_NODE_ORDER_CHANGED',
        pageId: expectedPage.id,
        key: expectedNode.key,
        expected: expectedNode.order,
        actual: actualNode.order,
      });
    }
    compareNodeClasses(expectedPage.id, expectedNode, actualNode, errors, warnings);
    if (canonicalNodeText(expectedNode.text) !== canonicalNodeText(actualNode.text)) {
      errors.push({
        code: 'STRUCTURE_NODE_TEXT_CHANGED',
        pageId: expectedPage.id,
        key: expectedNode.key,
        expected: expectedNode.text,
        actual: actualNode.text,
      });
    }
    if (!sameNodeResource(expectedNode, actualNode)) {
      errors.push({
        code: 'STRUCTURE_NODE_RESOURCE_CHANGED',
        pageId: expectedPage.id,
        key: expectedNode.key,
        expected: expectedNode.resource || null,
        actual: actualNode.resource || null,
      });
    }
  }
  const extraNodes = (actualPage.nodes || []).filter((node) => !matchedKeys.has(node.key));
  if (extraNodes.length) {
    warnings.push({
      code: 'STRUCTURE_NODE_EXTRA',
      pageId: expectedPage.id,
      extra: extraNodes.map((node) => ({ key: node.key, tag: node.tag, parentKey: node.parentKey })),
    });
  }
}

function compareNodeClasses(pageId, expectedNode, actualNode, errors, warnings) {
  const expectedClasses = new Set(expectedNode.classList || []);
  const actualClasses = new Set(actualNode.classList || []);
  const removed = [...expectedClasses].filter((name) => !actualClasses.has(name));
  const added = [...actualClasses].filter((name) => !expectedClasses.has(name));
  if (removed.length) {
    errors.push({
      code: 'STRUCTURE_NODE_CLASS_REMOVED',
      pageId,
      key: expectedNode.key,
      removed,
    });
  }
  if (added.length) {
    warnings.push({
      code: 'STRUCTURE_NODE_CLASS_ADDED',
      pageId,
      key: expectedNode.key,
      added,
    });
  }
}

function canonicalNodeText(value) {
  return collapseWhitespace(String(value || ''));
}

function sameNodeResource(expectedNode, actualNode) {
  const left = String(expectedNode.resource || '');
  const right = String(actualNode.resource || '');
  if (left === right) return true;
  if (!left || !right) return false;
  const leftIdentity = expectedNode.resourceIdentity || `path:${left.replace(/\\/g, '/')}`;
  const rightIdentity = actualNode.resourceIdentity || `path:${right.replace(/\\/g, '/')}`;
  if (leftIdentity === rightIdentity) return true;
  if (isDerivedPreviewReference(left) && isDerivedPreviewReference(right)
      && !leftIdentity.startsWith('sha256:') && !rightIdentity.startsWith('sha256:')) return true;
  return false;
}

function isDerivedPreviewReference(value) {
  return /(?:^|[\\/])previews[\\/]/i.test(String(value || ''));
}

function pageStructureNodes($, packageRoot) {
  const structureElements = $(STRUCTURE_TAGS).toArray()
    .filter((element) => !isIgnoredStructureElement($, element));
  const orderByParent = structureOrderByParent($, structureElements);
  const nodes = [];
  for (const element of structureElements) {
    const node = $(element);
    const key = nodeKey($, element);
    const resource = node.attr('src') || node.attr('data') || null;
    nodes.push({
      key,
      id: node.attr('id') || null,
      tag: tagName(element),
      classList: classList(node.attr('class')),
      parentKey: parentStructureKey($, element),
      order: orderByParent.get(element) || 0,
      text: collapseWhitespace(node.children().length ? '' : node.text()),
      resource,
      resourceIdentity: resourceReferenceIdentity(resource, { sourceRoot: packageRoot }),
    });
  }
  return nodes;
}

function nodeKey($, element) {
  const node = $(element);
  const id = node.attr('id');
  if (id) return `id:${id}`;
  return `path:${structurePath(element)}`;
}

function parentStructureKey($, element) {
  const parents = $(element).parents(STRUCTURE_TAGS).toArray();
  const parent = parents.find((candidate) => !isIgnoredStructureElement($, candidate));
  if (!parent) return 'page-root';
  return nodeKey($, parent);
}

function structureOrderByParent($, elements) {
  const counters = new Map();
  const orderByElement = new Map();
  for (const element of elements) {
    const parentKey = parentStructureKey($, element);
    const next = (counters.get(parentKey) || 0) + 1;
    counters.set(parentKey, next);
    orderByElement.set(element, next);
  }
  return orderByElement;
}

function structurePath(element) {
  const parts = [];
  let current = element;
  while (current && current.type === 'tag') {
    const parent = current.parent;
    const siblings = parent && parent.children
      ? parent.children.filter((child) => child.type === 'tag' && tagName(child) === tagName(current))
      : [];
    parts.unshift(`${tagName(current)}:nth-${siblings.indexOf(current) + 1}`);
    current = parent;
  }
  return parts.join('/');
}

function tagName(element) {
  return String(element && (element.tagName || element.name) || '').toLowerCase();
}

function classList(value) {
  return String(value || '').split(/\s+/).map((item) => item.trim()).filter(Boolean).sort();
}

function isIgnoredStructureElement($, element) {
  return $(element).attr(HTML_DATA_ID_ATTRIBUTES.IGNORE) != null;
}

module.exports = {
  authorPackageStructureSignature,
  compareStructureSignatures,
};
