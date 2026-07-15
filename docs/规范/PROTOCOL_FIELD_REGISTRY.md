# 协议字段注册表

本文件由 `src/protocol/docs/generate-field-docs.js` 从协议字段注册表和能力矩阵生成。
字段事实以 registry 为准；本文件只记录生成结果，不维护第二份字段清单。
分节名对应 `fieldClass`，`retired` 分节按 `lifecycle=retired` 收拢退役字段。

## canonical

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| assets[].kind | assets[].kind, items[].asset.kind, sourceNode.attributes.data-id-asset-kind | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| assets[].path | assets[].src, assets[].resolvedPath, items[].asset.path | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData; risk=external-link-policy) | n/a |
| document.coordinateUnit | coordinateUnit, labels[].coordinateUnit | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| document.id | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| document.profile | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| document.title | title, labels[].title | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| document.unitMode | unitMode, labels[].unitMode | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].asset.placement.artboard | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.height | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.scaleX | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.scaleY | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.width | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.x | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.contentBox.y | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.crop | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.fit | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.hiddenLayers | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.layerComp | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.pageNumber | items[].asset.pageNumber, instructions.pages[].items[].placed.pageNumber | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image; risk=editable-loss) | n/a |
| items[].asset.placement.preserveVector | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.transparentBackground | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].asset.placement.visibleLayers | n/a | asset-placement | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) | n/a |
| items[].authoring.gridIgnore | sourceNode.attributes.data-id-grid-ignore, sourceAncestorNodes[].attributes.data-id-grid-ignore, labels[].sourceAncestorNodes[].attributes.data-id-grid-ignore, pages[].items[].sourceNode.attributes.data-id-grid-ignore, pages[].items[].sourceAncestorNodes[].attributes.data-id-grid-ignore | html-authoring | active | native/native/native | observe-only/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].authoring.guideIgnore | sourceNode.attributes.data-id-guide-ignore, pages[].items[].sourceNode.attributes.data-id-guide-ignore | html-authoring | active | native/native/native | observe-only/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].bounds | pages[].items[].bounds | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | Absolute page coordinates for the item bounds, measured in pt.; contract=coordinateSystem:absolute-page, unit:pt |
| items[].content.runs | items[].textRuns | text-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) | n/a |
| items[].content.runs[].text | n/a | reverse-model | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) | n/a |
| items[].content.text | items[].text, instructions.pages[].items[].text | text-content | active | native/native/native | native/native/native | unsupported/native/lossless | n/a |
| items[].layout | pages[].items[].layout, items[].effectiveLabel.layout | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].objectPolicy.forceObject | sourceNode.attributes.data-id-object, labels[].sourceNode.attributes.data-id-object, pages[].items[].sourceNode.attributes.data-id-object | html-authoring | active | native/native/native | observe-only/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].objectPolicy.ignore | sourceNode.attributes.data-id-ignore, labels[].sourceNode.attributes.data-id-ignore, pages[].items[].sourceNode.attributes.data-id-ignore | html-authoring | active | native/native/native | observe-only/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].placement | sourceNode.attributes.data-id-placement, pages[].items[].sourceNode.attributes.data-id-placement, pages[].items[].placement, pages[].parentPageItems[].placement, parentPages[].items[].placement | html-authoring | active | native/native/native | observe-only/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].role | labels[].role, items[].effectiveLabel.role | label-protocol | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | Canonical semantic role for an item. |
| items[].semantic | labels[].semantic, items[].effectiveLabel.semantic | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | Canonical item semantic token. Defaults to null when no accepted semantic is present.; default=null |
| items[].styleOverrides | labels[].styleOverrides, reverseModel.pages[].items[].styleOverrides | synthesized-styles | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs | labels[].styleRefs, items[].effectiveLabel.styleRefs | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | Canonical style reference object; only registered allowedKeys are valid styleRefs members.; allowedKeys=paragraphStyle, characterStyle, objectStyle, frameStyle, tableStyle, cellStyle, paragraphStyleDisplayName, characterStyleDisplayName, objectStyleDisplayName, frameStyleDisplayName, tableStyleDisplayName, displayName, genericStyle, synthesizedToken, synthesizedName, layer |
| items[].styleRefs.cellStyle | items[].cellStyle, labels[].cellStyle, labels[].cellStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.characterStyle | items[].characterStyle, items[].content.runs[].characterStyle, labels[].characterStyle, labels[].characterStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.characterStyleDisplayName | items[].characterStyleName, sourceNode.attributes.data-id-character-style-name | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.displayName | items[].styleRefs.styleName | style-refs | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.frameStyle | items[].frameStyle, labels[].frameStyle, labels[].frameStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.frameStyleDisplayName | items[].frameStyleName, sourceNode.attributes.data-id-frame-style-name | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.genericStyle | items[].styleRefs.style, sourceNode.attributes.data-id-style | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.layer | items[].layer, items[].layerToken, labels[].layer, labels[].layerToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.objectStyle | items[].objectStyle, labels[].objectStyle, labels[].objectStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.objectStyleDisplayName | items[].objectStyleName, sourceNode.attributes.data-id-object-style-name | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.paragraphStyle | items[].paragraphStyle, labels[].paragraphStyle, labels[].paragraphStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.paragraphStyleDisplayName | items[].paragraphStyleName, sourceNode.attributes.data-id-paragraph-style-name | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.synthesizedName | labels[].styleRefs.synthesizedName, sourceNode.attributes.data-id-style-name | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.synthesizedToken | labels[].styleRefs.synthesizedToken, sourceNode.attributes.data-id-style-token | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.tableStyle | items[].table.tableStyle, labels[].tableStyle, labels[].tableStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].styleRefs.tableStyleDisplayName | items[].tableStyleName, sourceNode.attributes.data-id-table-style-name | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].table.columnCount | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.columnWidths | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rowCount | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rowHeights | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows | instructions.pages[].items[].table.rows, reverseModel.pages[].items[].table.rows | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells | instructions.pages[].items[].table.rows[].cells, reverseModel.pages[].items[].table.rows[].cells | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].borderColor | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].borders | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].borderWeight | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].bounds | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].cellStyle | n/a | table-content | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].colSpan | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].fillColor | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].fillOpacity | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].header | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].index | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].leading | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].padding | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].paddingUnit | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].paragraphStyle | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].pointSize | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].rowSpan | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].runs | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].runs[].characterStyle | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].runs[].text | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].text | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].textAlign | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].cells[].textColor | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].header | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].table.rows[].index | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) | n/a |
| items[].textOverride | n/a | style-refs | active | native/unsupported/native | unsupported/native/native | unsupported/unsupported/lossless | n/a |
| items[].textStyle | reverseModel.pages[].items[].textStyle | text-content | active | observe-only/native/native | native/native/native | unsupported/approximate/lossless | n/a |
| items[].textStyle.composer | reverseModel.pages[].items[].textStyle.composer, sourceNode.attributes.data-id-paragraph-composer | text-content | active | observe-only/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| items[].vectorGeometry.kind | reverseModel.pages[].items[].vectorGeometry.kind | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths | reverseModel.pages[].items[].vectorGeometry.paths | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].points[].pointType | reverseModel.pages[].items[].vectorGeometry.paths[].points[].pointType | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.blendMode | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.blendMode, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.blendMode, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.blendMode | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.fillColor | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.fillColor, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.fillColor, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.fillColor | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.fillOpacity | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.fillOpacity, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.fillOpacity, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.fillOpacity | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.lineEndMarker | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.lineEndMarker, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.lineEndMarker, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.lineEndMarker | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.lineEndMarker.rawName | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.lineEndMarker.rawName, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.lineEndMarker.rawName, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.lineEndMarker.rawName | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.lineStartMarker | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.lineStartMarker, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.lineStartMarker, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.lineStartMarker | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.lineStartMarker.rawName | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.lineStartMarker.rawName, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.lineStartMarker.rawName, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.lineStartMarker.rawName | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.opacity | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.opacity, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.opacity, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.opacity | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeAlignment | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeAlignment, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeAlignment, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeAlignment | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeColor | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeColor, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeColor, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeColor | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeLineCap | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeLineCap, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeLineCap, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeLineCap | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeLineJoin | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeLineJoin, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeLineJoin, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeLineJoin | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeMiterLimit | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeMiterLimit, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeMiterLimit, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeMiterLimit | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeOpacity | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeOpacity, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeOpacity, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeOpacity | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeStyle | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeStyle, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeStyle, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeStyle | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].vectorGeometry.paths[].visualStyle.strokeWeight | reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.strokeWeight, instructions.pages[].items[].vectorGeometry.paths[].visualStyle.strokeWeight, instructions.pages[].items[].vectorGeometry.paths[].styleOverride.strokeWeight | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) | n/a |
| items[].visualStyle.blendMode | reverseModel.pages[].items[].visualStyle.blendMode | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.cornerRadius | reverseModel.pages[].items[].visualStyle.cornerRadius | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.fillColor | reverseModel.pages[].items[].visualStyle.fillColor | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.fillOpacity | reverseModel.pages[].items[].visualStyle.fillOpacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.lineEndMarker | n/a | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.lineEndMarker.rawName | reverseModel.pages[].items[].visualStyle.lineEndMarker.rawName, sourceNode.attributes.data-id-line-end-marker-raw-name | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.lineStartMarker | n/a | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.lineStartMarker.rawName | reverseModel.pages[].items[].visualStyle.lineStartMarker.rawName, sourceNode.attributes.data-id-line-start-marker-raw-name | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.opacity | reverseModel.pages[].items[].visualStyle.opacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeAlignment | reverseModel.pages[].items[].visualStyle.strokeAlignment, sourceNode.attributes.data-id-stroke-alignment | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeColor | reverseModel.pages[].items[].visualStyle.strokeColor | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeLineCap | reverseModel.pages[].items[].visualStyle.strokeLineCap | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeLineJoin | reverseModel.pages[].items[].visualStyle.strokeLineJoin | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeMiterLimit | reverseModel.pages[].items[].visualStyle.strokeMiterLimit | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeOpacity | reverseModel.pages[].items[].visualStyle.strokeOpacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeStyle | reverseModel.pages[].items[].visualStyle.strokeStyle, sourceNode.attributes.data-id-stroke-style | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].visualStyle.strokeWeight | reverseModel.pages[].items[].visualStyle.strokeWeight | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless | n/a |
| items[].zIndex | pages[].items[].zIndex | reverse-model | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) | n/a |
| layers | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].displayName | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].locked | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].name | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].printable | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].token | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].visible | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid | labels[].grid, sourceNode.attributes.data-id-grid, pages[].effectiveLabel.grid | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.baseline | labels[].grid.baseline, sourceNode.attributes.data-id-baseline, pages[].effectiveLabel.grid.baseline | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.baselineGuideMode | sourceNode.attributes.data-id-baseline-guides | document-page | active | observe-only/native/native | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.columnGutter | labels[].grid.columnGutter, sourceNode.attributes.data-id-column-gutter, pages[].effectiveLabel.grid.columnGutter | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.columns | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.rowGutter | labels[].grid.rowGutter, sourceNode.attributes.data-id-row-gutter, pages[].effectiveLabel.grid.rowGutter | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].grid.rows | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].guideMode | sourceNode.attributes.data-id-guide-mode | document-page | active | observe-only/native/native | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].guides | reverseModel.pages[].guides, sourceNode.attributes.data-id-guides | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].height | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].id | snapshot.pages[].id, reverseModel.pages[].id | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].index | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].layout | pages[].semanticLayout, labels[].layout, pages[].effectiveLabel.layout | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].margins | labels[].margins, sourceNode.attributes.data-id-margin, pages[].effectiveLabel.margins | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].margins.bottom | labels[].margins.bottom, sourceNode.attributes.data-id-margin-bottom, pages[].effectiveLabel.margins.bottom | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].margins.left | labels[].margins.left, sourceNode.attributes.data-id-margin-left, pages[].effectiveLabel.margins.left | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].margins.right | labels[].margins.right, sourceNode.attributes.data-id-margin-right, pages[].effectiveLabel.margins.right | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].margins.top | labels[].margins.top, sourceNode.attributes.data-id-margin-top, pages[].effectiveLabel.margins.top | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].parentPageId | labels[].parentPageId, pages[].effectiveLabel.parentPageId | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].semantic | pages[].effectiveLabel.semantic | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].snapGrid | sourceNode.attributes.data-id-snap-grid | document-page | active | observe-only/native/native | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].snapGridX | sourceNode.attributes.data-id-snap-grid-x | document-page | active | observe-only/native/native | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].snapGridY | sourceNode.attributes.data-id-snap-grid-y | document-page | active | observe-only/native/native | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].width | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].displayName | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].name | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].token | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.characterStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.characterStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.characterStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.characterStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.frameStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.frameStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.frameStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.frameStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.objectStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.objectStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.objectStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.objectStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.paragraphStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.paragraphStyles[].composer | styles.paragraphStyles[].composer | text-content | active | native/native/native | observe-only/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.paragraphStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.paragraphStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.paragraphStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized | reverseModel.styles.synthesized, document.sourcePackage.styles.synthesized | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].displayName | reverseModel.styles.synthesized[].displayName, document.sourcePackage.styles.synthesized[].displayName | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].fingerprint | reverseModel.styles.synthesized[].fingerprint, document.sourcePackage.styles.synthesized[].fingerprint | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].kind | reverseModel.styles.synthesized[].kind, document.sourcePackage.styles.synthesized[].kind | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].properties | reverseModel.styles.synthesized[].properties, document.sourcePackage.styles.synthesized[].properties | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].source | reverseModel.styles.synthesized[].source, document.sourcePackage.styles.synthesized[].source | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.synthesized[].token | reverseModel.styles.synthesized[].token, document.sourcePackage.styles.synthesized[].token | synthesized-styles | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.tableStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.tableStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.tableStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.tableStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].displayName | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].name | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].token | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |

