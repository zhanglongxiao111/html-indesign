const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileStyles } = require('../../src/writers/indesign');

test('compileStyles creates swatches fonts and named paragraph styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');

  assert.equal(styled.styles.swatches['颜色-18-52-86'].value, '#123456');
  assert.equal(styled.styles.fonts.Arial.family, 'Arial');
  assert.equal(title.styleRefs.paragraphStyle, 'report-title');
  assert.equal(styled.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(styled.styles.paragraphStyles['report-title'].leading, 34);
  assert.equal(styled.styles.paragraphStyles['report-title'].fillColor, '颜色-18-52-86');
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
  assert.equal(styled.styles.characterStyles.accent.fillColor, '颜色-200-16-46');
  assert.equal(styled.styles.characterStyles.accent.tracking, 33.3333);
  assert.equal(card.styleRefs.objectStyle, 'metric-card');
  assert.equal(styled.styles.objectStyles['metric-card'].fillColor, '颜色-242-242-242');
  assert.equal(styled.styles.objectStyles['metric-card'].strokeColor, '颜色-51-51-51');
  assert.equal(styled.styles.objectStyles['metric-card'].strokeWeight, 2);
  assert.equal(image.styleRefs.frameStyle, 'hero-image-frame');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].fit, 'cover');
  assert.equal(styled.styles.frameStyles['hero-image-frame'].position, '0% 0%');
});

test('compileStyles maps CSS character typography into InDesign character style fields', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'title',
        role: 'text',
        tagName: 'p',
        classList: [],
        attributes: { 'data-id-paragraph-style': 'body' },
        text: 'H2O link',
        boundsMm: { x: 0, y: 0, width: 60, height: 10 },
        computedStyle: {
          color: 'rgb(0, 0, 0)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '10pt',
          lineHeight: '12pt',
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'left',
        },
        runs: [{
          text: '2',
          tagName: 'sup',
          classList: [],
          attributes: { 'data-id-character-style': 'sup-run' },
          computedStyle: {
            color: 'rgb(0, 0, 0)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '10pt',
            fontWeight: '400',
            fontStyle: 'normal',
            letterSpacing: '1pt',
            verticalAlign: 'super',
            textDecorationLine: 'underline',
          },
        }],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const style = styled.styles.characterStyles['sup-run'];

  assert.equal(style.tracking, 100);
  assert.equal(style.verticalPosition, 'super');
  assert.equal(style.textDecoration, 'underline');
});

test('compileStyles maps CSS text-transform into native text style semantics', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'eyebrow',
        role: 'text',
        tagName: 'p',
        classList: [],
        attributes: { 'data-id-paragraph-style': 'eyebrow' },
        text: 'section one',
        boundsMm: { x: 0, y: 0, width: 60, height: 10 },
        computedStyle: {
          color: 'rgb(200, 16, 46)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '10pt',
          lineHeight: '12pt',
          fontWeight: '700',
          fontStyle: 'normal',
          textAlign: 'left',
          textTransform: 'uppercase',
        },
        runs: [],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);

  assert.equal(styled.styles.paragraphStyles.eyebrow.capitalization, 'allCaps');
});

test('compileStyles keeps fill alpha separate from object opacity', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const metricCard = styled.styles.objectStyles['metric-card'];

  assert.equal(metricCard.fillColor, '颜色-251-250-247');
  assert.equal(metricCard.fillOpacity, 0.92);
  assert.equal(metricCard.opacity, 1);
  assert.equal(metricCard.strokeAlignment, 'inside');
});

test('compileStyles selects CJK fonts and InDesign font style names for Chinese text', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot);
  const coverTitle = styled.styles.paragraphStyles['cover-title'];
  const coverAccent = styled.styles.characterStyles['cover-accent'];
  const eyebrow = styled.styles.paragraphStyles['deck-eyebrow'];

  assert.equal(coverTitle.appliedFont, 'Microsoft YaHei');
  assert.equal(coverTitle.fontStyleName, 'Bold');
  assert.equal(coverAccent.appliedFont, 'Microsoft YaHei');
  assert.equal(coverAccent.fontStyleName, 'Bold Italic');
  assert.equal(eyebrow.appliedFont, 'Arial');
  assert.equal(styled.styles.fonts['Microsoft YaHei'].family, 'Microsoft YaHei');
});

