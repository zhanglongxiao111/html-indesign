const { createProtocolLabel } = require('../../shared/labels');

function layerForModelItem(modelItem, options) {
  if (modelItem.layer) {
    return options && options.preserveObservedLayerNames
      ? modelItem.layer
      : mappedLayerName(modelItem.layer, options);
  }
  return layerForItem(modelItem, options);
}

function layerForItem(item, options) {
  let token = 'content';
  if (item.attributes && item.attributes['data-id-layer']) token = item.attributes['data-id-layer'];
  else if (item.role === 'text') token = 'text';
  else if (item.role === 'graphic') token = 'graphics';
  else if (item.role === 'table') token = 'tables';
  return mappedLayerName(token, options);
}

function collectLayers(pages, options) {
  const names = new Map();
  for (const token of ['background', 'image', 'drawing', 'graphics', 'content', 'overlay', 'tables', 'text', 'annotation', 'annotations']) {
    names.set(mappedLayerName(token, options), names.size);
  }
  for (const page of pages) {
    for (const item of page.items) {
      if (!names.has(item.layer)) names.set(item.layer, names.size);
    }
  }
  return Array.from(names.keys()).sort((a, b) => {
    const rankA = layerRank(a);
    const rankB = layerRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return names.get(a) - names.get(b);
  }).map((name, index) => layerInstruction(name, name, index));
}

function layerInstruction(token, displayName, order) {
  return {
    token,
    name: displayName || token,
    order,
    labels: [createProtocolLabel({
      kind: 'layer',
      id: `layer-${token}`,
      source: 'html-to-indesign',
      token,
      displayName: displayName || token,
    })],
  };
}

function layerRank(name) {
  const ranks = {
    background: 0,
    '背景': 0,
    image: 10,
    '图片': 10,
    drawing: 20,
    '图纸': 20,
    graphics: 30,
    '图形': 30,
    content: 40,
    '内容': 40,
    overlay: 50,
    '遮罩': 50,
    tables: 60,
    '表格': 60,
    text: 70,
    '文字': 70,
    annotation: 80,
    '标注': 80,
    annotations: 80,
    '标注组': 80,
  };
  return ranks[name] == null ? 45 : ranks[name];
}

function mappedLayerName(token, options) {
  const map = (options && options.layerNameMap)
    || (options && options.styleNameMap && options.styleNameMap.layers)
    || null;
  return map && map[token] ? map[token] : token;
}

module.exports = {
  layerForModelItem,
  collectLayers,
  mappedLayerName,
};