## sourceMetadata

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| assets[].cropped | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].fileName | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].imageSize | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].linked | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].name | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| assets[].placement | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].source | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].sourceSelector | n/a | asset-placement | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| assets[].status | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.semanticPreset.relativePath | semanticPreset.relativePath, labels[].semanticPreset.relativePath, sourcePackageInput.attributes.data-id-semantic-preset | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.source | source | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage | sourcePackage, labels[].sourcePackage | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage.compositeFonts | sourcePackage.compositeFonts, sourcePackageInput.compositeFonts | source-metadata | active | native/native/native | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage.config | sourcePackage.config, labels[].sourcePackage.config, sourcePackageInput.attributes.data-id-source-package-config | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage.layers | sourcePackage.layers, sourcePackageInput.layers | source-metadata | active | native/native/native | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage.parentPages | sourcePackage.parentPages, sourcePackageInput.parentPages | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.sourcePackage.schemaVersion | sourcePackage.schemaVersion, labels[].sourcePackage.schemaVersion, sourcePackageInput.attributes.data-id-source-package-schema | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| document.styleLayout | styleLayout | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| effectiveLabel.htmlTag | n/a | reverse-model | active | unsupported/unsupported/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.bounds | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.cropped | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.graphicType | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.imageCropped | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.imageSize | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.imageTypeName | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.name | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.contentBounds | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.contentOffset | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.contentScale | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.contentSize | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.frameBounds | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.layers | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.placement.pdfCrop | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.preview | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.preview.kind | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.preview.path | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.source | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].asset.status | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].attributes | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].authoredStyle | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].boundsMm | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].box | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].classList | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].computedStyle | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].content.runs[].attributes | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].content.runs[].classList | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].content.runs[].inlineStyle | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].content.runs[].tagName | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].content.sourceHtml | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].effectiveLabel | pages[].items[].effectiveLabel | label-protocol | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| items[].firstLineFont | pages[].items[].firstLineFont | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].htmlClass | pages[].items[].htmlClass | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].inlineStyle | pages[].items[].inlineStyle | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].layerName | pages[].items[].layerName | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].parentPageItem | parentPages[].items[].parentPageItem, sourceNode.attributes.data-id-parent-page-item | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].parentPageSourceId | parentPages[].items[].parentPageSourceId, sourceNode.attributes.data-id-parent-page-source-id | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].ruleStyle | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].source | pages[].source, items[].source, sourceNode.attributes.data-id-source | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceAncestorNodes | labels[].sourceAncestorNodes, effectiveLabel.sourceAncestorNodes, pages[].effectiveLabel.sourceAncestorNodes | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceClassName | labels[].className, effectiveLabel.className, pages[].effectiveLabel.className | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceFile | pages[].sourceFile, labels[].sourceFile, effectiveLabel.sourceFile, pages[].effectiveLabel.sourceFile | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceHtml | labels[].sourceHtml, effectiveLabel.sourceHtml, pages[].effectiveLabel.sourceHtml | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceHtmlTag | labels[].htmlTag | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceNode | labels[].sourceNode, effectiveLabel.sourceNode | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceNode.attributes.data-id-source-csv | sourceNode.attributes.data-id-source-csv, labels[].sourceNode.attributes.data-id-source-csv, effectiveLabel.sourceNode.attributes.data-id-source-csv, pages[].items[].sourceNode.attributes.data-id-source-csv | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceNode.attributes.data-id-source-xml | sourceNode.attributes.data-id-source-xml, labels[].sourceNode.attributes.data-id-source-xml, effectiveLabel.sourceNode.attributes.data-id-source-xml, pages[].items[].sourceNode.attributes.data-id-source-xml | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceRuns | labels[].sourceRuns, effectiveLabel.sourceRuns, pages[].effectiveLabel.sourceRuns | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceSelector | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceText | labels[].sourceText, effectiveLabel.sourceText, pages[].effectiveLabel.sourceText | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].sourceType | pages[].items[].sourceType | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | Observed source-format object type, not a semantic role. |
| items[].structure | labels[].structure, effectiveLabel.structure, pages[].effectiveLabel.structure | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].runs[].attributes | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].runs[].classList | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].runs[].inlineStyle | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].runs[].tagName | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].runs[].textStyle | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].textStyle | n/a | table-content | active | native/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| items[].table.sourceRows | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| items[].tagName | pages[].items[].tagName | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| labels[].displayName | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].generated | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].htmlClass | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].id | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| labels[].kind | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| labels[].name | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].protocol | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| labels[].source | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| labels[].styleKind | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].token | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| labels[].version | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| layers[].labels | n/a | document-model | active | unsupported/unsupported/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].attributes | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| pages[].classList | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| pages[].computedStyle | n/a | source-metadata | active | native/observe-only/lossless | unsupported/unsupported/lossless | unsupported/unsupported/lossless | n/a |
| pages[].effectiveLabel | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| pages[].effectiveLabel.htmlTag | n/a | reverse-model | active | unsupported/unsupported/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| pages[].parentPage | labels[].parentPage, pages[].effectiveLabel.parentPage | document-page | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].parentPageItems | pages[].parentPageItems, instructions.pages[].parentPageItemOverrides | source-metadata | active | native/native/native | lossless/lossless/lossless | unsupported/unsupported/lossless | n/a |
| pages[].parentPageName | labels[].parentPageName, pages[].effectiveLabel.parentPageName | document-page | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| pages[].sourceNode | pages[].effectiveLabel.sourceNode | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].bounds | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].guides | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].id | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].items | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].name | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].parentPageId | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].parentPageName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].provides | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| parentPages[].semantic | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].css | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].labels | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].safeName | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.cellStyles[].source | n/a | document-model | active | observe-only/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles.characterStyles[].css | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].safeName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].css | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].safeName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].css | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].safeName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].css | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].safeName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].css | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].safeName | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless | n/a |
| styles[].css | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].labels | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].safeName | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |
| styles[].source | n/a | document-model | active | observe-only/observe-only/lossless | observe-only/observe-only/lossless | unsupported/fallback/lossless (fallbackKind=customData) | n/a |