test('compileStyles can use human readable Chinese style names from HTML attributes', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      items: [{
        id: 'title',
        role: 'text',
        tagName: 'h1',
        classList: [],
        attributes: {
          'data-id-paragraph-style': 'page-title',
          'data-id-paragraph-style-name': '页面标题',
        },
        text: '标题',
        computedStyle: {
          color: 'rgb(18, 52, 86)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '32px',
          lineHeight: '40px',
          fontWeight: '700',
          fontStyle: 'normal',
          textAlign: 'left',
        },
        runs: [],
      }],
    }],
  };

  const styled = compileStyles(snapshot);
  const title = styled.pages[0].items[0];

  assert.equal(title.styleRefs.paragraphStyle, '页面标题');
  assert.ok(styled.styles.paragraphStyles['页面标题']);
  assert.equal(styled.styles.paragraphStyles['page-title'], undefined);
});

test('compileStyles splits reused paragraph style names when computed signatures differ', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      items: [
        {
          id: 'date',
          role: 'text',
          tagName: 'p',
          classList: ['observed-text'],
          attributes: { 'data-id-paragraph-style': '标准正文（18点左对齐）' },
          text: '2026年1月26日\n区委专题会',
          computedStyle: {
            color: 'rgb(102, 102, 102)',
            fontFamily: '微软雅黑, Arial, sans-serif',
            fontSize: '18px',
            lineHeight: '22px',
            fontWeight: '400',
            fontStyle: 'normal',
            textAlign: 'right',
            marginTop: '0px',
            marginBottom: '28.3465px',
          },
          runs: [],
        },
        {
          id: 'title',
          role: 'text',
          tagName: 'p',
          classList: ['observed-text'],
          attributes: { 'data-id-paragraph-style': '标准正文（18点左对齐）' },
          text: '1-建筑方案更新',
          computedStyle: {
            color: 'rgb(0, 0, 0)',
            fontFamily: '微软雅黑, Arial, sans-serif',
            fontSize: '48px',
            lineHeight: '60px',
            fontWeight: '700',
            fontStyle: 'normal',
            textAlign: 'left',
            marginTop: '0px',
            marginBottom: '0px',
          },
          runs: [],
        },
      ],
    }],
  };

  const styled = compileStyles(snapshot, { layout: { unitMode: 'presentation' } });
  const date = styled.pages[0].items.find((item) => item.id === 'date');
  const title = styled.pages[0].items.find((item) => item.id === 'title');

  assert.equal(date.styleRefs.paragraphStyle, '标准正文-18点左对齐');
  assert.notEqual(title.styleRefs.paragraphStyle, date.styleRefs.paragraphStyle);
  assert.equal(styled.styles.paragraphStyles[date.styleRefs.paragraphStyle].pointSize, 18);
  assert.equal(styled.styles.paragraphStyles[title.styleRefs.paragraphStyle].pointSize, 48);
  assert.equal(styled.report.messages.some((message) => message.code === 'STYLE_NAME_CONFLICT'), true);
});

test('compileStyles can translate stable style tokens through a styleNameMap', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      items: [{
        id: 'card',
        role: 'shape',
        tagName: 'div',
        classList: ['metric-card'],
        attributes: {
          'data-id-object-style': 'metric-card',
        },
        text: '',
        computedStyle: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgb(0, 0, 0)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderRadius: '4px',
          opacity: '1',
          overflow: 'visible',
        },
        authoredStyle: {
          borderTopWidth: '1pt',
        },
      }],
    }],
  };

  const styled = compileStyles(snapshot, {
    styleNameMap: {
      objectStyles: {
        'metric-card': '指标卡片',
      },
    },
  });

  const card = styled.pages[0].items[0];
  assert.equal(card.styleRefs.objectStyle, '指标卡片');
  assert.ok(styled.styles.objectStyles['指标卡片']);
  assert.deepEqual(styled.styles.objectStyles['指标卡片'].labels[0], {
    protocol: 'html-indesign',
    version: 1,
    kind: 'style',
    id: 'metric-card',
    source: 'html-to-indesign',
    styleKind: 'objectStyles',
    token: 'metric-card',
    displayName: '指标卡片',
  });
});

