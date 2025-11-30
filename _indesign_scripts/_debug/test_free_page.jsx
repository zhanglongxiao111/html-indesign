/**
 * test_free_page.jsx
 * Test free page creation in InDesign
 */
(function(){
    var uiOld = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    var messages=[];
    function log(m){ try{messages.push(m); $.writeln(m);}catch(_){ } }
    if(app.documents.length===0){ log("No document."); return; }
    var doc=app.activeDocument;

    // Use the free page test JSON
    var jsonPath="D:/AI/html-indesign/test/output_run/instructions_free_visual.json";
    var file=File(jsonPath);
    if(!file.exists){ log("JSON file not found: "+jsonPath); return; }
    if(!file.open("r")){ log("Cannot open "+file.fsName); return; }
    var raw=file.read(); file.close();
    var data; try{ data=(typeof JSON!=="undefined"&&JSON.parse)?JSON.parse(raw):eval("("+raw+")"); }catch(e){ log("JSON parse error:"+e); return; }

    // When measurement units are set to MM, geometricBounds uses MM directly
    function boundsToMM(b){ return [b.y, b.x, b.y+b.height, b.x+b.width]; }
    function normalize(s){ return (s||"").toString().replace(/\s+/g,"").toLowerCase(); }
    function slotNameFromLabel(label){
        if(!label) return "";
        var parts=String(label).split(/[;；\n]/);
        for(var i=0;i<parts.length;i++){
            var p=String(parts[i]);
            if(p.indexOf("名称：")===0||p.indexOf("名称:")===0){
                var sub = p.substring(3);
                return sub.replace(/^\s+|\s+$/g, "");
            }
        }
        var first = String(parts[0]);
        return first.replace(/^\s+|\s+$/g, "");
    }

    var oldH=doc.viewPreferences.horizontalMeasurementUnits;
    var oldV=doc.viewPreferences.verticalMeasurementUnits;
    var oldOrigin=doc.viewPreferences.rulerOrigin;
    doc.viewPreferences.horizontalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.rulerOrigin=RulerOrigin.PAGE_ORIGIN;

    var pages=data.pages||[];
    log("Processing "+pages.length+" pages...");

    for(var pi=0;pi<pages.length;pi++){
        var info=pages[pi];
        if(info.template && String(info.template).toLowerCase()==="free"){
            var page=doc.pages.add(LocationOptions.AT_END);
            var freeMaster = info.master || "F-自由页";
            log("Creating free page with master: "+freeMaster);
            
            // Apply master
            try{ 
                page.appliedMaster=doc.masterSpreads.itemByName(freeMaster);
                log("Master applied: "+freeMaster);
            }catch(_m){ log("Free master missing:"+freeMaster); }
            
            // Override master items
            var freeSlotItems=[];
            try{
                var fmSpread = doc.masterSpreads.itemByName(freeMaster);
                var fmPage = fmSpread.pages[0];
                var fmItems = fmPage.pageItems;
                for(var fmi=0; fmi<fmItems.length; fmi++){
                    var fmItem = fmItems[fmi];
                    try{
                        if(fmItem.allowOverrides){
                            var fOrigBounds = fmItem.geometricBounds;
                            var fovr = fmItem.override(page);
                            try{ fovr.geometricBounds = fOrigBounds; }catch(_ffb){}
                            if(fovr && fovr.label && fovr.label !== ""){
                                freeSlotItems.push(fovr);
                                log("Overridden slot: "+slotNameFromLabel(fovr.label));
                            }
                        }
                    }catch(_fov){}
                }
            }catch(_ovF){ log("Override error: "+_ovF); }

            var free=info.items||[];
            log("Processing "+free.length+" items...");
            var createdCount = 0;

            for(var fi=0; fi<free.length; fi++){
                var fItem=free[fi];
                
                // Handle slot items (existing on master)
                if (fItem.slot && String(fItem.slot).length) {
                    var k=normalize(fItem.slot);
                    var targetFree=null;
                    for(var sfi=0;sfi<freeSlotItems.length;sfi++){
                        var sf=freeSlotItems[sfi];
                        var sName=slotNameFromLabel(sf.label);
                        var nLab2=normalize(sf.label), nName2=normalize(sName);
                        if(nLab2===k || nName2===k){ targetFree=sf; break; }
                    }
                    if(!targetFree && k){
                        for(var sfi2=0;sfi2<freeSlotItems.length;sfi2++){
                            var sf2=freeSlotItems[sfi2];
                            var nLab3=normalize(sf2.label);
                            if(nLab3.indexOf("名称："+k)!==-1 || nLab3.indexOf("名称:"+k)!==-1){ targetFree=sf2; break; }
                        }
                    }
                    if(targetFree){
                        try{ targetFree.contents = fItem.content||""; log("Filled slot: "+fItem.slot); }
                        catch(errSlot){ log("Slot fill error: "+errSlot); }
                    } else {
                        log("Slot not found: "+fItem.slot);
                    }
                    continue;
                }

                // Handle free items (dynamically created)
                if(!fItem.bounds || typeof fItem.bounds !== 'object'){
                    log("Free item missing bounds");
                    continue;
                }
                var gb=boundsToMM(fItem.bounds);
                
                if(fItem.type==="TEXT"){
                    var tf=page.textFrames.add();
                    tf.geometricBounds=gb;
                    tf.contents=fItem.content||"";
                    try{ if(fItem.paragraphStyle) tf.texts[0].appliedParagraphStyle=doc.paragraphStyles.itemByName(fItem.paragraphStyle); }catch(_s){}
                    try{ if(fItem.objectStyle) tf.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle); }catch(_os){}
                    log("Created TEXT: "+fItem.content.substring(0,20)+"... at ["+fItem.bounds.x+","+fItem.bounds.y+"]");
                    createdCount++;
                }else if(fItem.type==="IMAGE"){
                    var rect=page.rectangles.add();
                    rect.geometricBounds=gb;
                    try{ if(fItem.objectStyle) rect.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle); }catch(_os){}
                    log("Created IMAGE frame at ["+fItem.bounds.x+","+fItem.bounds.y+"] (src: "+fItem.src+")");
                    createdCount++;
                }
            }
            log("Created "+createdCount+" free items");
        }
    }

    doc.viewPreferences.horizontalMeasurementUnits=oldH;
    doc.viewPreferences.verticalMeasurementUnits=oldV;
    doc.viewPreferences.rulerOrigin=oldOrigin;
    
    app.scriptPreferences.userInteractionLevel = uiOld;
    doc.insertLabel("test_free_result", messages.join(" | "));
    return "Done. "+messages.join(" | ");
})();

