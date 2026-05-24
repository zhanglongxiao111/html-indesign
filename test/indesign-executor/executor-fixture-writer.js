const fs = require('fs');
const path = require('path');

function writeExecutorSmokeWorkspace(workspaceDir = path.resolve(__dirname, '../workspace/indesign-executor-smoke')) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  const assetsDir = path.join(workspaceDir, 'executor-assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'site-plan.pdf'), createTinyPdf('Site Plan'), 'ascii');
  fs.writeFileSync(path.join(assetsDir, 'diagram.svg'), createTinySvg(), 'utf8');

  const instructions = createSmokeInstructions();
  const instructionsPath = path.join(workspaceDir, 'instructions.json');
  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2), 'utf8');

  return {
    workspaceDir,
    assetsDir,
    instructionsPath,
    instructions,
  };
}

function createSmokeInstructions() {
  return {
    metadata: {
      source: 'indesign-executor-smoke',
      mode: 'editable-first',
      compiler: 'html-indesign/test-fixture',
    },
    document: {
      pages: [{ id: 'executor-page-1', width: 210, height: 120 }],
    },
    styles: {
      swatches: {
        'color-123456': { name: 'color-123456', model: 'process', space: 'RGB', value: '#123456' },
        'color-c8102e': { name: 'color-c8102e', model: 'process', space: 'RGB', value: '#c8102e' },
        'color-f2f2f2': { name: 'color-f2f2f2', model: 'process', space: 'RGB', value: '#f2f2f2' },
      },
      fonts: {
        Arial: { family: 'Arial', fallback: 'Arial' },
      },
      compositeFonts: {},
      paragraphStyles: {
        'report-title': {
          name: 'report-title',
          appliedFont: 'Arial',
          pointSize: 24,
          leading: 28,
          fontWeight: '700',
          fontStyle: 'normal',
          fillColor: 'color-123456',
          justification: 'left',
          tracking: 0,
          spaceBefore: 0,
          spaceAfter: 0,
        },
      },
      characterStyles: {
        accent: {
          name: 'accent',
          appliedFont: 'Arial',
          pointSize: 24,
          fontWeight: '700',
          fontStyle: 'italic',
          fillColor: 'color-c8102e',
          tracking: 0,
          verticalPosition: 'baseline',
          textDecoration: 'none',
        },
      },
      objectStyles: {
        'metric-card': {
          name: 'metric-card',
          fillColor: 'color-f2f2f2',
          strokeColor: 'color-123456',
          strokeWeight: 1,
          strokeStyle: 'solid',
          cornerRadius: '0px',
          opacity: 1,
          overflow: 'visible',
        },
      },
      frameStyles: {
        'drawing-frame': {
          name: 'drawing-frame',
          fit: 'contain',
          position: '50% 50%',
          inset: { top: 0, right: 0, bottom: 0, left: 0 },
          overflow: 'hidden',
        },
      },
      tableStyles: {},
      cellStyles: {},
    },
    assets: [
      {
        id: 'asset-site-plan-pdf',
        src: 'executor-assets/site-plan.pdf',
        resolvedPath: 'executor-assets/site-plan.pdf',
        kind: 'pdf',
        fileName: 'site-plan.pdf',
        linked: true,
        placement: { fit: 'contain', position: '50% 50%', pageNumber: 1, crop: 'trim', preserveVector: true },
      },
      {
        id: 'asset-diagram-svg',
        src: 'executor-assets/diagram.svg',
        resolvedPath: 'executor-assets/diagram.svg',
        kind: 'svg',
        fileName: 'diagram.svg',
        linked: true,
        placement: { fit: 'contain', position: '50% 50%', preserveVector: true },
      },
    ],
    layers: [
      { name: 'background', order: 0 },
      { name: 'graphics', order: 1 },
      { name: 'text', order: 2 },
    ],
    pages: [{
      id: 'executor-page-1',
      index: 0,
      width: 210,
      height: 120,
      items: [
        {
          id: 'card-background',
          role: 'shape',
          type: 'SHAPE',
          bounds: { x: 10, y: 10, width: 190, height: 100 },
          objectStyle: 'metric-card',
          layer: 'background',
          zIndex: 1,
        },
        {
          id: 'title',
          role: 'text',
          type: 'TEXT',
          bounds: { x: 16, y: 16, width: 110, height: 18 },
          text: '建筑设计汇报重点',
          paragraphStyle: 'report-title',
          runs: [
            { text: '建筑设计汇报', characterStyle: null },
            { text: '重点', characterStyle: 'accent' },
          ],
          layer: 'text',
          zIndex: 30,
        },
        {
          id: 'site-plan',
          role: 'graphic',
          type: 'GRAPHIC',
          bounds: { x: 16, y: 42, width: 88, height: 58 },
          objectStyle: 'metric-card',
          frameStyle: 'drawing-frame',
          placed: { assetId: 'asset-site-plan-pdf', fit: 'contain', position: '50% 50%', pageNumber: 1, crop: 'trim', preserveVector: true },
          layer: 'graphics',
          zIndex: 20,
        },
        {
          id: 'diagram',
          role: 'graphic',
          type: 'GRAPHIC',
          bounds: { x: 114, y: 42, width: 72, height: 58 },
          objectStyle: 'metric-card',
          frameStyle: 'drawing-frame',
          placed: { assetId: 'asset-diagram-svg', fit: 'contain', position: '50% 50%', preserveVector: true },
          layer: 'graphics',
          zIndex: 21,
        },
      ],
    }],
    warnings: [],
  };
}

function createTinySvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">',
    '<rect x="0" y="0" width="200" height="120" fill="#f2f2f2"/>',
    '<path d="M20 95 L90 30 L180 95 Z" fill="#123456" opacity="0.85"/>',
    '<circle cx="90" cy="52" r="12" fill="#c8102e"/>',
    '</svg>',
  ].join('');
}

function createTinyPdf(label) {
  const content = `BT /F1 18 Tf 20 50 Td (${escapePdfText(label)}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return body;
}

function escapePdfText(value) {
  return String(value).replace(/[\\()]/g, '\\$&');
}

module.exports = {
  writeExecutorSmokeWorkspace,
  createSmokeInstructions,
};
