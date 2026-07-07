const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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
      nodes: pageStructureNodes($),
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
  const actualPages = new Map((actual.pages || []).map((page) => [page.id, page]));
  for (const expectedPage of expected.pages || []) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'STRUCTURE_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    comparePageNodes(expectedPage, actualPage, errors);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    expected: expected.summary,
    actual: actual.summary,
  };
}

function comparePageNodes(expectedPage, actualPage, errors) {
  const actualByKey = new Map((actualPage.nodes || []).map((node) => [node.key, node]));
  for (const expectedNode of expectedPage.nodes || []) {
    const actualNode = actualByKey.get(expectedNode.key);
    if (!actualNode) {
      errors.push({ code: 'STRUCTURE_NODE_MISSING', pageId: expectedPage.id, node: expectedNode });
      continue;
    }
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
  }
}

function pageStructureNodes($) {
  const structureElements = $(STRUCTURE_TAGS).toArray()
    .filter((element) => !isIgnoredStructureElement($, element));
  const orderByParent = structureOrderByParent($, structureElements);
  const nodes = [];
  for (const element of structureElements) {
    const node = $(element);
    const key = nodeKey($, element);
    nodes.push({
      key,
      id: node.attr('id') || null,
      tag: tagName(element),
      classList: classList(node.attr('class')),
      parentKey: parentStructureKey($, element),
      order: orderByParent.get(element) || 0,
      text: normalizeText(node.children().length ? '' : node.text()),
      resource: node.attr('src') || node.attr('data') || null,
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
  return $(element).attr('data-id-ignore') != null;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  authorPackageStructureSignature,
  compareStructureSignatures,
};
