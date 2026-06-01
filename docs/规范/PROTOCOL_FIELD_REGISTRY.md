# 协议字段注册表

本文件由 `src/protocol/docs/generate-field-docs.js` 从协议字段注册表和能力矩阵生成。
字段事实以 registry 为准；本文件只记录生成结果，不维护第二份字段清单。
分节名对应 `fieldClass`，`retired` 分节按 `lifecycle=retired` 收拢退役字段。

## canonical

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
| --- | --- | --- | --- | --- | --- | --- |
| assets[].path | assets[].src, assets[].resolvedPath, items[].asset.path | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData; risk=external-link-policy) |
| document.coordinateUnit | coordinateUnit, labels[].coordinateUnit | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| document.id | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| document.profile | n/a | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| document.title | title, labels[].title | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| document.unitMode | unitMode, labels[].unitMode | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].asset.placement.crop | n/a | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) |
| items[].asset.placement.hiddenLayers | n/a | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) |
| items[].asset.placement.pageNumber | items[].asset.pageNumber, instructions.pages[].items[].placed.pageNumber | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image; risk=editable-loss) |
| items[].asset.placement.transparentBackground | n/a | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) |
| items[].asset.placement.visibleLayers | n/a | asset-placement | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=preview-image) |
| items[].bounds | pages[].items[].bounds | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].content.runs | items[].textRuns | text-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) |
| items[].content.runs[].text | n/a | reverse-model | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) |
| items[].content.text | items[].text, instructions.pages[].items[].text | text-content | active | native/native/native | native/native/native | unsupported/native/lossless |
| items[].layout | pages[].items[].layout, items[].effectiveLabel.layout | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].role | labels[].role, items[].effectiveLabel.role | label-protocol | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].semantic | labels[].semantic, items[].effectiveLabel.semantic | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs | labels[].styleRefs, items[].effectiveLabel.styleRefs | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.cellStyle | items[].cellStyle, labels[].cellStyle, labels[].cellStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.characterStyle | items[].characterStyle, items[].content.runs[].characterStyle, labels[].characterStyle, labels[].characterStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.frameStyle | items[].frameStyle, labels[].frameStyle, labels[].frameStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.layer | items[].layer, items[].layerToken, labels[].layer, labels[].layerToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.objectStyle | items[].objectStyle, labels[].objectStyle, labels[].objectStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.paragraphStyle | items[].paragraphStyle, labels[].paragraphStyle, labels[].paragraphStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].styleRefs.tableStyle | items[].table.tableStyle, labels[].tableStyle, labels[].tableStyleToken | style-refs | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=customData) |
| items[].table.columnCount | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.columnWidths | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rowCount | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rowHeights | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows | instructions.pages[].items[].table.rows, reverseModel.pages[].items[].table.rows | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells | instructions.pages[].items[].table.rows[].cells, reverseModel.pages[].items[].table.rows[].cells | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].borders | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].cellStyle | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].colSpan | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].fillColor | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].header | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].index | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].leading | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].padding | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].paragraphStyle | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].pointSize | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].rowSpan | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs[].attributes | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs[].characterStyle | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs[].classList | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs[].tagName | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].runs[].text | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].text | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].textAlign | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].cells[].textColor | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].table.rows[].index | n/a | table-content | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=editable-shapes) |
| items[].textStyle | reverseModel.pages[].items[].textStyle | text-content | active | native/native/native | native/native/native | unsupported/approximate/lossless |
| items[].vectorGeometry.kind | reverseModel.pages[].items[].vectorGeometry.kind | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) |
| items[].vectorGeometry.paths | reverseModel.pages[].items[].vectorGeometry.paths | vector-geometry | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=svg) |
| items[].visualStyle.cornerRadius | reverseModel.pages[].items[].visualStyle.cornerRadius | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.fillColor | reverseModel.pages[].items[].visualStyle.fillColor | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.fillOpacity | reverseModel.pages[].items[].visualStyle.fillOpacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.opacity | reverseModel.pages[].items[].visualStyle.opacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeColor | reverseModel.pages[].items[].visualStyle.strokeColor | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeLineCap | reverseModel.pages[].items[].visualStyle.strokeLineCap | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeLineJoin | reverseModel.pages[].items[].visualStyle.strokeLineJoin | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeMiterLimit | reverseModel.pages[].items[].visualStyle.strokeMiterLimit | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeOpacity | reverseModel.pages[].items[].visualStyle.strokeOpacity | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeStyle | reverseModel.pages[].items[].visualStyle.strokeStyle | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].visualStyle.strokeWeight | reverseModel.pages[].items[].visualStyle.strokeWeight | visual-style | active | native/native/native | native/observe-only/lossless | unsupported/approximate/lossless |
| items[].zIndex | pages[].items[].zIndex | reverse-model | active | native/native/native | native/native/native | unsupported/fallback/lossless (fallbackKind=text-runs) |
| layers | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].locked | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].printable | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].visible | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].grid | labels[].grid, sourceNode.attributes.data-id-grid, pages[].effectiveLabel.grid | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].guides | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].height | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].id | snapshot.pages[].id, reverseModel.pages[].id | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].index | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].layout | pages[].semanticLayout, labels[].layout, pages[].effectiveLabel.layout | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].margins | labels[].margins, pages[].effectiveLabel.margins | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].parentPageId | labels[].parentPageId, pages[].effectiveLabel.parentPageId | document-page | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].semantic | pages[].effectiveLabel.semantic | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].width | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.cellStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.characterStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.frameStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.objectStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.paragraphStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles.tableStyles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles[].css | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles[].displayName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles[].name | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles[].safeName | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| styles[].token | n/a | document-model | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |

