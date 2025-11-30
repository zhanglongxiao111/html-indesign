/**
 * extract_blueprint.jsx
 * V7: Composite fonts, Circle Numbering (①②③), paragraph spacing
 */
(function() {
    if (app.documents.length === 0) return "Error: No documents open";
    var doc = app.activeDocument;
    var oH = doc.viewPreferences.horizontalMeasurementUnits;
    var oV = doc.viewPreferences.verticalMeasurementUnits;
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;

    function clean(s){if(s==null)return"";var r="";for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c>=32||c==10||c==13||c==9)r+=s.charAt(i);}return r;}
    function q(s){if(s==null)return'""';return'"'+clean(s.toString()).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,' ')+'"';}
    
    // Improved color resolution
    function hex(c){
        if(!c||!c.isValid)return null;
        try{
            if(c.colorValue){
                var v=c.colorValue,sp=c.space;
                if(sp===ColorSpace.RGB)return"#"+((1<<24)+(Math.round(v[0])<<16)+(Math.round(v[1])<<8)+Math.round(v[2])).toString(16).slice(1);
                if(sp===ColorSpace.CMYK||sp===1129142603){
                    var k=v[3]/100;
                    var r=Math.round(255*(1-v[0]/100)*(1-k));
                    var g=Math.round(255*(1-v[1]/100)*(1-k));
                    var b=Math.round(255*(1-v[2]/100)*(1-k));
                    return"#"+((1<<24)+((r<0?0:r)<<16)+((g<0?0:g)<<8)+(b<0?0:b)).toString(16).slice(1);
                }
            }
            if(c.name){
                if(c.name==="None"||c.name==="Text Color")return null;
                if(c.name==="Paper")return"#ffffff";
                try{
                    var nc=doc.colors.itemByName(c.name);
                    if(nc.isValid&&nc.colorValue){
                        var v=nc.colorValue,sp=nc.space;
                        if(sp===ColorSpace.CMYK||sp===1129142603){
                            var k=v[3]/100;
                            var r=Math.round(255*(1-v[0]/100)*(1-k));
                            var g=Math.round(255*(1-v[1]/100)*(1-k));
                            var b=Math.round(255*(1-v[2]/100)*(1-k));
                            return"#"+((1<<24)+((r<0?0:r)<<16)+((g<0?0:g)<<8)+(b<0?0:b)).toString(16).slice(1);
                        }
                    }
                }catch(e){}
            }
        }catch(e){}
        return null;
    }
    
    function vj(v){switch(v){case VerticalJustification.TOP_ALIGN:return"flex-start";case VerticalJustification.CENTER_ALIGN:return"center";case VerticalJustification.BOTTOM_ALIGN:return"flex-end";default:return"space-between";}}
    function tj(j){switch(j){case Justification.LEFT_ALIGN:return"left";case Justification.CENTER_ALIGN:return"center";case Justification.RIGHT_ALIGN:return"right";default:return"justify";}}

    // Get font info including composite font details
    function fontInfo(af){
        if(!af||!af.isValid)return null;
        var info={};
        try{
            var fullName=af.name||"";
            var parts=fullName.split("\t");
            info.family=parts[0];
            info.style=parts[1]||"Regular";
            // Check if it's a composite font
            info.isComposite=(af.constructor&&af.constructor.name==="CompositeFont");
            if(info.isComposite){
                info.compositeName=parts[0];
            }
        }catch(e){}
        return info;
    }

    // Character Style CSS
    function csCSS(s){
        var c=[];
        try{
            var fi=fontInfo(s.appliedFont);
            if(fi)c.push("font-family:'"+fi.family+"',sans-serif");
            if(s.pointSize&&s.pointSize!==1851876449)c.push("font-size:"+s.pointSize+"pt");
            if(fi&&fi.style){
                if(fi.style.toLowerCase().indexOf("bold")!==-1)c.push("font-weight:bold");
                if(fi.style.toLowerCase().indexOf("italic")!==-1)c.push("font-style:italic");
            }
            var h=hex(s.fillColor);
            if(h)c.push("color:"+h);
        }catch(e){}
        return c.join("; ");
    }

    // CornerOptions.NONE = 1852796517, CornerOptions.ROUNDED_CORNER = 1667592804
    function osCSS(s){var c=[];try{if(s.enableFill){var f=hex(s.fillColor);if(f)c.push("background-color:"+f);}if(s.enableStroke&&s.strokeWeight>0){var sc=hex(s.strokeColor);if(sc)c.push("border:"+s.strokeWeight+"pt solid "+sc);}var r=s.topLeftCornerRadius;var co=s.topLeftCornerOption;if(r>0&&co!==1852796517)c.push("border-radius:"+r+"mm");var o=s.transparencySettings.blendingSettings.opacity;if(o<100)c.push("opacity:"+(o/100));if(s.enableTextFrameGeneralOptions){var t=s.textFramePreferences,i=t.insetSpacing;if(i[0]>0||i[1]>0||i[2]>0||i[3]>0)c.push("padding:"+i[0]+"mm "+i[1]+"mm "+i[2]+"mm "+i[3]+"mm");if(t.textColumnCount>1){c.push("column-count:"+t.textColumnCount);c.push("column-gap:"+t.textColumnGutter+"mm");}}}catch(e){}return c.join("; ");}

    // ListType: 1280598644=Bullet, 1280601709=Numbered
    function listType(t){if(t===1280598644)return"bullet";if(t===1280601709)return"numbered";return"none";}
    
    function psCSS(s){
        var c=[];
        try{
            var fi=fontInfo(s.appliedFont);
            if(fi){
                c.push("font-family:'"+fi.family+"',sans-serif");
                if(fi.style){
                    if(fi.style.toLowerCase().indexOf("bold")!==-1)c.push("font-weight:bold");
                    else if(fi.style.toLowerCase().indexOf("light")!==-1)c.push("font-weight:300");
                }
            }
            if(s.pointSize)c.push("font-size:"+s.pointSize+"pt");
            if(s.leading&&s.leading!==1635019116)c.push("line-height:"+s.leading+"pt");
            if(s.tracking&&s.tracking!==0)c.push("letter-spacing:"+(s.tracking/1000)+"em");
            c.push("text-align:"+tj(s.justification));
            var h=hex(s.fillColor);
            if(h)c.push("color:"+h);
            // Paragraph spacing - crucial for proper rendering
            if(s.spaceBefore>0)c.push("margin-top:"+s.spaceBefore+"pt");
            if(s.spaceAfter>0)c.push("margin-bottom:"+s.spaceAfter+"pt");
            // Indentation
            if(s.firstLineIndent&&s.firstLineIndent!==0)c.push("text-indent:"+s.firstLineIndent+"pt");
            if(s.leftIndent>0)c.push("padding-left:"+s.leftIndent+"pt");
            if(s.rightIndent>0)c.push("padding-right:"+s.rightIndent+"pt");
        }catch(e){}
        return c.join("; ");
    }
    
    function psExtra(s){
        var e={};
        try{
            // Font info for composite font detection
            var fi=fontInfo(s.appliedFont);
            if(fi&&fi.isComposite){
                e.compositeFont=fi.compositeName;
            }
            
            // Drop cap
            if(s.dropCapCharacters>0){
                e.dropCap={chars:s.dropCapCharacters,lines:s.dropCapLines};
                if(s.dropCapStyle&&s.dropCapStyle.isValid&&s.dropCapStyle.name.indexOf("[")===-1){
                    e.dropCap.style=s.dropCapStyle.name;
                    e.dropCap.styleCSS=csCSS(s.dropCapStyle);
                }
            }
            
            // List (bullet or numbered)
            var lt=listType(s.bulletsAndNumberingListType);
            if(lt!=="none"){
                e.list={type:lt};
                if(lt==="bullet"){
                    e.list.charCode=s.bulletChar.characterValue;
                    // Extract bullet character style
                    try{
                        if(s.bulletsCharacterStyle && s.bulletsCharacterStyle.isValid && s.bulletsCharacterStyle.name !== "[无]"){
                            e.list.charStyle=s.bulletsCharacterStyle.name;
                            e.list.charStyleCSS=csCSS(s.bulletsCharacterStyle);
                        }
                    }catch(ex){}
                }else{
                    e.list.format=s.numberingFormat;
                    // Check for Circle Numbering (①②③)
                    if(s.numberingFormat==="Circle Numbering"){
                        e.list.isCircle=true;
                    }
                    // Extract numbering character style
                    try{
                        if(s.numberingCharacterStyle && s.numberingCharacterStyle.isValid && s.numberingCharacterStyle.name !== "[无]"){
                            e.list.charStyle=s.numberingCharacterStyle.name;
                            e.list.charStyleCSS=csCSS(s.numberingCharacterStyle);
                        }
                    }catch(ex){}
                }
            }
            
            // GREP styles - for automatic character styling based on patterns
            try{
                var grepStyles=s.nestedGrepStyles;
                if(grepStyles&&grepStyles.length>0){
                    e.grepStyles=[];
                    for(var i=0;i<grepStyles.length;i++){
                        var gs=grepStyles[i];
                        var gInfo={};
                        gInfo.pattern=gs.grepExpression||"";
                        if(gs.appliedCharacterStyle&&gs.appliedCharacterStyle.isValid){
                            gInfo.charStyle=gs.appliedCharacterStyle.name;
                            gInfo.charStyleCSS=csCSS(gs.appliedCharacterStyle);
                        }
                        e.grepStyles.push(gInfo);
                    }
                }
            }catch(gex){}
            
            // Nested styles - for character styling based on delimiters
            try{
                var nestedStyles=s.nestedStyles;
                if(nestedStyles&&nestedStyles.length>0){
                    e.nestedStyles=[];
                    for(var i=0;i<nestedStyles.length;i++){
                        var ns=nestedStyles[i];
                        var nInfo={};
                        nInfo.repetition=ns.repetition||1;
                        nInfo.delimiter=ns.delimiter||0;
                        if(ns.appliedCharacterStyle&&ns.appliedCharacterStyle.isValid){
                            nInfo.charStyle=ns.appliedCharacterStyle.name;
                            nInfo.charStyleCSS=csCSS(ns.appliedCharacterStyle);
                        }
                        e.nestedStyles.push(nInfo);
                    }
                }
            }catch(nex){}
        }catch(ex){}
        return e;
    }

    // Composite fonts - extract font weight from fontStyle for each entry
    var cfp=[];
    for(var i=0;i<doc.compositeFonts.length;i++){
        var cf=doc.compositeFonts[i];
        if(cf.name.indexOf("[")===0)continue;
        var entries=[];
        var hasBoldCJK=false;
        var cjkWeight="normal";
        var romanWeight="normal";
        for(var j=0;j<cf.compositeFontEntries.length;j++){
            var entry=cf.compositeFontEntries[j];
            try{
                var fontStyle=entry.fontStyle||"Regular";
                var weight="normal";
                if(fontStyle.toLowerCase().indexOf("bold")!==-1)weight="bold";
                else if(fontStyle.toLowerCase().indexOf("heavy")!==-1)weight="bold";
                else if(fontStyle.toLowerCase().indexOf("black")!==-1)weight="900";
                else if(fontStyle.toLowerCase().indexOf("light")!==-1)weight="300";
                else if(fontStyle.toLowerCase().indexOf("thin")!==-1)weight="100";
                // Track CJK and Roman weights
                if(entry.name==="汉字"){cjkWeight=weight;if(weight==="bold")hasBoldCJK=true;}
                if(entry.name==="罗马字")romanWeight=weight;
                entries.push('{"name":'+q(entry.name)+',"fontStyle":'+q(fontStyle)+',"size":'+entry.relativeSize+',"weight":"'+weight+'"}');
            }catch(e){}
        }
        cfp.push(q(cf.name)+': {"name":'+q(cf.name)+',"hasBoldCJK":'+hasBoldCJK+',"cjkWeight":"'+cjkWeight+'","romanWeight":"'+romanWeight+'","entries":['+entries.join(',')+']}');
    }

    // Character styles
    var csp=[];
    for(var i=0;i<doc.allCharacterStyles.length;i++){
        var s=doc.allCharacterStyles[i];
        if(s.name.indexOf("[")==0)continue;
        var n=s.name.replace(/[\[\]]/g,'').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g,'-');
        csp.push(q(s.name)+': { "name":'+q(s.name)+', "safeName":'+q(n)+', "css":'+q(csCSS(s))+' }');
    }

    // Object styles
    var osp=[];
    for(var i=0;i<doc.allObjectStyles.length;i++){
        var s=doc.allObjectStyles[i];
        var n=s.name.replace(/[\[\]]/g,'').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g,'-');
        osp.push(q(s.name)+': { "name":'+q(s.name)+', "safeName":'+q(n)+', "css":'+q(osCSS(s))+' }');
    }
    
    // Paragraph styles
    var psp=[];
    for(var i=0;i<doc.allParagraphStyles.length;i++){
        var s=doc.allParagraphStyles[i];
        var n=s.name.replace(/[\[\]]/g,'').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g,'-');
        var ex=psExtra(s);
        var exParts=[];
        if(ex.compositeFont)exParts.push('"compositeFont":'+q(ex.compositeFont));
        if(ex.dropCap)exParts.push('"dropCap":{"chars":'+ex.dropCap.chars+',"lines":'+ex.dropCap.lines+(ex.dropCap.style?',"style":'+q(ex.dropCap.style)+',"styleCSS":'+q(ex.dropCap.styleCSS):'')+'}');
        if(ex.list){
            var listParts=['"type":'+q(ex.list.type)];
            if(ex.list.charCode)listParts.push('"charCode":'+ex.list.charCode);
            if(ex.list.format)listParts.push('"format":'+q(ex.list.format));
            if(ex.list.isCircle)listParts.push('"isCircle":true');
            if(ex.list.charStyle)listParts.push('"charStyle":'+q(ex.list.charStyle));
            if(ex.list.charStyleCSS)listParts.push('"charStyleCSS":'+q(ex.list.charStyleCSS));
            exParts.push('"list":{'+listParts.join(',')+'}');
        }
        if(ex.grepStyles&&ex.grepStyles.length>0){
            var gsParts=[];
            for(var gi=0;gi<ex.grepStyles.length;gi++){
                var gs=ex.grepStyles[gi];
                var gp=['"pattern":'+q(gs.pattern)];
                if(gs.charStyle)gp.push('"charStyle":'+q(gs.charStyle));
                if(gs.charStyleCSS)gp.push('"charStyleCSS":'+q(gs.charStyleCSS));
                gsParts.push('{'+gp.join(',')+'}');
            }
            exParts.push('"grepStyles":['+gsParts.join(',')+']');
        }
        if(ex.nestedStyles&&ex.nestedStyles.length>0){
            var nsParts=[];
            for(var ni=0;ni<ex.nestedStyles.length;ni++){
                var ns=ex.nestedStyles[ni];
                var np=['"repetition":'+ns.repetition,'"delimiter":'+ns.delimiter];
                if(ns.charStyle)np.push('"charStyle":'+q(ns.charStyle));
                if(ns.charStyleCSS)np.push('"charStyleCSS":'+q(ns.charStyleCSS));
                nsParts.push('{'+np.join(',')+'}');
            }
            exParts.push('"nestedStyles":['+nsParts.join(',')+']');
        }
        var exStr=exParts.length>0?', '+exParts.join(', '):'';
        psp.push(q(s.name)+': { "name":'+q(s.name)+', "safeName":'+q(n)+', "css":'+q(psCSS(s))+exStr+' }');
    }

    var mp=[];for(var i=0;i<doc.masterSpreads.length;i++){var m=doc.masterSpreads[i];if(!m.name)continue;var pb=m.pages[0].bounds,pW=pb[3]-pb[1],pH=pb[2]-pb[0];var slp=[],stp=[];
    // Get total items count for inverting z-index (last item in list = top layer in InDesign)
    var totalItems=m.allPageItems.length;
    for(var j=0;j<totalItems;j++){var it=m.allPageItems[j];
    // Skip embedded graphics (Image, PDF, EPS) - they're children of frame objects
    if(it instanceof Image||it instanceof PDF||it instanceof EPS)continue;
    var lb=it.label,iS=(lb&&lb!=="");var b=it.geometricBounds;var d=[];d.push('"id":'+q(it.id.toString()));
    // Invert z-index: item 0 should have lowest z-index, last item highest (InDesign draws bottom to top)
    d.push('"zIndex":'+(totalItems-1-j));
    if(iS)d.push('"label":'+q(lb));try{if(it.appliedObjectStyle)d.push('"appliedObjectStyle":'+q(it.appliedObjectStyle.name));}catch(e){}
    var ty="RECT",ct="",css=[];if(it instanceof TextFrame){ty="TEXT";try{ct=it.contents||"";}catch(e){}try{if(it.paragraphs.length>0){var p=it.paragraphs[0];var ps=p.appliedParagraphStyle;d.push('"appliedParagraphStyle":'+q(ps.name));var hasGrepOrNested=(ps.nestedStyles.length>0||ps.nestedGrepStyles.length>0);var fi=fontInfo(p.appliedFont);var psFi=fontInfo(ps.appliedFont);var psFont=psFi?psFi.family:"";var pFont=fi?fi.family:"";if(hasGrepOrNested){if(fi&&pFont!==psFont){d.push('"firstLineFont":'+q(pFont));if(fi.isComposite)d.push('"firstLineFontComposite":true');}}else{if(fi&&pFont!==psFont)css.push("font-family:'"+pFont+"',sans-serif");var psSize=ps.pointSize||0;if(p.pointSize&&p.pointSize!==psSize)css.push("font-size:"+p.pointSize+"pt");var pBold=fi&&fi.style&&fi.style.toLowerCase().indexOf("bold")!==-1;var pLight=fi&&fi.style&&fi.style.toLowerCase().indexOf("light")!==-1;var psBold=psFi&&psFi.style&&psFi.style.toLowerCase().indexOf("bold")!==-1;var psLight=psFi&&psFi.style&&psFi.style.toLowerCase().indexOf("light")!==-1;if(pBold&&!psBold)css.push("font-weight:bold");else if(pLight&&!psLight)css.push("font-weight:300");var psLeading=ps.leading||0;if(p.leading&&p.leading!==1635019116&&p.leading!==psLeading)css.push("line-height:"+p.leading+"pt");var psTracking=ps.tracking||0;if(p.tracking&&p.tracking!==0&&p.tracking!==psTracking)css.push("letter-spacing:"+(p.tracking/1000)+"em");var pJust=tj(p.justification);var psJust=tj(ps.justification);if(pJust!==psJust)css.push("text-align:"+pJust);var pc=hex(p.fillColor);var psc=hex(ps.fillColor);if(pc&&pc!==psc)css.push("color:"+pc);}}var tf=it.textFramePreferences;if(tf.verticalJustification!==VerticalJustification.TOP_ALIGN){css.push("display:flex");css.push("flex-direction:column");css.push("justify-content:"+vj(tf.verticalJustification));}var ins=tf.insetSpacing;if(ins[0]>0||ins[1]>0||ins[2]>0||ins[3]>0)css.push("padding:"+ins[0]+"mm "+ins[1]+"mm "+ins[2]+"mm "+ins[3]+"mm");if(tf.textColumnCount>1){css.push("column-count:"+tf.textColumnCount);css.push("column-gap:"+tf.textColumnGutter+"mm");}}catch(e){}}else if(it instanceof Rectangle||it instanceof Oval||it instanceof Polygon){ty=(it.contentType===ContentType.GRAPHIC_TYPE)?"IMAGE":"RECT";try{var fc=hex(it.fillColor);if(fc)css.push("background-color:"+fc);if(it.strokeWeight>0){var sc=hex(it.strokeColor);if(sc)css.push("border:"+it.strokeWeight+"pt solid "+sc);}
// Extract embedded image info
if(ty==="IMAGE"&&it.allGraphics&&it.allGraphics.length>0){var gr=it.allGraphics[0];try{if(gr.itemLink&&gr.itemLink.filePath){d.push('"imagePath":'+q(gr.itemLink.filePath));}var gb=gr.geometricBounds;var gw=gb[3]-gb[1],gh=gb[2]-gb[0];d.push('"imageSize":{ "width":'+gw+', "height":'+gh+' }');var frameW=b[3]-b[1],frameH=b[2]-b[0];if(gw>frameW||gh>frameH)d.push('"imageCropped":true');}catch(ex){}}}catch(e){}}else{ty="LINE";try{if(it.strokeWeight>0){var lc=hex(it.strokeColor);if(lc)css.push("background-color:"+lc);css.push("height:"+it.strokeWeight+"pt");}}catch(e){}}
    d.push('"type":'+q(ty));d.push('"bounds":{ "x":'+b[1]+', "y":'+b[0]+', "width":'+(b[3]-b[1])+', "height":'+(b[2]-b[0])+' }');
    // Always output content field for TEXT type (empty string if no content)
    if(ty==="TEXT")d.push('"content":'+q(ct));
    if(css.length>0)d.push('"inlineCSS":'+q(css.join("; ")));var is='{ '+d.join(', ')+' }';if(iS)slp.push(q(lb)+': '+is);else stp.push(is);}
    mp.push(q(m.name)+': { "width":'+pW+', "height":'+pH+', "slots":{ '+slp.join(', ')+' }, "staticItems":[ '+stp.join(', ')+' ] }');}

    var now=new Date();var exportedAt=now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2)+'T'+('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2)+'Z';
    var json='{ "metadata":{ "documentName":'+q(doc.name)+', "exportedAt":'+q(exportedAt)+' }, "compositeFonts":{ '+cfp.join(', ')+' }, "characterStyles":{ '+csp.join(', ')+' }, "paragraphStyles":{ '+psp.join(', ')+' }, "objectStyles":{ '+osp.join(', ')+' }, "masters":{ '+mp.join(', ')+' } }';
    doc.viewPreferences.horizontalMeasurementUnits=oH;doc.viewPreferences.verticalMeasurementUnits=oV;
    var f=new File("D:/AI/html-indesign/test/artifacts/real_blueprint_v7.json");f.open("w");f.encoding="UTF-8";f.write(json);f.close();return"Success: "+f.fsName;
})();