test('compileStyles does not infer paragraph styles from object style classes', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 56.25,
      items: [{
        id: 'empty-frame',
        role: 'text',
        tagName: 'p',
        classList: ['ostyle--基本图形框架-', 'observed-text', 'id-object'],
        attributes: {
          'data-id-object-style': '[基本图形框架]',
        },
        text: '',
        computedStyle: {
          color: 'rgb(0, 0, 0)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '16px',
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'left',
          borderTopColor: 'rgb(255, 10, 13)',
          borderTopWidth: '2px',
          borderTopStyle: 'solid',
        },
        authoredStyle: {
          borderTopWidth: '2pt',
        },
      }],
    }],
  };

  const styled = compileStyles(snapshot);
  const item = styled.pages[0].items[0];

  assert.match(item.styleRefs.paragraphStyle, /^自动段落-\d{8}$/);
  assert.equal(item.styleRefs.objectStyle, '基本图形框架');
  assert.equal(styled.styles.paragraphStyles['ostyle-基本图形框架'], undefined);
});

test('compileStyles maps visual CSS pixels to points in presentation mode', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styled = compileStyles(snapshot, {
    layout: {
      unitMode: 'presentation',
      scale: 2,
      targetUnit: 'pt',
    },
  });
  const metricCard = styled.styles.objectStyles['metric-card'];
  const coverTitle = styled.styles.paragraphStyles['cover-title'];

  assert.equal(metricCard.strokeWeight, 2);
  assert.equal(metricCard.cornerRadius, '8pt');
  assert.equal(coverTitle.pointSize, 90.6666);
});

test('compileStyles warns instead of compiling multi-color gradients as opacity feathers', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'color-gradient',
        role: 'shape',
        tagName: 'div',
        classList: ['color-gradient'],
        attributes: { 'data-id-object': '' },
        text: '',
        boundsMm: { x: 0, y: 0, width: 50, height: 20 },
        computedStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0)',
          backgroundImage: 'linear-gradient(90deg, rgb(255, 0, 0), rgb(0, 0, 255))',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
        },
        authoredStyle: {},
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const item = styled.pages[0].items[0];

  assert.equal(item.effects, null);
  assert.equal(styled.styles.objectStyles['color-gradient'].fillColor, null);
  assert.equal(styled.report.messages.some((message) => message.code === 'GRADIENT_COLOR_UNSUPPORTED'), true);
});

test('compileStyles preserves per-edge table cell border styles', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'table',
        role: 'table',
        tagName: 'table',
        classList: ['native-table'],
        attributes: { 'data-id-table-style': 'native-table' },
        text: 'A',
        boundsMm: { x: 0, y: 0, width: 50, height: 20 },
        computedStyle: {},
        authoredStyle: {},
        table: [{
          index: 0,
          header: false,
          cells: [{
            index: 0,
            text: 'A',
            tagName: 'td',
            header: false,
            rowSpan: 1,
            colSpan: 1,
            classList: [],
            attributes: {},
            boundsMm: { x: 0, y: 0, width: 50, height: 20 },
            computedStyle: {
              color: 'rgb(0, 0, 0)',
              fontSize: '8pt',
              lineHeight: '10pt',
              textAlign: 'left',
              backgroundColor: 'rgb(255, 255, 255)',
              borderTopColor: 'rgb(18, 52, 86)',
              borderTopWidth: '1pt',
              borderTopStyle: 'solid',
              borderRightColor: 'rgb(200, 16, 46)',
              borderRightWidth: '2pt',
              borderRightStyle: 'solid',
              borderBottomColor: 'rgb(245, 200, 80)',
              borderBottomWidth: '3pt',
              borderBottomStyle: 'solid',
              borderLeftColor: 'rgb(100, 140, 150)',
              borderLeftWidth: '4pt',
              borderLeftStyle: 'solid',
              paddingTop: '0px',
              paddingRight: '0px',
              paddingBottom: '0px',
              paddingLeft: '0px',
            },
            authoredStyle: {},
          }],
        }],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const cell = styled.pages[0].items[0].content.rows[0].cells[0];

  assert.equal(cell.borders.top.color, '颜色-18-52-86');
  assert.equal(cell.borders.right.color, '颜色-200-16-46');
  assert.equal(cell.borders.bottom.borderWeight, 3);
  assert.equal(cell.borders.left.borderWeight, 4);
});

