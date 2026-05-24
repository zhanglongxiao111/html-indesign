const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileStyles } = require('../../src/paged-html');

test('compileStyles creates swatches fonts and named paragraph styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');

  assert.equal(styled.styles.swatches['color-123456'].value, '#123456');
  assert.equal(styled.styles.fonts.Arial.family, 'Arial');
  assert.equal(title.styleRefs.paragraphStyle, 'report-title');
  assert.equal(styled.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(styled.styles.paragraphStyles['report-title'].leading, 34);
  assert.equal(styled.styles.paragraphStyles['report-title'].fillColor, 'color-123456');
  assert.equal(styled.styles.paragraphStyles['report-title'].justification, 'center');
});

test('compileStyles creates character object and frame styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const card = styled.pages[0].items.find((item) => item.attributes['data-id-object-style'] === 'metric-card');
  const image = styled.pages[0].items.find((item) => item.attributes['data-id-frame-style'] === 'hero-image-frame');
  const accentRun = title.content.runs.find((run) => run.text === '重点');

  assert.equal(accentRun.characterStyle, 'accent');
  assert.equal(styled.styles.characterStyles.accent.fillColor, 'color-c8102e');
  assert.equal(card.styleRefs.objectStyle, 'metric-card');
  assert.equal(styled.styles.objectStyles['metric-card'].fillColor, 'color-f2f2f2');
  assert.equal(styled.styles.objectStyles['metric-card'].strokeColor, 'color-333333');
  assert.equal(image.styleRefs.frameStyle, 'hero-image-frame');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].fit, 'cover');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].position, '0% 0%');
});
