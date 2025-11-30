/**
 * test_bounds_unit.jsx - Test what unit geometricBounds uses
 */
(function(){
    if(app.documents.length===0) return "No document.";
    var doc=app.activeDocument;
    var page = doc.pages[doc.pages.length - 1];
    
    var result = [];
    
    // Set measurement units to mm
    var oldH=doc.viewPreferences.horizontalMeasurementUnits;
    var oldV=doc.viewPreferences.verticalMeasurementUnits;
    doc.viewPreferences.horizontalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    
    // Create a test textframe at 100mm, 100mm
    var tf = page.textFrames.add();
    tf.geometricBounds = [100, 100, 150, 200]; // If mm: 100mm from top, 100mm from left
    tf.contents = "TEST BOUNDS";
    
    var actualBounds = tf.geometricBounds;
    result.push("Set bounds: [100, 100, 150, 200]");
    result.push("Actual bounds: ["+actualBounds[0]+", "+actualBounds[1]+", "+actualBounds[2]+", "+actualBounds[3]+"]");
    
    // Check position
    result.push("Top: "+actualBounds[0]+" (expected 100mm = 283.46pt)");
    result.push("Left: "+actualBounds[1]+" (expected 100mm = 283.46pt)");
    
    // If bounds are in mm, actual should be ~100
    // If bounds are in pt, actual should be ~283.46
    
    // Clean up
    tf.remove();
    
    // Restore
    doc.viewPreferences.horizontalMeasurementUnits=oldH;
    doc.viewPreferences.verticalMeasurementUnits=oldV;
    
    return result.join("\n");
})();