test('compileStyles preserves table cell fill opacity and inline character runs', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'table',
        role: 'table',
        tagName: 'table',
        classList: ['native-table'],
        attributes: { 'data-id-table-style': 'native-table' },
        text: 'Net +12%',
        boundsMm: { x: 0, y: 0, width: 50, height: 20 },
        computedStyle: {},
        authoredStyle: {},
        table: [{
          index: 0,
          header: false,
          cells: [{
            index: 0,
            text: 'Net +12%',
            tagName: 'td',
            header: false,
            rowSpan: 1,
            colSpan: 1,
            classList: [],
            attributes: {},
            boundsMm: { x: 0, y: 0, width: 50, height: 20 },
            computedStyle: {
              color: 'rgb(0, 0, 0)',
              fontFamily: 'Arial, sans-serif',
              fontSize: '8pt',
              lineHeight: '10pt',
              textAlign: 'left',
              backgroundColor: 'rgba(200, 16, 46, 0.35)',
              borderTopColor: 'rgb(18, 52, 86)',
              borderTopWidth: '1pt',
              borderTopStyle: 'solid',
              paddingTop: '0px',
              paddingRight: '0px',
              paddingBottom: '0px',
              paddingLeft: '0px',
            },
            authoredStyle: {},
            runs: [{
              text: '+12%',
              tagName: 'span',
              classList: [],
              attributes: { 'data-id-character-style': 'metric-delta' },
              computedStyle: {
                color: 'rgb(200, 16, 46)',
                fontFamily: 'Arial, sans-serif',
                fontSize: '8pt',
                fontWeight: '700',
                fontStyle: 'normal',
              },
            }],
          }],
        }],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const cell = styled.pages[0].items[0].content.rows[0].cells[0];

  assert.equal(cell.fillOpacity, 0.35);
  assert.deepEqual(cell.runs, [
    { text: 'Net ', characterStyle: null },
    { text: '+12%', characterStyle: 'metric-delta' },
  ]);
  assert.equal(styled.styles.characterStyles['metric-delta'].fillColor, '颜色-200-16-46');
});

test('compileStyles warns for border styles that decoration strips cannot preserve exactly', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'dashed-card',
        role: 'shape',
        tagName: 'div',
        classList: ['dashed-card'],
        attributes: { 'data-id-object': '' },
        text: '',
        boundsMm: { x: 0, y: 0, width: 50, height: 20 },
        computedStyle: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRightColor: 'rgba(0, 0, 0, 0)',
          borderRightWidth: '0px',
          borderRightStyle: 'none',
          borderBottomColor: 'rgba(0, 0, 0, 0)',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          borderLeftColor: 'rgb(18, 52, 86)',
          borderLeftWidth: '3pt',
          borderLeftStyle: 'dashed',
          borderRadius: '6px',
          opacity: '1',
          overflow: 'visible',
        },
        authoredStyle: {},
      }, {
        id: 'table',
        role: 'table',
        tagName: 'table',
        classList: ['native-table'],
        attributes: { 'data-id-table-style': 'native-table' },
        text: 'A',
        boundsMm: { x: 0, y: 25, width: 50, height: 20 },
        computedStyle: {},
        authoredStyle: {},
        table: [{
          index: 0,
          header: false,
          cells: [{
            index: 0,
            text: 'A',
            tagName: 'td',
            header: false,
            rowSpan: 1,
            colSpan: 1,
            classList: [],
            attributes: {},
            boundsMm: { x: 0, y: 25, width: 50, height: 20 },
            computedStyle: {
              color: 'rgb(0, 0, 0)',
              fontSize: '8pt',
              lineHeight: '10pt',
              textAlign: 'left',
              backgroundColor: 'rgb(255, 255, 255)',
              borderTopColor: 'rgb(18, 52, 86)',
              borderTopWidth: '1pt',
              borderTopStyle: 'dotted',
              paddingTop: '0px',
              paddingRight: '0px',
              paddingBottom: '0px',
              paddingLeft: '0px',
            },
            authoredStyle: {},
          }],
        }],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const codes = styled.report.messages.map((message) => message.code);

  assert.equal(codes.includes('BORDER_DECORATION_LIMITED'), true);
  assert.equal(codes.includes('TABLE_CELL_BORDER_STYLE_UNSUPPORTED'), true);
});
