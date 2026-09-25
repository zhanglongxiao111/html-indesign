const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
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
  if (item.attributes && item.attributes[HTML_DATA_ID_ATTRIBUTES.LAYER]) token = item.attributes[HTML_DATA_ID_ATTRIBUTES.LAYER];
  else if (item.role === 'text') token = 'text';
  else if (item.role === 'graphic') token = 'graphics';
  else if (item.role === 'table') token = 'tables';
  return mappedLayerName(token, options);
}

// 作者包 config 声明了图层清单（document.sourcePackage.layers，反向导出按原 INDD 的图层写出）时，
// 图层清单就是这份声明加上对象实际用到的图层，不再补建词表里的全部标准图层；
// 没声明图层清单的作者包（正常 HTML 作者包）照旧按词表预建标准图层，供后期编辑使用。
function collectLayers(pages, options, observedLayers = []) {
  const names = new Map();
  const map = configuredLayerNameMap(options);
  const declaresLayers = Array.isArray(observedLayers) && observedLayers.length > 0;
  for (const token of ['background', 'image', 'drawing', 'graphics', 'content', 'overlay', 'tables', 'text', 'annotation', 'annotations']) {
    if (declaresLayers) break;
    if (!map || !Object.prototype.hasOwnProperty.call(map, token) || !map[token]) continue;
    names.set(map[token], names.size);
  }
  for (const layer of Array.isArray(observedLayers) ? observedLayers : []) {
    const name = layer && (layer.name || layer);
    if (name != null && !names.has(String(name))) names.set(String(name), names.size);
  }
  for (const page of pages) {
    for (const item of page.items) {
      if (!names.has(item.layer)) names.set(item.layer, names.size);
    }
  }
  const observedBottomFirstOrder = observedLayerOrder(observedLayers);
  return Array.from(names.keys()).sort((a, b) => {
    const observedA = observedBottomFirstOrder.has(a);
    const observedB = observedBottomFirstOrder.has(b);
    if (observedA && observedB) return observedBottomFirstOrder.get(a) - observedBottomFirstOrder.get(b);
    if (observedA !== observedB) return observedA ? 1 : -1;
    const rankA = layerRank(a);
    const rankB = layerRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return names.get(a) - names.get(b);
  }).map((name, index) => layerInstruction(name, name, index));
}

function observedLayerOrder(observedLayers) {
  const order = new Map();
  const layers = Array.isArray(observedLayers) ? observedLayers : [];
  for (let index = 0; index < layers.length; index++) {
    const name = layers[index] && (layers[index].name || layers[index]);
    if (name == null) continue;
    const key = String(name);
    if (!order.has(key)) order.set(key, layers.length - 1 - index);
  }
  return order;
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
  const map = configuredLayerNameMap(options);
  return map && map[token] ? map[token] : token;
}

function configuredLayerNameMap(options) {
  return (options && options.layerNameMap)
    || (options && options.styleNameMap && options.styleNameMap.layers)
    || null;
}

module.exports = {
  layerForModelItem,
  collectLayers,
  mappedLayerName,
};
