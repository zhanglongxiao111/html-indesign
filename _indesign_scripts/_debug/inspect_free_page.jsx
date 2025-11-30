/**
 * inspect_free_page.jsx - Inspect all items on the last page (free page)
 */
(function(){
    if(app.documents.length===0) return "No document.";
    var doc=app.activeDocument;
    var pageIndex = doc.pages.length - 1; // Last page
    var page = doc.pages[pageIndex];

    var result = [];
    result.push("Page "+(pageIndex+1)+" (master: "+(page.appliedMaster?page.appliedMaster.name:"none")+")");
    result.push("Total pageItems: "+page.pageItems.length);
    result.push("TextFrames: "+page.textFrames.length);
    result.push("Rectangles: "+page.rectangles.length);
    result.push("AllPageItems: "+page.allPageItems.length);
    result.push("---");

    // List ALL pageItems
    for(var i=0; i<page.allPageItems.length; i++){
        var item = page.allPageItems[i];
        var bounds = item.geometricBounds;
        var topMM = Math.round(bounds[0]/2.8346*10)/10;
        var leftMM = Math.round(bounds[1]/2.8346*10)/10;
        var widthMM = Math.round((bounds[3]-bounds[1])/2.8346*10)/10;
        var heightMM = Math.round((bounds[2]-bounds[0])/2.8346*10)/10;
        var typeName = item.constructor ? item.constructor.name : "unknown";
        var content = "";
        try { if(item.contents) content = String(item.contents).substring(0,20); } catch(_){}
        result.push("Item"+(i+1)+" "+typeName+": ["+leftMM+","+topMM+","+widthMM+"x"+heightMM+"mm] \""+content+"\"");
    }

    return result.join("\n");
})();

