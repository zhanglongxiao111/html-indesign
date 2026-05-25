(function () {
    var base = File($.fileName).parent.parent.fsName.replace(/\\/g, "/");
    function includeLib(name) {
        var lib = File(base + "/_indesign_scripts/lib/" + name);
        if (!lib.exists) throw new Error("Missing reverse lib: " + lib.fsName);
        $.evalFile(lib);
    }

    includeLib("hi_core.jsxinc");
    includeLib("hi_labels.jsxinc");
    includeLib("hi_reverse_styles.jsxinc");
    includeLib("hi_reverse_text.jsxinc");
    includeLib("hi_reverse_effects.jsxinc");
    includeLib("hi_reverse.jsxinc");

    var outputPath = app.extractLabel("html_indesign_reverse_output");
    if (!outputPath) outputPath = base + "/test/workspace/reverse-snapshot.json";
    return HI.stringify(HI.exportReverseSnapshot(app, outputPath));
})();
