/**
 * list_all_pages.jsx - List all pages with their masters
 */
(function(){
    if(app.documents.length===0) return "No document.";
    var doc=app.activeDocument;
    var result = [];
    for(var i=0; i<doc.pages.length; i++){
        var page = doc.pages[i];
        var masterName = page.appliedMaster ? page.appliedMaster.name : "(none)";
        var itemCount = page.pageItems.length;
        result.push("Page "+(i+1)+": master="+masterName+", items="+itemCount);
    }
    return result.join(" | ");
})();

