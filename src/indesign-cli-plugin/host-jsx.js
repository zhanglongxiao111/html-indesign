const path = require('node:path');

function buildBuildJsx({ repoRoot, instructionsPath }) {
  const base = toJsxPath(repoRoot);
  const instructions = toJsxPath(instructionsPath);
  return `(function () {
    var base = ${JSON.stringify(base)};
    function includeLib(name) {
        var lib = File(base + "/_indesign_scripts/lib/" + name);
        if (!lib.exists) throw new Error("Missing executor lib: " + lib.fsName);
        $.evalFile(lib);
    }

    includeLib("hi_core.jsxinc");
    includeLib("hi_labels.jsxinc");
    includeLib("hi_document.jsxinc");
    includeLib("hi_parent_pages.jsxinc");
    includeLib("hi_fonts.jsxinc");
    includeLib("hi_composite_fonts.jsxinc");
    includeLib("hi_styles.jsxinc");
    includeLib("hi_text_overrides.jsxinc");
    includeLib("hi_blend_modes.jsxinc");
    includeLib("hi_vector_styles.jsxinc");
    includeLib("hi_assets.jsxinc");
    includeLib("hi_tables.jsxinc");
    includeLib("hi_text_fit.jsxinc");
    includeLib("hi_items.jsxinc");
    includeLib("hi_executor.jsxinc");

    var marker = "html-indesign-indesign-e2e";
    var doc = app.documents.add();
    doc.insertLabel("html_indesign_e2e_marker", marker);
    var report = HI.runBuildFromInstructions(app, ${JSON.stringify(instructions)});
    doc.insertLabel("html_indesign_e2e_report", JSON.stringify(report));

    return JSON.stringify({
        ok: report.ok !== false,
        marker: marker,
        pageCount: doc.pages.length,
        counts: report.counts,
        errors: report.errors,
        warnings: report.warnings
    });
})();`;
}

function buildExportJsx({
  runDir,
  outputBaseName = 'architecture-report-indesign',
  exportPdf = true,
  exportIdml = true,
  closeDocument = true,
}) {
  const outDir = toJsxPath(runDir);
  const baseName = String(outputBaseName || 'html-indesign-output');
  const pdfDeclaration = exportPdf
    ? `    var pdf = File(runDir + "/${escapeJsxString(baseName)}.pdf");`
    : '    var pdf = null;';
  const idmlDeclaration = exportIdml
    ? `    var idml = File(runDir + "/${escapeJsxString(baseName)}.idml");`
    : '    var idml = null;';
  const pdfExportBlock = exportPdf ? `
    try {
        app.pdfExportPreferences.pageRange = PageRange.ALL_PAGES;
        doc.exportFile(ExportFormat.PDF_TYPE, pdf, false);
        result.outputs.pdf = pdf.fsName;
    } catch (error2) {
        add("error", "PDF_EXPORT_FAILED", String(error2));
    } finally {
        if (oldPdfPageRange !== null) {
            try { app.pdfExportPreferences.pageRange = oldPdfPageRange; } catch (_) {}
        }
    }
` : '';
  const idmlExportBlock = exportIdml ? `
    try {
        doc.exportFile(ExportFormat.INDESIGN_MARKUP, idml, false);
        result.outputs.idml = idml.fsName;
    } catch (error3) {
        add("warning", "IDML_EXPORT_FAILED", String(error3));
    }
` : '';
  const closeBlock = closeDocument ? `
    try {
        doc.close(SaveOptions.NO);
        result.closed = true;
    } catch (closeError) {
        add("warning", "DOC_CLOSE_FAILED", String(closeError));
    }
` : `
    result.closed = false;
`;
  return `(function () {
    var runDir = ${JSON.stringify(outDir)};
    var result = { ok: true, outputs: {}, counts: {}, errors: [], warnings: [] };

    function add(level, code, message) {
        result[level === "error" ? "errors" : "warnings"].push({ code: code, message: message });
        if (level === "error") result.ok = false;
    }

    if (app.documents.length < 1) {
        add("error", "NO_ACTIVE_DOCUMENT", "No active document to export.");
        return JSON.stringify(result);
    }

    var doc = app.activeDocument;
    var indd = File(runDir + "/${escapeJsxString(baseName)}.indd");
${pdfDeclaration}
${idmlDeclaration}
    var oldPdfPageRange = null;
    try {
        oldPdfPageRange = app.pdfExportPreferences.pageRange;
    } catch (_) {}

    function auditCollection(kind, collection) {
        result.audit.panelNames[kind] = [];
        try {
            var items = collection.everyItem().getElements();
            for (var i = 0; i < items.length; i++) {
                var name = String(items[i].name || "");
                result.audit.panelNames[kind].push(name);
                if (/[A-Za-z]/.test(name) && !isAllowedBuiltInPanelName(kind, name)) {
                    result.audit.panelAsciiNames.push({ kind: kind, name: name });
                }
            }
        } catch (error) {
            add("warning", "PANEL_AUDIT_FAILED", kind + ": " + String(error));
        }
    }

    function isAllowedBuiltInPanelName(kind, name) {
        return kind === "swatches" && /^(None|Registration|Paper|Black)$/.test(String(name));
    }

    function auditPanelNames() {
        result.audit = { panelAsciiNames: [], panelNames: {} };
        auditCollection("layers", doc.layers);
        auditCollection("swatches", doc.swatches);
        auditCollection("paragraphStyles", doc.paragraphStyles);
        auditCollection("characterStyles", doc.characterStyles);
        auditCollection("objectStyles", doc.objectStyles);
        auditCollection("tableStyles", doc.tableStyles);
        auditCollection("cellStyles", doc.cellStyles);
    }

    try {
        doc.save(indd);
        result.outputs.indd = indd.fsName;
    } catch (error) {
        add("error", "INDD_SAVE_FAILED", String(error));
    }
${pdfExportBlock}
${idmlExportBlock}
    try {
        result.counts.pages = doc.pages.length;
        result.counts.links = doc.links.length;
        result.counts.pageItems = doc.pageItems.length;
        result.counts.textFrames = doc.textFrames.length;
        result.counts.rectangles = doc.rectangles.length;
        result.counts.graphicLines = doc.graphicLines.length;
        result.counts.tables = doc.stories.everyItem().tables.length;
    } catch (countError) {
        add("warning", "COUNT_FAILED", String(countError));
    }

    try {
        var overset = 0;
        var frames = doc.textFrames.everyItem().getElements();
        for (var i = 0; i < frames.length; i++) {
            if (frames[i].overflows) overset += 1;
        }
        result.counts.oversetTextFrames = overset;
    } catch (oversetError) {
        add("warning", "OVERSET_COUNT_FAILED", String(oversetError));
    }

    auditPanelNames();

${closeBlock}

    return JSON.stringify(result);
})();`;
}