## sourceMetadata

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
| --- | --- | --- | --- | --- | --- | --- |
| document.source | source | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| document.sourcePackage | sourcePackage, labels[].sourcePackage | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.cropped | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.graphicType | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.imageTypeName | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.name | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.placement.layers | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.preview | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].asset.status | n/a | asset-placement | active | observe-only/observe-only/lossless | native/observe-only/lossless | unsupported/unsupported/lossless |
| items[].content.runs[].attributes | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].content.runs[].classList | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].content.runs[].tagName | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].content.sourceHtml | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].effectiveLabel | pages[].items[].effectiveLabel | label-protocol | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| items[].firstLineFont | pages[].items[].firstLineFont | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].htmlClass | pages[].items[].htmlClass | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].inlineStyle | pages[].items[].inlineStyle | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].layerName | pages[].items[].layerName | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceAncestorNodes | labels[].sourceAncestorNodes, effectiveLabel.sourceAncestorNodes, pages[].effectiveLabel.sourceAncestorNodes | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceClassName | labels[].className, effectiveLabel.className, pages[].effectiveLabel.className | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceFile | pages[].sourceFile, labels[].sourceFile, effectiveLabel.sourceFile, pages[].effectiveLabel.sourceFile | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceHtml | labels[].sourceHtml, effectiveLabel.sourceHtml, pages[].effectiveLabel.sourceHtml | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceHtmlTag | labels[].htmlTag, effectiveLabel.htmlTag, pages[].effectiveLabel.htmlTag | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceNode | labels[].sourceNode, effectiveLabel.sourceNode | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceNode.attributes.data-id-source-csv | sourceNode.attributes.data-id-source-csv, labels[].sourceNode.attributes.data-id-source-csv, effectiveLabel.sourceNode.attributes.data-id-source-csv, pages[].items[].sourceNode.attributes.data-id-source-csv | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceNode.attributes.data-id-source-xml | sourceNode.attributes.data-id-source-xml, labels[].sourceNode.attributes.data-id-source-xml, effectiveLabel.sourceNode.attributes.data-id-source-xml, pages[].items[].sourceNode.attributes.data-id-source-xml | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceRuns | labels[].sourceRuns, effectiveLabel.sourceRuns, pages[].effectiveLabel.sourceRuns | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceText | labels[].sourceText, effectiveLabel.sourceText, pages[].effectiveLabel.sourceText | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].sourceType | pages[].items[].sourceType | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].structure | labels[].structure, effectiveLabel.structure, pages[].effectiveLabel.structure | source-metadata | active | native/native/native | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| items[].tagName | pages[].items[].tagName | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| labels[].displayName | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| labels[].htmlClass | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| labels[].id | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| labels[].kind | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| labels[].name | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| labels[].protocol | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| labels[].source | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| labels[].styleKind | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| labels[].token | n/a | label-protocol | active | native/observe-only/lossless | lossless/lossless/lossless | unsupported/unsupported/lossless |
| labels[].version | n/a | label-protocol | active | native/native/native | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| layers[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| pages[].effectiveLabel | n/a | reverse-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| pages[].parentPage | labels[].parentPage, pages[].effectiveLabel.parentPage | document-page | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].parentPageName | labels[].parentPageName, pages[].effectiveLabel.parentPageName | document-page | active | observe-only/observe-only/lossless | lossless/lossless/lossless | unsupported/fallback/lossless (fallbackKind=customData) |
| pages[].sourceNode | pages[].effectiveLabel.sourceNode | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].bounds | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].id | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].items | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].name | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].provides | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| parentPages[].semantic | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| reverseMode | n/a | reverse-diagnostics | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.cellStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.cellStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.characterStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.characterStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.frameStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.frameStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.objectStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.objectStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.paragraphStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.paragraphStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.tableStyles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles.tableStyles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles[].labels | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |
| styles[].source | n/a | document-model | active | native/observe-only/lossless | lossless/observe-only/lossless | unsupported/unsupported/lossless |

