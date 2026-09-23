// 探针（issue #9）：人做的 INDD 里有渐变色板时，反向导出会整体崩溃。
// 本脚本新建一份临时文档，把渐变用在框填色、描边、文字、段落样式、字符样式、对象样式、表格上，
// 另放一个没用到的径向渐变和一个 40% 色调，然后向 InDesign 问清楚：
//   1. Gradient / Swatch / Tint 的 DOM 形状（构造名、type 枚举值、色标、colorValue）；
//   2. ExtendScript 缺陷：对 DOM 上不存在的属性写 if (!o.p) 等形式时，报错会不会绕过同函数的 try/catch。
// 结果以 JSON 字符串返回，存进 test/fixtures/indesign-gradient-swatches/。
// 调用方若在全局定义了 HI_GRADIENT_FIXTURE_SAVE_PATH（绝对路径），文档另存到该处供真机 e2e 使用；否则不保存直接关闭。
(function () {
    function quote(s) {
        s = String(s);
        var out = "\"";
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i), ch = s.charAt(i);
            if (ch === "\"" || ch === "\\") out += "\\" + ch;
            else if (c < 32 || c > 126) out += "\\u" + ("0000" + c.toString(16)).slice(-4);
            else out += ch;
        }
        return out + "\"";
    }
    function json(value) {
        if (value === null || typeof value === "undefined") return "null";
        if (typeof value === "number") return isFinite(value) ? String(value) : "null";
        if (typeof value === "boolean") return value ? "true" : "false";
        if (value instanceof Array) {
            var items = [];
            for (var i = 0; i < value.length; i++) items.push(json(value[i]));
            return "[" + items.join(",") + "]";
        }
        if (typeof value === "object") {
            var parts = [];
            for (var key in value) {
                if (value.hasOwnProperty(key)) parts.push(quote(key) + ":" + json(value[key]));
            }
            return "{" + parts.join(",") + "}";
        }
        return quote(value);
    }
    function kind(value) { try { return String(value.constructor.name); } catch (_) {} return null; }
    function read(target, name) {
        try { var value = target[name]; return { ok: true, value: value }; } catch (e) { return { ok: false, error: String(e) }; }
    }
    function numberList(value) {
        var out = [];
        try { for (var i = 0; i < value.length; i++) out.push(Number(value[i])); } catch (_) { return null; }
        return out;
    }
    function colorFact(color) {
        var name = read(color, "name"), colorValue = read(color, "colorValue"), space = read(color, "space");
        return {
            kind: kind(color),
            name: name.ok ? String(name.value) : null,
            space: space.ok ? Number(space.value) : null,
            colorValue: colorValue.ok ? numberList(colorValue.value) : null,
            colorValueError: colorValue.ok ? null : colorValue.error
        };
    }

    var result = { source: "InDesign 渐变色板探针（scripts/probe-indesign-gradient-swatches.jsx）", indesignVersion: String(app.version), steps: [] };
    var doc = app.documents.add(false);
    function step(name, fn) {
        try { fn(); result.steps.push({ name: name, ok: true }); } catch (e) { result.steps.push({ name: name, ok: false, error: String(e) }); }
    }

    var red, blue, grad, unused, tint, ps, cs, os;
    var page = doc.pages[0];
    step("colors", function () {
        red = doc.colors.add({ name: "G-Red", model: ColorModel.PROCESS, space: ColorSpace.CMYK, colorValue: [0, 100, 100, 0] });
        blue = doc.colors.add({ name: "G-Blue", model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: [0, 0, 255] });
    });
    step("gradients", function () {
        grad = doc.gradients.add({ name: "Grad-Used", type: GradientType.LINEAR });
        grad.gradientStops[0].stopColor = red;
        grad.gradientStops[1].stopColor = blue;
        unused = doc.gradients.add({ name: "Grad-Unused", type: GradientType.RADIAL });
    });
    step("tint", function () { tint = doc.tints.add(red, { tintValue: 40 }); });
    step("rect fill", function () { page.rectangles.add({ geometricBounds: [20, 20, 80, 120], fillColor: grad, strokeColor: "None" }); });
    step("rect stroke", function () { page.rectangles.add({ geometricBounds: [90, 20, 150, 120], fillColor: "None", strokeColor: grad, strokeWeight: 6 }); });
    step("oval tint", function () { page.ovals.add({ geometricBounds: [160, 20, 200, 60], fillColor: tint }); });
    // 样式名用中文：真机 e2e 的二次回环会拦下仍含英文的面板名。
    step("paragraph style", function () { ps = doc.paragraphStyles.add({ name: "渐变段落", fillColor: grad, pointSize: 24 }); });
    step("character style", function () { cs = doc.characterStyles.add({ name: "渐变字符", fillColor: grad }); });
    step("object style", function () { os = doc.objectStyles.add({ name: "渐变对象", enableFill: true, fillColor: grad, enableStroke: true, strokeColor: grad, strokeWeight: 2 }); });
    step("text frame", function () {
        var tf = page.textFrames.add({ geometricBounds: [20, 140, 80, 200], contents: "Gradient text\rSecond para" });
        tf.paragraphs[0].appliedParagraphStyle = ps;
        tf.paragraphs[1].fillColor = grad;
        tf.paragraphs[1].strokeColor = grad;
        tf.paragraphs[1].characters[0].appliedCharacterStyle = cs;
    });
    step("object styled rect", function () { var r = page.rectangles.add({ geometricBounds: [160, 140, 200, 200] }); r.appliedObjectStyle = os; });
    step("table", function () {
        var tf = page.textFrames.add({ geometricBounds: [90, 140, 150, 200] });
        var t = tf.insertionPoints[0].tables.add({ bodyRowCount: 2, columnCount: 2 });
        t.cells[0].contents = "A"; t.cells[1].contents = "B"; t.cells[2].contents = "C";
        t.cells[0].fillColor = grad;
        t.cells[1].texts[0].fillColor = grad;
        t.cells[2].topEdgeStrokeColor = grad; t.cells[2].topEdgeStrokeWeight = 2;
    });

    try {
        result.gradientType = { LINEAR: Number(GradientType.LINEAR), RADIAL: Number(GradientType.RADIAL) };
        var gradients = [grad, unused];
        result.gradients = [];
        for (var g = 0; g < gradients.length; g++) {
            var stops = [], stopItems = gradients[g].gradientStops;
            for (var s = 0; s < stopItems.length; s++) {
                var midpoint = read(stopItems[s], "midpoint");
                stops.push({ location: Number(stopItems[s].location), midpoint: midpoint.ok ? Number(midpoint.value) : null, midpointError: midpoint.ok ? null : midpoint.error, stopColor: colorFact(stopItems[s].stopColor) });
            }
            var gv = read(gradients[g], "colorValue");
            result.gradients.push({ kind: kind(gradients[g]), name: String(gradients[g].name), type: Number(gradients[g].type), colorValueReadable: gv.ok, colorValueError: gv.ok ? null : gv.error, stops: stops });
        }
        var swatch = doc.swatches.itemByName("Grad-Used");
        result.swatchWrapper = { kind: kind(swatch), resolvedKind: kind(swatch.getElements()[0]) };
        result.tint = { kind: kind(tint), tintValue: Number(tint.tintValue), baseColor: String(tint.baseColor.name), color: colorFact(tint) };
        result.styles = {
            paragraphFill: kind(ps.fillColor),
            characterFill: kind(cs.fillColor),
            objectFill: kind(os.fillColor),
            objectStroke: kind(os.strokeColor),
            paragraphGradientFillAngle: Number(ps.gradientFillAngle)
        };
        result.pageItems = [];
        var items = page.allPageItems;
        for (var i = 0; i < items.length; i++) {
            var fill = read(items[i], "fillColor"), stroke = read(items[i], "strokeColor"), angle = read(items[i], "gradientFillAngle");
            result.pageItems.push({
                kind: kind(items[i]),
                fillKind: fill.ok ? kind(fill.value) : null,
                fillName: fill.ok ? String(fill.value.name) : null,
                strokeKind: stroke.ok ? kind(stroke.value) : null,
                gradientFillAngle: angle.ok ? Number(angle.value) : null
            });
        }
    } catch (factError) {
        result.factError = String(factError);
    }

    // 缺陷探测：每种写法都包在自己的 try/catch 里；外层再兜一层，记录报错是否“逃逸”出内层 try/catch。
    var forms = [
        ["if (!o.p) return", function (c) { try { if (!c.colorValue) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["if (!(o.p)) return", function (c) { try { if (!(c.colorValue)) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["if (!o.p) { block }", function (c) { var r = "value"; try { if (!c.colorValue) { r = "negated"; } } catch (_) { r = "caught"; } return r; }],
        ["return !o.p", function (c) { try { return !c.colorValue; } catch (_) { return "caught"; } }],
        ["!o.p ? a : b", function (c) { try { return !c.colorValue ? "negated" : "value"; } catch (_) { return "caught"; } }],
        ["while (!o.p)", function (c) { try { while (!c.colorValue) { return "negated"; } } catch (_) { return "caught"; } return "value"; }],
        ["if (a || !o.p)", function (c) { try { if (!c || !c.colorValue) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["if (a && !o.p)", function (c) { try { if (c && !c.colorValue) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["var v = o.p; if (!v)", function (c) { try { var v = c.colorValue; if (!v) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["var b = !o.p", function (c) { try { var b = !c.colorValue; return "b=" + b; } catch (_) { return "caught"; } }],
        ["if (o.p == null)", function (c) { try { if (c.colorValue == null) return "negated"; return "value"; } catch (_) { return "caught"; } }],
        ["if (o.p)", function (c) { try { if (c.colorValue) return "value"; return "negated"; } catch (_) { return "caught"; } }]
    ];
    result.tryCatchBypass = [];
    for (var f = 0; f < forms.length; f++) {
        var entry = { form: forms[f][0] };
        try { entry.outcome = String(forms[f][1](grad)); entry.escaped = false; } catch (escapedError) { entry.outcome = String(escapedError); entry.escaped = true; }
        result.tryCatchBypass.push(entry);
    }

    var savePath = typeof HI_GRADIENT_FIXTURE_SAVE_PATH === "string" ? HI_GRADIENT_FIXTURE_SAVE_PATH : "";
    if (savePath) step("save", function () { doc.save(File(savePath)); });
    try { doc.close(SaveOptions.NO); } catch (_) {}
    return json(result);
})();