function buildReverseSnapshotJsx({ repoRoot, outputPath, inddPath = null, closeDocument = true }) {
  const base = toJsxPath(repoRoot);
  const output = toJsxPath(outputPath);
  const openBlock = inddPath ? `
        var indd = File(${JSON.stringify(toJsxPath(inddPath))});
        if (!indd.exists) throw new Error("INDD file not found: " + indd.fsName);
        app.open(indd);
` : '';
  const closeBlock = closeDocument ? `
    try {
        if (app.documents.length > 0) app.activeDocument.close(SaveOptions.NO);
        result.closed = true;
    } catch (closeError) {
        result.warnings.push({ code: "DOC_CLOSE_FAILED", message: String(closeError) });
        if (result.ok !== false) result.ok = true;
    }
` : '';
  return `(function () {
    var result = { ok: false, outputPath: ${JSON.stringify(output)}, errors: [], warnings: [] };
    try {${openBlock}
        app.insertLabel("html_indesign_reverse_output", ${JSON.stringify(output)});
        var raw = $.evalFile(File(${JSON.stringify(base + "/_indesign_scripts/export_to_html_snapshot.jsx")}));
        if (!raw) throw new Error("Reverse snapshot script returned an empty result.");
        result = JSON.parse(String(raw));
        if (!result) throw new Error("Reverse snapshot script returned invalid JSON.");
        if (!result.errors) result.errors = [];
        if (!result.warnings) result.warnings = [];
    } catch (error) {
        if (!result.errors) result.errors = [];
        if (!result.warnings) result.warnings = [];
        result.ok = false;
        result.errors.push({ code: "REVERSE_SNAPSHOT_FAILED", message: String(error) });
    } finally {
        app.insertLabel("html_indesign_reverse_output", "");
    }
${closeBlock}
    return JSON.stringify(result);
})();`;
}

function escapeJsxString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toJsxPath(value) {
  return path.resolve(value).replace(/\\/g, '/');
}

module.exports = {
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
};
