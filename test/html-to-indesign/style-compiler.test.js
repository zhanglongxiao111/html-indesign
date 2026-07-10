const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileStyles } = require('../../src/writers/indesign');

test('compileStyles creates swatches fonts and named paragraph styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/style-deck.html');
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
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/style-deck.html');
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

test('compileStyles keeps explicit object style names stable when only overflow differs', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [
        {
          id: 'clipped',
          role: 'shape',
          tagName: 'svg',
          classList: ['id-object'],
          attributes: {
            'data-id-object-style': '[无]',
            'data-id-object-style-name': '无-59786243',
          },
          computedStyle: { overflow: 'hidden' },
          text: '',
        },
        {
          id: 'visible',
          role: 'shape',
          tagName: 'svg',
          classList: ['id-object'],
          attributes: {
            'data-id-object-style': '[无]',
            'data-id-object-style-name': '无-59786243',
          },
          computedStyle: { overflow: 'visible' },
          text: '',
        },
      ],
    }],
  };

  const styled = compileStyles(snapshot);
  const items = styled.pages[0].items;

  assert.equal(items[0].styleRefs.objectStyle, '无-59786243');
  assert.equal(items[1].styleRefs.objectStyle, '无-59786243');
  assert.equal(Boolean(styled.styles.objectStyles['无-59786243-38812455']), false);
  assert.equal(styled.report.messages.some((message) => message.code === 'STYLE_NAME_CONFLICT'), false);
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

test('compileStyles maps non-normal CSS mix-blend-mode into object styles', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'blend-card',
        role: 'shape',
        tagName: 'div',
        classList: ['blend-card'],
        attributes: { 'data-id-object': '', 'data-id-object-style': 'blend-card' },
        text: '',
        boundsMm: { x: 10, y: 10, width: 30, height: 20 },
        computedStyle: {
          backgroundColor: 'rgb(200, 16, 46)',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRightColor: 'rgba(0, 0, 0, 0)',
          borderRightWidth: '0px',
          borderRightStyle: 'none',
          borderBottomColor: 'rgba(0, 0, 0, 0)',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          borderLeftColor: 'rgba(0, 0, 0, 0)',
          borderLeftWidth: '0px',
          borderLeftStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
          mixBlendMode: 'multiply',
        },
        authoredStyle: {},
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);

  assert.equal(styled.styles.objectStyles['blend-card'].blendMode, 'multiply');
});

test('compileStyles preserves observed subpixel stroke weight and center alignment in presentation mode', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 800,
      heightMm: 450,
      items: [{
        id: 'fine-caption',
        role: 'text',
        tagName: 'p',
        classList: ['observed-text', 'id-object'],
        attributes: {
          'data-id-object-style': '[基本文本框架]',
          'data-id-object-style-name': '[基本文本框架]',
          'data-id-stroke-color': '#ffffff',
          'data-id-stroke-weight': '0.2834645669',
          'data-id-stroke-style': '实底',
          'data-id-stroke-alignment': 'center',
        },
        text: '建筑的鸟瞰图',
        computedStyle: {
          color: 'rgb(102, 102, 102)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          lineHeight: '24px',
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'right',
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgb(255, 255, 255)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderRightColor: 'rgb(255, 255, 255)',
          borderRightWidth: '1px',
          borderRightStyle: 'solid',
          borderBottomColor: 'rgb(255, 255, 255)',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderLeftColor: 'rgb(255, 255, 255)',
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          opacity: '0.6',
          borderRadius: '0px',
        },
        authoredStyle: {
          borderTopWidth: '0.2835px',
          borderRightWidth: '0.2835px',
          borderBottomWidth: '0.2835px',
          borderLeftWidth: '0.2835px',
        },
        runs: [],
      }],
    }],
  };

  const styled = compileStyles(snapshot, { layout: { unitMode: 'presentation', scale: 1, targetUnit: 'pt' } });
  const item = styled.pages[0].items[0];
  const objectStyle = styled.styles.objectStyles[item.styleRefs.objectStyle];

  assert.equal(objectStyle.strokeColor, '颜色-255-255-255');
  assert.equal(objectStyle.strokeWeight, 0.2835);
  assert.equal(objectStyle.strokeStyle, '实底');
  assert.equal(objectStyle.strokeAlignment, 'center');
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
  assert.equal(coverTitle.pointSize, 90.6667);
});

