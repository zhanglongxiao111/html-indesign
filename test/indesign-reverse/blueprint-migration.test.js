const test = require('node:test');
const assert = require('node:assert/strict');
const {
  blueprintMigrationToSemanticModel,
  semanticModelToHtml,
} = require('../../src/indesign-reverse');

function sampleBlueprint() {
  return {
    metadata: {
      documentName: '旧模板.indd',
      exportedAt: '2026-05-25T00:00:00Z',
    },
    paragraphStyles: {
      '页面标题': {
        name: '页面标题',
        safeName: '页面标题',
        css: "font-family:'微软雅黑',sans-serif; font-size:24pt; color:#123456",
      },
    },
    objectStyles: {
      '强调图框': {
        name: '强调图框',
        safeName: '强调图框',
        css: 'border:2pt solid #c8102e; background-color:#fbfaf7',
      },
    },
    masters: {
      'A-封面': {
        width: 528,
        height: 297,
        slots: {
          '名称：项目中文名\r\n类型：文本\r\n说明：根据实际项目名称填写': {
            id: 'slot-title',
            zIndex: 3,
            label: '名称：项目中文名\r\n类型：文本\r\n说明：根据实际项目名称填写',
            appliedObjectStyle: '强调图框',
            appliedParagraphStyle: '页面标题',
            type: 'TEXT',
            bounds: { x: 15, y: 20, width: 180, height: 24 },
            content: '项目中文名称',
            inlineCSS: 'text-align:right',
          },
          '名称：背景图片\r\n类型：图像\r\n说明：支持图片或PDF置入': {
            id: 'slot-image',
            zIndex: 1,
            label: '名称：背景图片\r\n类型：图像\r\n说明：支持图片或PDF置入',
            appliedObjectStyle: '强调图框',
            type: 'IMAGE',
            bounds: { x: 0, y: 0, width: 528, height: 297 },
            imagePath: 'D:\\assets\\cover.pdf',
            imageCropped: true,
          },
        },
        staticItems: [
          {
            id: 'decor-line',
            zIndex: 2,
            appliedObjectStyle: '强调图框',
            type: 'LINE',
            bounds: { x: 15, y: 50, width: 498, height: 0 },
            inlineCSS: 'background-color:#c8102e; height:0.5pt',
          },
        ],
      },
    },
  };
}

test('blueprintMigrationToSemanticModel imports historical blueprint as inferred reverse model', () => {
  const model = blueprintMigrationToSemanticModel(sampleBlueprint(), { mode: 'inferred' });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.id, '旧模板');
  assert.equal(model.reverseMode, 'inferred');
  assert.equal(model.coordinateUnit, 'mm');
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].id, 'A-封面');
  assert.equal(model.pages[0].layout, 'blueprint-migration');
  assert.equal(model.pages[0].items.length, 3);
  assert.equal(model.styles.paragraphStyles['页面标题'].css.includes('font-size:24pt'), true);

  const title = model.pages[0].items.find((item) => item.id === 'slot-title');
  assert.equal(title.role, 'text');
  assert.equal(title.semantic, '项目中文名');
  assert.equal(title.htmlClass.includes('migration-slot'), true);
  assert.equal(title.migration.isSlot, true);
  assert.equal(title.migration.slotName, '项目中文名');
  assert.equal(title.migration.slotType, 'TEXT');
  assert.equal(title.migration.confidence, 0.85);
  assert.equal(title.migration.source, 'blueprint-migration');
  assert.match(title.inlineStyle, /font-size:24pt/);
  assert.match(title.inlineStyle, /border:2pt solid #c8102e/);

  const image = model.pages[0].items.find((item) => item.id === 'slot-image');
  assert.equal(image.role, 'graphic');
  assert.equal(image.asset.path, 'D:\\assets\\cover.pdf');
  assert.equal(image.asset.cropped, true);
});

test('semanticModelToHtml writes inferred migration metadata, slot names, assets and visual CSS', () => {
  const model = blueprintMigrationToSemanticModel(sampleBlueprint(), { mode: 'inferred' });
  const html = semanticModelToHtml(model);

  assert.match(html, /data-id-reverse-mode="inferred"/);
  assert.match(html, /data-id-source="blueprint-migration"/);
  assert.match(html, /data-id-migration-slot="true"/);
  assert.match(html, /data-id-slot-name="项目中文名"/);
  assert.match(html, /data-id-confidence="0\.85"/);
  assert.match(html, /data-id-asset-path="D:\\assets\\cover\.pdf"/);
  assert.match(html, /data-id-image-cropped="true"/);
  assert.match(html, /border:2px solid #c8102e/);
  assert.match(html, /font-size:24px/);
  assert.doesNotMatch(html, /(?:border|font-size):[0-9.]+pt/);
  assert.match(html, /项目中文名称/);
});