## formatExtension

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| extensions.pptx.animation | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native | n/a |
| extensions.pptx.placeholder | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native | n/a |
| extensions.pptx.speakerNotes | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native | n/a |
| extensions.pptx.transition | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native | n/a |
| items[].content.runs[].textStyle | n/a | reverse-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| items[].extensions.indesign.effects | n/a | reverse-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | InDesign-specific reverse-export effects payload; current structured DocumentModel output uses extensions.indesign.effects. Adapter migration metadata records the old flat source path, while retired lifecycle facts live in retired registry entries.; migration=items[].effects -> items[].extensions.indesign.effects (adapter-migrated) |
| items[].extensions.indesign.textFit | instructions.pages[].items[].textFit | indesign-writer | active | native/unsupported/lossless | unsupported/native/lossless | unsupported/unsupported/lossless | Derived InDesign executor policy for bounded text-frame growth when browser-visible text would otherwise become overset. |
| items[].extensions.indesign.textFrameStyle | n/a | reverse-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | InDesign-specific text frame style payload; current structured DocumentModel output uses extensions.indesign.textFrameStyle. The HTML adapter derives verticalJustification from captured flex facts so the InDesign writer can rebuild native vertical justification. Adapter migration metadata records the old flat source path, while retired lifecycle facts live in retired registry entries.; migration=items[].textFrameStyle -> items[].extensions.indesign.textFrameStyle (adapter-migrated) |
| items[].table.rows[].cells[].appliedFont | instructions.pages[].items[].table.rows[].cells[].appliedFont | table-content | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].capitalization | instructions.pages[].items[].table.rows[].cells[].capitalization | table-content | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].fontStyleName | instructions.pages[].items[].table.rows[].cells[].fontStyleName | table-content | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| items[].table.rows[].cells[].tracking | instructions.pages[].items[].table.rows[].cells[].tracking | table-content | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.cellStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].appliedFont | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].capitalization | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].fillColor | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].fontStyle | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].fontStyleName | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].fontWeight | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].pointSize | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].textDecoration | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].tracking | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.characterStyles[].verticalPosition | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].cjkWeight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].appliedFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].baselineShift | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].customCharacters | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].fontStyle | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].horizontalScale | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].name | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].scaleOption | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].size | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].verticalScale | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].entries[].weight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].hasBoldCJK | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].name | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].romanWeight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.compositeFonts[].safeName | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.fonts | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.fonts[].fallback | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.fonts[].family | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].fit | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].inset | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].overflow | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.frameStyles[].position | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].blendMode | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].cornerRadius | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].fillColor | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].fillOpacity | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].opacity | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].strokeAlignment | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].strokeColor | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].strokeStyle | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.objectStyles[].strokeWeight | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].appliedFont | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].capitalization | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].fillColor | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].fontStyle | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].fontStyleName | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].fontWeight | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].justification | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].leading | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].pointSize | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].spaceAfter | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].spaceBefore | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.paragraphStyles[].tracking | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.swatches | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.swatches[].model | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.swatches[].name | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.swatches[].space | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.swatches[].value | n/a | style-resources | active | native/native/native | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles.tableStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |
| styles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless | n/a |

