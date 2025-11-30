/**
 * build_from_instructions.jsx
 * Auto-create pages from instructions JSON, override master items to page, then fill by labels.
 * Default JSON: test/output_run/instructions_deck.json (override via defaultJsonPath or doc label build_json_path).
 * Logs saved to doc label build_last_result.
 */
(function(){
    var uiOld = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    var messages=[];
    function log(m){ try{messages.push(m); $.writeln(m);}catch(_){ } }
    if(app.documents.length===0){ log("No document."); return; }
    var doc=app.activeDocument;

    // 约定的指令文件路径（与 builder.js 输出路径保持一致）
    var jsonPath="D:/AI/html-indesign/test/workspace/instructions.json";
    // 优先级1: 外部变量覆盖
    try{ if(typeof defaultJsonPath!=="undefined" && defaultJsonPath) jsonPath=defaultJsonPath; }catch(_){}
    // 优先级2: 文档标签覆盖
    try{ var lbl=doc.extractLabel("build_json_path"); if(lbl) jsonPath=lbl; }catch(_){}

    var file=File(jsonPath);
    if(!file.exists){
        alert("指令文件不存在！\n\n" +
              "期望路径: " + jsonPath + "\n\n" +
              "请先运行以下命令生成指令文件:\n" +
              "node src/builder.js <content.html> test/artifacts/blueprint.json test/workspace/instructions.json\n\n" +
              "或者在文档标签 build_json_path 中指定自定义路径。",
              "Build Instructions Not Found",
              true);
        log("JSON file not found: " + jsonPath);
        app.scriptPreferences.userInteractionLevel=uiOld;
        return;
    }
    if(!file.open("r")){ log("Cannot open "+file.fsName); app.scriptPreferences.userInteractionLevel=uiOld; return; }
    var raw=file.read(); file.close();
    var data; try{ data=(typeof JSON!=="undefined"&&JSON.parse)?JSON.parse(raw):eval("("+raw+")"); }catch(e){ log("JSON parse error:"+e); return; }

    // When measurement units are set to MM, geometricBounds uses MM directly (no conversion needed)
    function boundsToMM(b){ return [b.y, b.x, b.y+b.height, b.x+b.width]; }
    function normalize(s){ return (s||"").toString().replace(/\s+/g,""); }
    function slotNameFromLabel(label){
        if(!label) return "";
        var parts=String(label).split(/[;；\n]/);
        for(var i=0;i<parts.length;i++){
            var seg=parts[i]; if(!seg) continue;
            var kv=seg.split(/[:=：]/); if(kv.length<2) continue;
            var key=kv.shift().replace(/^\s+|\s+$/g,''); var val=kv.join('=').replace(/^\s+|\s+$/g,'');
            if(!val) continue;
            if(key==="名称"||key==="名字"||key==="槽位"||key.toLowerCase()==="slot"||key.toLowerCase()==="name") return val;
        }
        return "";
    }
    function applyText(target,text){
        var q=[target], seen={};
        while(q.length){
            var cur=q.shift(); if(!cur||!cur.isValid) continue;
            var idKey=""; try{idKey=String(cur.id);}catch(_){}
            if(idKey && seen[idKey]) continue; if(idKey) seen[idKey]=true;
            try{ if(typeof cur.contents!=="undefined"){ cur.contents=text; if(cur.contents===text) return true; } }catch(_){}
            try{ if(cur.texts&&cur.texts.length){ cur.texts[0].contents=text; if(cur.texts[0].contents===text) return true; } }catch(_){}
            try{ if(cur.textFrames&&cur.textFrames.length){ for(var ti=0;ti<cur.textFrames.length;ti++){ var tf=cur.textFrames[ti]; try{ tf.contents=text; if(tf.contents===text) return true; }catch(_tf){} q.push(tf);} } }catch(_){}
            try{ var kids=cur.pageItems; if(kids&&kids.length){ for(var ki=0;ki<kids.length;ki++) q.push(kids[ki]); } }catch(_){}
            try{ var els=cur.getElements?cur.getElements():[]; if(els&&els.length){ for(var ei=0;ei<els.length;ei++) q.push(els[ei]); } }catch(_){}
        }
        return false;
    }
    function applyImage(target,src){
        var f=new File(src); if(!f.exists) return false;
        var q=[target], seen={};
        while(q.length){
            var cur=q.shift(); if(!cur||!cur.isValid) continue;
            var idKey=""; try{idKey=String(cur.id);}catch(_){}
            if(idKey && seen[idKey]) continue; if(idKey) seen[idKey]=true;
            try{ if(cur.allGraphics&&cur.allGraphics.length){ try{cur.allGraphics.everyItem().remove();}catch(_rg){} } }catch(_){}
            try{ var placed=cur.place(f); if(placed){ try{cur.fit(FitOptions.PROPORTIONALLY); cur.fit(FitOptions.CENTER_CONTENT);}catch(_rf){} return true; } }catch(_p){}
            try{ var kids=cur.pageItems; if(kids&&kids.length){ for(var ki=0;ki<kids.length;ki++) q.push(kids[ki]); } }catch(_){}
        }
        return false;
    }

    var pages=data && data.pages ? data.pages : [];
    if(!pages.length){ log("No pages."); return; }

    var oldH=doc.viewPreferences.horizontalMeasurementUnits;
    var oldV=doc.viewPreferences.verticalMeasurementUnits;
    var oldOrigin=doc.viewPreferences.rulerOrigin;
    doc.viewPreferences.horizontalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits=MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.rulerOrigin=RulerOrigin.PAGE_ORIGIN;

    for(var pi=0; pi<pages.length; pi++){
        var info=pages[pi];
        var page;
        if(info.master){
            page=doc.pages.add(LocationOptions.AT_END);
            try{ page.appliedMaster=doc.masterSpreads.itemByName(info.master); }catch(e){ log("Master not found:"+info.master); continue; }
            // override all master pageItems and collect labeled on page
            var slotItems=[];
            try{
                var mSpread2 = doc.masterSpreads.itemByName(info.master);
                var mPage = mSpread2.pages[0];
                var mItems = mPage.pageItems;
                // Override each master item individually and fix offset
                for(var mi=0; mi<mItems.length; mi++){
                    var mItem = mItems[mi];
                    try{
                        if(mItem.allowOverrides){
                            var origBounds = mItem.geometricBounds;
                            var ovr = mItem.override(page);
                            // Fix override offset by restoring original bounds
                            try{ ovr.geometricBounds = origBounds; }catch(_fb){}
                            if(ovr && ovr.label && ovr.label !== ""){
                                slotItems.push(ovr);
                            }
                        }
                    }catch(_ov){}
                }
                // Also check page items that may already exist
                var pItems=page.pageItems;
                for(var pi2=0; pi2<pItems.length; pi2++){
                    var pIt=pItems[pi2];
                    if(pIt.label && pIt.label!==""){
                        // Check if already in slotItems (ExtendScript has no indexOf)
                        var found = false;
                        for(var si2=0; si2<slotItems.length; si2++){
                            if(slotItems[si2] === pIt){ found = true; break; }
                        }
                        if(!found) slotItems.push(pIt);
                    }
                }
            }catch(ovErr){ log("Override err:"+ovErr); }
            var items=info.items||[];
            for(var ii=0; ii<items.length; ii++){
                var it=items[ii];
                var key=it.slot||"";
                var normKey=normalize(key);
                var target=null;
                for(var si=0; si<slotItems.length; si++){
                    var s=slotItems[si];
                    var lab=s.label||"";
                    var sName=slotNameFromLabel(lab);
                    var nLab=normalize(lab), nName=normalize(sName);
                    // Priority 1: exact match on normalized label
                    if(nLab===normKey){ target=s; break; }
                    // Priority 2: exact match on extracted slot name
                    if(nName===normKey){ target=s; break; }
                }
                // Priority 3: substring match only if no exact match found
                if(!target && normKey){
                    for(var si2=0; si2<slotItems.length; si2++){
                        var s2=slotItems[si2];
                        var lab2=s2.label||"";
                        var nLab2=normalize(lab2);
                        // Match: "名称：XXX" pattern where XXX equals normKey
                        if(nLab2.indexOf("名称："+normKey)!==-1 || nLab2.indexOf("名称:"+normKey)!==-1){ target=s2; break; }
                    }
                }
                if(!target){ log("Slot not found:"+key+" on "+info.master); continue; }
                var work=target;
                try{ var elems=target.getElements?target.getElements():[]; if(elems && elems.length && elems[0].isValid) work=elems[0]; }catch(_){}
                try{
                    if(it.type==="IMAGE"){
                        if(it.src){ if(!applyImage(work,it.src)){ log("Image missing or place failed:"+it.src); } }
                    }else{
                        if(!applyText(work,it.content||"")){ log("Text fill failed:"+key); }
                    }
                }catch(fillErr){ log("Fill error "+key+": "+fillErr); }
            }
        }else if(info.template && String(info.template).toLowerCase()==="free"){
            page=doc.pages.add(LocationOptions.AT_END);
            var freeMaster = info.master || "F-自由页";
            if(freeMaster){ try{ page.appliedMaster=doc.masterSpreads.itemByName(freeMaster); }catch(_m){ log("Free master missing:"+freeMaster); } }
            var freeSlotItems=[];
            try{
                var fmSpread = doc.masterSpreads.itemByName(freeMaster);
                var fmPage = fmSpread.pages[0];
                var fmItems = fmPage.pageItems;
                // Override each master item individually and fix offset
                for(var fmi=0; fmi<fmItems.length; fmi++){
                    var fmItem = fmItems[fmi];
                    try{
                        if(fmItem.allowOverrides){
                            var fOrigBounds = fmItem.geometricBounds;
                            var fovr = fmItem.override(page);
                            // Fix override offset by restoring original bounds
                            try{ fovr.geometricBounds = fOrigBounds; }catch(_ffb){}
                            if(fovr && fovr.label && fovr.label !== ""){
                                freeSlotItems.push(fovr);
                            }
                        }
                    }catch(_fov){}
                }
                // Also check existing page items
                var pItems2=page.pageItems;
                for(var pf=0; pf<pItems2.length; pf++){
                    var pit=pItems2[pf];
                    if(pit.label && pit.label!==""){
                        // Check if already in freeSlotItems (ExtendScript has no indexOf)
                        var foundF = false;
                        for(var sf2=0; sf2<freeSlotItems.length; sf2++){
                            if(freeSlotItems[sf2] === pit){ foundF = true; break; }
                        }
                        if(!foundF) freeSlotItems.push(pit);
                    }
                }
            }catch(_ovF){}

            var free=info.items||[];
            var createdItems = []; // BUG-003 fix: collect items for zIndex sorting

            for(var fi=0; fi<free.length; fi++){
                var fItem=free[fi];
                if (fItem.slot && String(fItem.slot).length) {
                    var k=normalize(fItem.slot);
                    var targetFree=null;
                    // Priority 1 & 2: exact match
                    for(var sfi=0;sfi<freeSlotItems.length;sfi++){
                        var sf=freeSlotItems[sfi];
                        var sName=slotNameFromLabel(sf.label);
                        var nLab2=normalize(sf.label), nName2=normalize(sName);
                        if(nLab2===k || nName2===k){ targetFree=sf; break; }
                    }
                    // Priority 3: substring match with "名称：" prefix
                    if(!targetFree && k){
                        for(var sfi2=0;sfi2<freeSlotItems.length;sfi2++){
                            var sf2=freeSlotItems[sfi2];
                            var nLab3=normalize(sf2.label);
                            if(nLab3.indexOf("名称："+k)!==-1 || nLab3.indexOf("名称:"+k)!==-1){ targetFree=sf2; break; }
                        }
                    }
                    if(!targetFree){ log("Slot not found:"+fItem.slot+" on "+freeMaster); continue; }
                    var workF=targetFree;
                    try{ var elemsF=targetFree.getElements?targetFree.getElements():[]; if(elemsF && elemsF.length && elemsF[0].isValid) workF=elemsF[0]; }catch(_){}
                    try{
                        if(fItem.type==="IMAGE"){
                            if(fItem.src){ if(!applyImage(workF,fItem.src)){ log("Free slot image missing:"+fItem.src);} }
                        } else {
                            if(!applyText(workF, fItem.content||"")){ log("Free text fill failed:"+fItem.slot); }
                        }
                    }catch(errSlot){ log("Free slot fill error "+fItem.slot+": "+errSlot); }
                    continue;
                }

                // BUG-005 fix: validate bounds before use
                if(!fItem.bounds || typeof fItem.bounds !== 'object'){
                    log("Free item missing valid bounds: "+JSON.stringify(fItem));
                    continue;
                }
                var gb=boundsToMM(fItem.bounds);
                if(!gb || gb.length !== 4){
                    log("Invalid bounds conversion: "+JSON.stringify(fItem.bounds));
                    continue;
                }

                var created=null;
                if(fItem.type==="TEXT"){
                    var tf=page.textFrames.add(); tf.geometricBounds=gb; tf.contents=fItem.content||"";
                    try{ if(fItem.paragraphStyle) tf.appliedParagraphStyle=doc.paragraphStyles.itemByName(fItem.paragraphStyle); if(fItem.characterStyle) tf.appliedCharacterStyle=doc.characterStyles.itemByName(fItem.characterStyle); if(fItem.objectStyle) tf.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle); }catch(_s){}
                    created=tf;
                }else if(fItem.type==="IMAGE"){
                    var rect=page.rectangles.add(); rect.geometricBounds=gb;
                    try{ if(fItem.objectStyle) rect.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle); }catch(_os){}
                    if(fItem.src){ if(!applyImage(rect,fItem.src)){ log("Free image missing:"+fItem.src); } }
                    created=rect;
                }

                // BUG-003 fix: collect for zIndex sorting instead of immediate zOrder
                if(created){
                    createdItems.push({
                        item: created,
                        zIndex: fItem.zIndex !== undefined ? Number(fItem.zIndex) : 0
                    });
                }
            }

            // BUG-003 fix: sort by zIndex and apply proper stacking order
            if(createdItems.length > 0){
                createdItems.sort(function(a, b){ return a.zIndex - b.zIndex; });
                // First send all to back
                for(var zi=0; zi<createdItems.length; zi++){
                    try{ createdItems[zi].item.sendToBack(); }catch(_){}
                }
                // Then bring forward in order (lowest zIndex stays at back, highest at front)
                for(var zi=0; zi<createdItems.length; zi++){
                    try{ createdItems[zi].item.bringToFront(); }catch(_){}
                }
            }
        }
    }

    doc.viewPreferences.horizontalMeasurementUnits=oldH;
    doc.viewPreferences.verticalMeasurementUnits=oldV;
    doc.viewPreferences.rulerOrigin=oldOrigin;
    try{ doc.insertLabel("build_last_result", "Build done. Messages: "+messages.join(" | ")); }catch(_){}
    app.scriptPreferences.userInteractionLevel=uiOld;
})();
