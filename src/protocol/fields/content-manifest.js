// 反向导出内容清单 content-manifest.json 的字段（html-indesign #26），以及引用它的
// report.json 字段与 html.reverse_export 返回体字段。
// 清单是从反向语义模型派生的只读观察产物：给 Agent 取内容用，不参与结构化编译，也不写回任何格式。
const CONTENT_MANIFEST_CAPABILITIES = Object.freeze({
  html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
  indesign: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
});

function manifestField(canonicalPath, type, description) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'content-manifest',
    type,
    capabilities: CONTENT_MANIFEST_CAPABILITIES,
    description,
    validation: {
      mayDriveStructuredCompilation: false,
    },
  };
}

const PAGE_PATHS = ['pages[]', 'parentPages[]'];

function blockFields(prefix) {
  const text = `contentManifest.${prefix}.textBlocks[]`;
  const image = `contentManifest.${prefix}.images[]`;
  return [
    manifestField(`contentManifest.${prefix}.textBlocks`, 'array', 'Text frames and tables of the page; empty frames are skipped.'),
    manifestField(`${text}.id`, 'string', 'Reverse model item id.'),
    manifestField(`${text}.order`, 'number', 'Reading order within the page, shared with images; 1-based.'),
    manifestField(`${text}.kind`, 'string', 'text or table.'),
    manifestField(`${text}.role`, 'string', 'Reverse model item role, when present.'),
    manifestField(`${text}.semantic`, 'string', 'Whitelisted semantic token, when present.'),
    manifestField(`${text}.paragraphStyle`, 'string', 'Paragraph style display name (or token), when present.'),
    manifestField(`${text}.tableStyle`, 'string', 'Table style name for kind=table, when present.'),
    manifestField(`${text}.bounds`, 'object', 'Read-back frame bounds {x,y,width,height} in the manifest unit.'),
    manifestField(`${text}.text`, 'string', 'Plain text for kind=text; paragraphs and forced line breaks become \\n.'),
    manifestField(`${text}.headerRows`, 'number', 'Leading header row count for kind=table, when greater than 0.'),
    manifestField(`${text}.rows`, 'array', 'Table cell text as rowCount x columnCount 2D array; cells covered by a merged cell are null.'),
    manifestField(`contentManifest.${prefix}.images`, 'array', 'Placed assets of the page.'),
    manifestField(`${image}.id`, 'string', 'Reverse model item id.'),
    manifestField(`${image}.order`, 'number', 'Reading order within the page, shared with text blocks; 1-based.'),
    manifestField(`${image}.role`, 'string', 'Reverse model item role, when present.'),
    manifestField(`${image}.semantic`, 'string', 'Whitelisted semantic token, when present.'),
    manifestField(`${image}.bounds`, 'object', 'Placement frame bounds {x,y,width,height} in the manifest unit.'),
    manifestField(`${image}.name`, 'string', 'Link name.'),
    manifestField(`${image}.linkPath`, 'string', 'Original link path as InDesign reports it (UNC for NAS assets).'),
    manifestField(`${image}.packagePath`, 'string', 'Relative path of the copy inside the author package (assetPolicy=copy only).'),
    manifestField(`${image}.format`, 'string', 'jpeg/png/gif/webp/bmp/tiff/psd/psb/pdf/ai/eps/svg/...; the file header wins over the extension when it was read.'),
    manifestField(`${image}.kind`, 'string', 'raster, vector or unknown.'),
    manifestField(`${image}.linkStatus`, 'string', 'normal/missing/modified/embedded/inaccessible from the InDesign link status.'),
    manifestField(`${image}.pdfPage`, 'number', 'Placed PDF/AI page number, when present.'),
    manifestField(`${image}.cropped`, 'boolean', 'true when the frame crops the placed image.'),
    manifestField(`${image}.pixelWidth`, 'number|null', 'Raster pixel width after EXIF orientation; null for vector or unreadable files.'),
    manifestField(`${image}.pixelHeight`, 'number|null', 'Raster pixel height after EXIF orientation; null for vector or unreadable files.'),
    manifestField(`${image}.aspectRatio`, 'number|null', 'pixelWidth / pixelHeight.'),
    manifestField(`${image}.exifOrientation`, 'number', 'EXIF orientation 2-8, when not 1; 5-8 swap width and height.'),
    manifestField(`${image}.effectivePpi`, 'object|null', 'Effective PPI {horizontal, vertical}: pixels / placed image size in inches.'),
    manifestField(`${image}.ppiBasis`, 'string|null', 'placed-image-bounds (image bounds incl. scale/crop) or frame-bounds (approximation).'),
    manifestField(`${image}.pixelSource`, 'string|null', 'package-copy or link-path: which file the header was read from.'),
    manifestField(`${image}.pixelError`, 'object|null', 'Why pixel fields are null for a non-vector asset: {reason, message}.'),
  ];
}

module.exports = [
  manifestField('contentManifest.schema', 'string', 'html-indesign.content-manifest'),
  manifestField('contentManifest.schemaVersion', 'number', 'Manifest schema version.'),
  manifestField('contentManifest.runId', 'string', 'Same runId as report.json of the reverse export.'),
  manifestField('contentManifest.generatedAt', 'string', 'ISO timestamp.'),
  manifestField('contentManifest.tool', 'string', 'Producing tool, e.g. html.reverse_export.'),
  manifestField('contentManifest.source', 'object', 'Source document {indd, documentId, title, mode}.'),
  manifestField('contentManifest.unit', 'string', 'Coordinate unit of every bounds/size in the manifest; always mm (physical InDesign size).'),
  manifestField('contentManifest.pageCount', 'number', 'Number of document pages.'),
  manifestField('contentManifest.pageSize', 'object', 'First page size {width,height}; pages of a different size carry their own size.'),
  manifestField('contentManifest.readingOrder', 'string', 'Reading order basis; xy-cut.'),
  manifestField('contentManifest.files', 'object', 'Paths relative to the manifest: report, reverseModel, authorEntry, authorConfig.'),
  manifestField('contentManifest.summary', 'object', 'Counts of text blocks, tables, images, raster/vector images and pixel read results.'),
  manifestField('contentManifest.parentPages', 'array', 'Parent pages (masters) that carry text or images.'),
  manifestField('contentManifest.parentPages[].id', 'string', 'Parent page id.'),
  manifestField('contentManifest.parentPages[].name', 'string', 'Parent page name.'),
  manifestField('contentManifest.pages', 'array', 'Document pages in order.'),
  manifestField('contentManifest.pages[].id', 'string', 'Reverse model page id.'),
  manifestField('contentManifest.pages[].index', 'number', '0-based page index.'),
  manifestField('contentManifest.pages[].name', 'string', 'InDesign page name from the reverse snapshot, when present.'),
  manifestField('contentManifest.pages[].semantic', 'string', 'Page semantic, when present.'),
  manifestField('contentManifest.pages[].parentPageId', 'string', 'Applied parent page id, when present.'),
  manifestField('contentManifest.pages[].size', 'object', 'Page size {width,height}, only when it differs from pageSize.'),
  ...PAGE_PATHS.flatMap((prefix) => blockFields(prefix)),
  manifestField('reverseReport.contentManifest', 'object', 'report.json reference {path, summary} to content-manifest.json.'),
  manifestField('reverseExportResult.data.contentManifestPath', 'string|null', 'html.reverse_export return body: absolute path of content-manifest.json; also listed in artifacts.'),
];
