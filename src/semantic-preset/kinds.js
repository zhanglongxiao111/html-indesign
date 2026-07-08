'use strict';

const STYLE_NAME_MAP_KINDS = Object.freeze([
  'paragraphStyles',
  'characterStyles',
  'objectStyles',
  'frameStyles',
  'tableStyles',
  'cellStyles',
  'layers',
]);

const TOKEN_LIST_KINDS = Object.freeze([
  'semantic',
  'semanticContainers',
  'assets',
  'fits',
  'crops',
]);

module.exports = {
  STYLE_NAME_MAP_KINDS,
  TOKEN_LIST_KINDS,
};