## observation

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| errors | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| fieldValidation | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.confidence | sourceNode.attributes.data-id-confidence | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.description | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.evidence | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.isSlot | sourceNode.attributes.data-id-migration-slot | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.label | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.slotName | sourceNode.attributes.data-id-slot-name | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.slotType | sourceNode.attributes.data-id-slot-type | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].migration.source | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel | pages[].items[].observedLabel | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.className | pages[].items[].observedLabel.className | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.htmlTag | pages[].items[].observedLabel.htmlTag | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.layout | pages[].items[].observedLabel.layout | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.rejectionReasons | pages[].items[].observedLabel.rejectionReasons | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.role | pages[].items[].observedLabel.role | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.semantic | pages[].items[].observedLabel.semantic | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceAncestorNodes | pages[].items[].observedLabel.sourceAncestorNodes | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceFile | pages[].items[].observedLabel.sourceFile | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceHtml | pages[].items[].observedLabel.sourceHtml | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceNode | pages[].items[].observedLabel.sourceNode | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceRuns | pages[].items[].observedLabel.sourceRuns | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.sourceText | pages[].items[].observedLabel.sourceText | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.structure | pages[].items[].observedLabel.structure | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| items[].observedLabel.styleRefs | pages[].items[].observedLabel.styleRefs | label-protocol | active | unsupported/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].auditItems | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].auditItems[].parent | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].items[].labelStatus | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].items[].rejectedFields | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].items[].rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].labelStatus | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].migration | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].migration.masterName | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].migration.source | n/a | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observed | pages[].observed, sourceNode.attributes.data-id-observed | reverse-model | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.className | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.grid | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.htmlTag | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.layout | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.margins | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.parentPage | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.parentPageId | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.parentPageName | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.semantic | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceAncestorNodes | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceFile | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceHtml | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceNode | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceRuns | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.sourceText | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].observedLabel.structure | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].rejectedFields | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| pages[].rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| report | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| reverseMode | sourceNode.attributes.data-id-reverse-mode | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| valid | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |
| warnings | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless | n/a |

