/**
 * build_from_instructions.jsx
 * Thin bootstrap for html-indesign build instructions.
 */
(function () {
    var uiOld = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    try {
        var scriptFile = File($.fileName);
        var scriptDir = scriptFile.parent;
        function includeLib(name) {
            var lib = File(scriptDir.fsName + "/lib/" + name);
            if (!lib.exists) {
                throw new Error("Missing executor lib: " + lib.fsName);
            }
            $.evalFile(lib);
        }

        includeLib("hi_core.jsxinc");
        includeLib("hi_labels.jsxinc");
        includeLib("hi_document.jsxinc");
        includeLib("hi_parent_pages.jsxinc");
        includeLib("hi_fonts.jsxinc");
        includeLib("hi_styles.jsxinc");
        includeLib("hi_vector_styles.jsxinc");
        includeLib("hi_assets.jsxinc");
        includeLib("hi_tables.jsxinc");
        includeLib("hi_text_fit.jsxinc");
        includeLib("hi_items.jsxinc");
        includeLib("hi_executor.jsxinc");

        var jsonPath = "D:/AI/html-indesign/test/workspace/instructions.json";
        try {
            if (typeof defaultJsonPath !== "undefined" && defaultJsonPath) {
                jsonPath = defaultJsonPath;
            }
        } catch (_) {}
        try {
            if (app.documents.length > 0) {
                var labelPath = app.activeDocument.extractLabel("build_json_path");
                if (labelPath) jsonPath = labelPath;
            }
        } catch (_) {}

        var result = HI.runBuildFromInstructions(app, jsonPath);
        return HI.stringify(result);
    } catch (error) {
        var fallback = {
            ok: false,
            errors: [{ code: "BOOTSTRAP_ERROR", message: String(error) }],
            messages: [String(error)]
        };
        try {
            if (typeof HI !== "undefined" && HI.stringify) return HI.stringify(fallback);
        } catch (_) {}
        return '{"ok":false,"errors":[{"code":"BOOTSTRAP_ERROR","message":"bootstrap failed"}]}';
    } finally {
        app.scriptPreferences.userInteractionLevel = uiOld;
    }
})();
