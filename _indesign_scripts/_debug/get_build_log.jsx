// Get build log from document label
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    try {
        var log = doc.extractLabel("build_last_result");
        return log || "No build log found";
    } catch(e) {
        return "Error: " + e;
    }
})();

