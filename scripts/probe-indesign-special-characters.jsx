// 探针：向 InDesign 问清楚 SpecialCharacters 枚举的全部成员。
// 对每个成员：插进临时文档 → 整段读回拿真实 Unicode → 单字读回看它给的是什么。
// 第二段：把第一段拿到的每个 Unicode 当普通文字写进去（正向构建就是这么写的），
// 再单字读回，确认哪些会被 InDesign 换成代号。临时文档不保存。
(function () {
    function hex(code) {
        var h = code.toString(16).toUpperCase();
        while (h.length < 4) h = "0" + h;
        return "U+" + h;
    }
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
    function obj(o) {
        var parts = [];
        for (var k in o) {
            if (!o.hasOwnProperty(k)) continue;
            var v = o[k];
            if (v instanceof Array) {
                var arr = [];
                for (var i = 0; i < v.length; i++) arr.push(quote(v[i]));
                parts.push(quote(k) + ":[" + arr.join(",") + "]");
            } else if (typeof v === "number") {
                parts.push(quote(k) + ":" + v);
            } else {
                parts.push(quote(k) + ":" + quote(v));
            }
        }
        return "{" + parts.join(",") + "}";
    }

    var names = [], seen = {};
    try {
        var props = SpecialCharacters.reflect.properties;
        for (var i = 0; i < props.length; i++) {
            var n = String(props[i].name);
            if (n === "reflect" || n === "prototype" || n === "__proto__" || seen[n]) continue;
            seen[n] = true;
            names.push(n);
        }
    } catch (_) {}

    var previous = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    var doc = app.documents.add();
    var enumRows = [], textRows = [];
    try {
        var frame = doc.pages[0].textFrames.add();
        frame.geometricBounds = [10, 10, 180, 180];
        var story = frame.parentStory;

        // 第一段：按枚举成员插入
        var codeSet = {}, codeList = [];
        for (var j = 0; j < names.length; j++) {
            var rec = { name: names[j] };
            try {
                story.contents = "[";
                story.insertionPoints[-1].contents = SpecialCharacters[names[j]];
                story.insertionPoints[-1].contents = "]";
                var whole = String(story.contents);
                var a = whole.indexOf("["), b = whole.lastIndexOf("]");
                var mid = (a >= 0 && b > a) ? whole.substring(a + 1, b) : whole;
                var codes = [];
                for (var k = 0; k < mid.length; k++) codes.push(hex(mid.charCodeAt(k)));
                rec.codes = codes;
                rec.charCount = story.characters.length;
                if (story.characters.length >= 3) {
                    var single = story.characters[1].contents;
                    rec.singleType = typeof single;
                    rec.single = String(single);
                }
                if (mid.length === 1 && !codeSet[mid]) { codeSet[mid] = true; codeList.push(mid); }
            } catch (e) {
                rec.error = String(e.message || e);
            }
            enumRows.push(obj(rec));
        }

        // 第二段：把拿到的字符当普通文字写入（正向构建的写法），再单字读回
        for (var m = 0; m < codeList.length; m++) {
            var row = { code: hex(codeList[m].charCodeAt(0)) };
            try {
                story.contents = "[" + codeList[m] + "]";
                var one = story.characters[1].contents;
                row.singleType = typeof one;
                row.single = String(one);
                row.charCount = story.characters.length;
            } catch (e2) {
                row.error = String(e2.message || e2);
            }
            textRows.push(obj(row));
        }
    } finally {
        doc.close(SaveOptions.NO);
        app.scriptPreferences.userInteractionLevel = previous;
    }
    return "{\"version\":" + quote(app.version) + ",\"enumCount\":" + names.length
        + ",\"enum\":[" + enumRows.join(",") + "],\"asText\":[" + textRows.join(",") + "]}";
})();