## retired

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| retired.htmlAttrs.dataIdAuthoringGrid | n/a | document-page | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | n/a |
| retired.htmlAttrs.dataIdMargins | n/a | document-page | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | n/a |
| retired.htmlAttrs.dataIdPage | n/a | asset-placement | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | n/a |
| retired.htmlAttrs.dataIdParentPageDisplayName | n/a | document-page | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | n/a |
| retired.model.itemsEffects | n/a | reverse-model | retired | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | Retired flat InDesign effects surface. Use the InDesign format extension path instead. |
| retired.model.itemsTextFrameStyle | n/a | reverse-model | retired | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | Retired flat InDesign text frame style surface. Use the InDesign format extension path instead. |
| retired.model.itemsType | n/a | document-model | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | Retired item dialect field. Use items[].role for semantic role and items[].sourceType for source-format observation. |

退役 HTML 属性：
- retiredHtmlAttr=data-id-authoring-grid; readPolicy=observe-only; writePolicy=forbidden; replacedBy=data-id-snap-grid; reason=snap-grid-has-a-single-current-carrier
- retiredHtmlAttr=data-id-margins; readPolicy=observe-only; writePolicy=forbidden; replacedBy=data-id-margin; reason=plural-margin-carrier-replaced-by-current-authoring-page-margin-field
- retiredHtmlAttr=data-id-page; readPolicy=observe-only; writePolicy=forbidden; replacedBy=data-id-pdf-page; reason=ambiguous-with-page-identity
- retiredHtmlAttr=data-id-parent-page-display-name; readPolicy=observe-only; writePolicy=forbidden; replacedBy=data-id-parent-page-name; reason=replaced-by-single-parent-page-display-name-carrier

退役模型路径：
- retiredModelPath=items[].effects; readPolicy=retired; replacedBy=items[].extensions.indesign.effects; reason=flat-indesign-effects-moved-to-format-extension
- retiredModelPath=items[].textFrameStyle; readPolicy=retired; replacedBy=items[].extensions.indesign.textFrameStyle; reason=flat-indesign-text-frame-style-moved-to-format-extension
- retiredModelPath=items[].type; readPolicy=retired; replacedBy=items[].sourceType; reason=split-semantic-role-from-source-format-type
