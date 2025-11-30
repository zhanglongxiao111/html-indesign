(function() {
    var doc = app.activeDocument;
    var result = [];
    
    // Check CornerOptions enum
    result.push("=== CornerOptions 枚举值 ===");
    result.push("NONE: " + CornerOptions.NONE);
    result.push("ROUNDED_CORNER: " + CornerOptions.ROUNDED_CORNER);
    result.push("BEVEL_CORNER: " + CornerOptions.BEVEL_CORNER);
    result.push("INSET_CORNER: " + CornerOptions.INSET_CORNER);
    result.push("INVERSE_ROUNDED_CORNER: " + CornerOptions.INVERSE_ROUNDED_CORNER);
    result.push("FANCY_CORNER: " + CornerOptions.FANCY_CORNER);
    
    result.push("\n=== 对象样式的圆角设置 ===");
    for (var i = 0; i < doc.allObjectStyles.length; i++) {
        var os = doc.allObjectStyles[i];
        var info = os.name + ": ";
        try {
            info += "radius=" + os.topLeftCornerRadius;
            info += ", option=" + os.topLeftCornerOption;
            info += " (" + (os.topLeftCornerOption === CornerOptions.NONE ? "NONE" : 
                           os.topLeftCornerOption === CornerOptions.ROUNDED_CORNER ? "ROUNDED" : "OTHER") + ")";
            // Check if corner effect is actually enabled
            info += ", enableCornerOptions=" + os.enableStrokeAndCornerOptions;
        } catch(e) {
            info += "error: " + e.message;
        }
        result.push(info);
    }
    
    return result.join("\n");
})();
