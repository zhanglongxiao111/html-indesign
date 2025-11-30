/**
 * check_page_bounds.jsx - Check page coordinate system
 */
(function(){
    if(app.documents.length===0) return "No document.";
    var doc=app.activeDocument;
    var page = doc.pages[doc.pages.length - 1];
    
    var result = [];
    result.push("Page index: "+(doc.pages.length-1));
    result.push("Page name: "+page.name);
    
    // Page bounds
    var pb = page.bounds; // [top, left, bottom, right]
    result.push("Page bounds: ["+pb[0]+", "+pb[1]+", "+pb[2]+", "+pb[3]+"]");
    result.push("Page width: "+(pb[3]-pb[1])+" height: "+(pb[2]-pb[0]));

    // Check measurement unit
    result.push("Measurement unit: "+doc.viewPreferences.horizontalMeasurementUnits);
    result.push("Vertical unit: "+doc.viewPreferences.verticalMeasurementUnits);
    
    // Document page size
    result.push("Doc page width: "+doc.documentPreferences.pageWidth);
    result.push("Doc page height: "+doc.documentPreferences.pageHeight);
    
    // Ruler origin
    result.push("Ruler origin: "+doc.viewPreferences.rulerOrigin);
    
    // Check if facing pages
    result.push("Facing pages: "+doc.documentPreferences.facingPages);

    // Check page position in spread
    var spread = page.parent;
    result.push("Spread pages count: "+spread.pages.length);
    for(var i=0; i<spread.pages.length; i++){
        var sp = spread.pages[i];
        var spb = sp.bounds;
        result.push("Spread page "+i+": bounds=["+spb[0]+","+spb[1]+","+spb[2]+","+spb[3]+"]");
    }

    // Check page index in spread
    result.push("Page index in spread: "+page.index);

    return result.join("\n");
})();