## formatExtension

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
| --- | --- | --- | --- | --- | --- | --- |
| extensions.pptx.animation | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native |
| extensions.pptx.placeholder | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native |
| extensions.pptx.speakerNotes | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native |
| extensions.pptx.transition | n/a | pptx-adapter | candidate | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported | native/native/native |
| items[].effects | pages[].items[].effects | reverse-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| items[].textFrameStyle | pages[].items[].textFrameStyle | reverse-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.cellStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.characterStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].cjkWeight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].entries | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].entries[].fontStyle | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].entries[].name | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].entries[].size | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].entries[].weight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].hasBoldCJK | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].name | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].romanWeight | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.compositeFonts[].safeName | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.frameStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.objectStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.paragraphStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles.tableStyles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures.compositeFont | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures.dropCap | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures.grepStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures.list | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |
| styles[].indesignFeatures.nestedStyles | n/a | document-model | active | observe-only/unsupported/lossless | native/native/native | unsupported/unsupported/lossless |

## observation

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
| --- | --- | --- | --- | --- | --- | --- |
| errors | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| fieldValidation | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel | pages[].items[].observedLabel | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.className | pages[].items[].observedLabel.className | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.htmlTag | pages[].items[].observedLabel.htmlTag | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.layout | pages[].items[].observedLabel.layout | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.rejectionReasons | pages[].items[].observedLabel.rejectionReasons | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.role | pages[].items[].observedLabel.role | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.semantic | pages[].items[].observedLabel.semantic | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceAncestorNodes | pages[].items[].observedLabel.sourceAncestorNodes | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceFile | pages[].items[].observedLabel.sourceFile | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceHtml | pages[].items[].observedLabel.sourceHtml | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceNode | pages[].items[].observedLabel.sourceNode | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceRuns | pages[].items[].observedLabel.sourceRuns | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.sourceText | pages[].items[].observedLabel.sourceText | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| items[].observedLabel.structure | pages[].items[].observedLabel.structure | label-protocol | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].items[].labelStatus | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].items[].rejectedFields | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].items[].rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].labelStatus | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.className | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.grid | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.htmlTag | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.layout | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.margins | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.parentPage | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.parentPageId | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.parentPageName | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.semantic | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceAncestorNodes | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceFile | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceHtml | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceNode | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceRuns | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.sourceText | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].observedLabel.structure | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].rejectedFields | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| pages[].rejectionReasons | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| report | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| valid | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |
| warnings | n/a | reverse-diagnostics | active | observe-only/observe-only/lossless | observe-only/unsupported/lossless | observe-only/unsupported/lossless |

## retired

| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
| --- | --- | --- | --- | --- | --- | --- |
| retired.htmlAttrs.dataIdPage | n/a | asset-placement | retired | observe-only/unsupported/unsupported | unsupported/unsupported/unsupported | unsupported/unsupported/unsupported |

退役 HTML 属性：
- retiredHtmlAttr=data-id-page; readPolicy=observe-only; writePolicy=forbidden; replacedBy=data-id-pdf-page; reason=ambiguous-with-page-identity