test('compileStyles keeps declared paragraph style identity and emits item text overrides', () => {
  const declaredRule = {
    fontFamily: "'右上角标题',sans-serif",
    fontSize: '24px',
    lineHeight: '24px',
    textAlign: 'right',
    color: '#666666',
  };
  const textItem = (id, computedStyle) => ({
    id,
    role: 'text',
    tagName: 'p',
    classList: ['pstyle-右上角标题-24点右对齐'],
    attributes: { 'data-id-paragraph-style': '右上角标题-24点右对齐' },
    text: '底图示意',
    boundsMm: { x: 10, y: 10, width: 60, height: 10 },
    computedStyle,
    authoredStyle: {},
    ruleStyle: declaredRule,
    runs: [],
  });
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 200,
      heightMm: 120,
      items: [
        textItem('declared-item', {
          fontFamily: '"右上角标题", Arial, sans-serif',
          fontSize: '24px',
          lineHeight: '24px',
          textAlign: 'right',
          color: 'rgb(102, 102, 102)',
        }),
        textItem('override-item', {
          fontFamily: '微软雅黑, sans-serif',
          fontSize: '18px',
          lineHeight: '30px',
          textAlign: 'center',
          color: 'rgb(102, 102, 102)',
        }),
      ],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const [declaredItem, overrideItem] = styled.pages[0].items;

  assert.equal(Object.keys(styled.styles.paragraphStyles).filter((name) => name.startsWith('右上角标题')).length, 1, 'no conflict variants are minted for declared styles');
  assert.equal(declaredItem.styleRefs.paragraphStyle, '右上角标题-24点右对齐');
  assert.equal(overrideItem.styleRefs.paragraphStyle, '右上角标题-24点右对齐');
  assert.equal(styled.styles.paragraphStyles['右上角标题-24点右对齐'].pointSize, 18, 'declared rule pixels map to the style definition');
  assert.equal(styled.styles.paragraphStyles['右上角标题-24点右对齐'].justification, 'right');
  assert.equal(declaredItem.textOverride, undefined, 'items matching the declared definition carry no override');
  assert.ok(overrideItem.textOverride, 'diverging items carry a text override');
  assert.equal(overrideItem.textOverride.pointSize, 13.5, 'override carries the computed point size');
  assert.equal(overrideItem.textOverride.justification, 'center');
  assert.equal(overrideItem.textOverride.appliedFont, '微软雅黑');
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

test('compileStyles maps declared font weights onto native face names', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'light-note',
        role: 'text',
        tagName: 'p',
        classList: ['pstyle-封面页英文段落', 'id-object'],
        attributes: {
          'data-id-paragraph-style': '封面页英文段落',
          'data-id-paragraph-style-name': '封面页英文段落',
        },
        text: 'Architecture Design',
        boundsMm: { x: 0, y: 0, width: 60, height: 10 },
        computedStyle: {
          color: 'rgb(0, 0, 0)',
          fontFamily: '微软雅黑, Arial, sans-serif',
          fontSize: '12px',
          fontWeight: '300',
          fontStyle: 'normal',
          textAlign: 'right',
        },
        ruleStyle: {
          fontFamily: "'微软雅黑',sans-serif",
          fontWeight: '300',
          fontSize: '12px',
          color: '#000000',
          textAlign: 'right',
        },
        runs: [],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const style = styled.styles.paragraphStyles['封面页英文段落'];

  assert.equal(style.fontWeight, '300');
  assert.equal(style.fontStyleName, 'Light', 'weight 300 must resolve the Light face, not Regular');
});

test('compileStyles keeps synthesized token classes out of declared style identities', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'token-only-text',
        role: 'text',
        tagName: 'p',
        classList: ['synth-synth_text_031', 'observed-text', 'id-object'],
        attributes: {
          'data-id-style-token': 'synth_text_031',
          'data-id-style-name': '文字样式 31',
        },
        text: '总平面图',
        boundsMm: { x: 0, y: 0, width: 60, height: 10 },
        computedStyle: {
          color: 'rgb(51, 51, 51)',
          fontFamily: '微软雅黑, Arial, sans-serif',
          fontSize: '24px',
          lineHeight: '30px',
          fontWeight: '700',
          fontStyle: 'normal',
          textAlign: 'right',
          backgroundColor: 'rgb(255, 79, 167)',
        },
        ruleStyle: {
          fontFamily: '"微软雅黑", Arial, sans-serif',
          fontWeight: '700',
          fontSize: '24px',
          lineHeight: '30px',
          color: '#333333',
          textAlign: 'right',
        },
        runs: [],
      }],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const item = styled.pages[0].items[0];
  const paragraphStyle = styled.styles.paragraphStyles[item.styleRefs.paragraphStyle];
  const objectStyle = styled.styles.objectStyles[item.styleRefs.objectStyle];

  assert.equal(paragraphStyle.labels[0].token, 'synth_text_031',
    'paragraph style identity must use the canonical synthesized token, not the class name');
  assert.equal(paragraphStyle.displayName, '文字样式-31');
  assert.equal(objectStyle.labels[0].token, 'synth_text_031',
    'text-frame object style identity must fold back into the same synthesized token');
});

test('compileStyles compiles declared object styles for line items only', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [
        {
          id: 'declared-rule',
          role: 'line',
          tagName: 'svg',
          classList: ['ostyle-装饰线', 'id-object'],
          attributes: {
            'data-id-object-style': '装饰线',
            'data-id-object-style-name': '装饰线',
            'data-id-role': 'line',
            'data-id-stroke-color': '#8ca064',
            'data-id-stroke-weight': '0.5',
            'data-id-stroke-style': '实底',
          },
          text: '',
          boundsMm: { x: 0, y: 0, width: 0, height: 30 },
          computedStyle: {},
          vectorGeometry: { kind: 'line', paths: [] },
          runs: [],
        },
        {
          id: 'token-only-rule',
          role: 'line',
          tagName: 'svg',
          classList: ['synth-synth_line_007', 'id-object'],
          attributes: {
            'data-id-style-token': 'synth_line_007',
            'data-id-style-name': '线条样式 07',
            'data-id-role': 'line',
            'data-id-stroke-color': '#8ca064',
            'data-id-stroke-weight': '0.5',
          },
          text: '',
          boundsMm: { x: 10, y: 0, width: 0, height: 30 },
          computedStyle: {},
          vectorGeometry: { kind: 'line', paths: [] },
          runs: [],
        },
      ],
    }],
    assets: [],
  };

  const styled = compileStyles(snapshot);
  const declared = styled.pages[0].items[0];
  const tokenOnly = styled.pages[0].items[1];

  assert.equal(declared.styleRefs.objectStyle, '装饰线');
  assert.equal(styled.styles.objectStyles['装饰线'].strokeWeight, 0.5);
  assert.equal(tokenOnly.styleRefs.objectStyle, null,
    'token-only lines stay on the synthesized style path');
});
