const { addMessage } = require('../../../shared/report');
const { assetSourceFromElementLike } = require('../../../shared/assets');

function collectUnsupportedWarnings(pages, warnings, report) {
  for (const pageInfo of pages) {
    for (const item of pageInfo.items) {
      const unsupported = item.unsupported || {};
      const effects = ['boxShadow', 'filter', 'maskImage'].filter((prop) => unsupported[prop]);
      if (effects.length) {
        const warning = {
          code: 'CSS_EFFECT_UNSUPPORTED',
          message: 'CSS visual effect is captured but not translated to native InDesign output yet.',
          itemId: item.id,
          effects: Object.fromEntries(effects.map((prop) => [prop, unsupported[prop]])),
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      const pseudo = ['beforeContent', 'afterContent', 'markerContent'].filter((prop) => unsupported[prop]);
      if (pseudo.length) {
        const warning = {
          code: 'PSEUDO_CONTENT_UNSUPPORTED',
          message: 'CSS pseudo content is captured but not translated to native InDesign output yet.',
          itemId: item.id,
          content: Object.fromEntries(pseudo.map((prop) => [prop, unsupported[prop]])),
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      if (item.tagName === 'li') {
        const warning = {
          code: 'LIST_MARKER_UNSUPPORTED',
          message: 'HTML list markers are not translated to native InDesign bullets yet.',
          itemId: item.id,
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      if ((item.tagName === 'svg' || item.tagName === 'canvas') && !assetSourceFromElementLike(item).src) {
        const code = item.tagName === 'svg' ? 'INLINE_SVG_UNSUPPORTED' : 'CANVAS_FALLBACK_UNSUPPORTED';
        const warning = {
          code,
          message: `${item.tagName.toUpperCase()} fallback asset generation is not implemented yet.`,
          itemId: item.id,
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
    }
  }
}

module.exports = {
  collectUnsupportedWarnings,
};
