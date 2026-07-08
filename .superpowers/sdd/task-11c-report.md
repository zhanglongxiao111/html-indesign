# Task 11c Report

## Status

DONE

## Changed Files

- `scripts/audit-reverse-visual.js`
- `src/adapters/html/reader/visual-geometry-capture.js`
- `test/indesign-reverse/visual-geometry-cli.test.js`
- `.superpowers/sdd/task-11c-report.md`

## RED Evidence

Tests were updated before implementation:

- `test/indesign-reverse/visual-geometry-cli.test.js` now imports `captureHtmlGeometry` from `src/adapters/html/reader/visual-geometry-capture.js`.
- The test asserts the CLI script export and src reader export are the same function object.

Initial RED command:

```text
node --test test/indesign-reverse/visual-geometry-cli.test.js
```

Initial RED result:

```text
Error: Cannot find module '../../src/adapters/html/reader/visual-geometry-capture'
```

## GREEN Evidence

Implemented:

- Moved `captureHtmlGeometry` into `src/adapters/html/reader/visual-geometry-capture.js`.
- Kept `scripts/audit-reverse-visual.js` as the CLI/audit orchestrator: parse inputs, validate files, load reverse model evidence, enrich source metadata, run `compareVisualGeometry`, write/print reports, and manage exit codes.
- Script re-exports the imported `captureHtmlGeometry`, so tests prove the script does not keep a second active capture implementation.

## Behavior Preservation

Preserved behavior:

- Capture output shape remains `{ pages, elements }`.
- Element keys, ids, page indexes, tag names, page-relative geometry, metadata fields, `dataIdAttrs`, `classList`, `textContent`, `innerText`, and `ownTextContent` are unchanged.
- Browser viewport, image/media/font route blocking, `setContent` wait, load-state wait, `document.fonts.ready`, and double `requestAnimationFrame` wait are unchanged.
- `HTML_DATA_ID_ATTRIBUTES` and `HTML_DATA_ID_ATTRIBUTE_NAMES` remain the only source for protocol data-id attributes in capture.
- No pages and no comparable elements still fail through `assertComparableReport` as `REVERSE_VISUAL_INVALID_INPUT`.
- Browser and page evaluation errors are not swallowed.
- `compareVisualGeometry` semantics were not changed.

## Validation

```text
node --test test/indesign-reverse/visual-geometry-cli.test.js
PASS: 7 tests, 0 failures.

node --test test/architecture/dependency-direction.test.js test/architecture/docs-code-sync.test.js
PASS: 12 tests, 0 failures.

npm test
PASS: 917 tests, 0 failures.

git diff --check
PASS: no whitespace errors.
```

Additional checks:

```text
git diff -- test/architecture/baselines/G1.json test/architecture/baselines/G7.json src/writers/html/audit/visual-geometry-audit.js scripts/audit-conversion-gate.js
PASS: no diff; 11d G1 baseline, G7 baseline, conversion gate, and visual geometry compare semantics were untouched.

rg -n "async function captureHtmlGeometry|captureHtmlGeometry|HTML_DATA_ID_ATTRIBUTE_NAMES|HTML_DATA_ID_ATTRIBUTES" scripts/audit-reverse-visual.js src/adapters/html/reader/visual-geometry-capture.js test/indesign-reverse/visual-geometry-cli.test.js
PASS: active capture function definition exists only in src/adapters/html/reader/visual-geometry-capture.js; script imports and re-exports it.
```

## Risks / Unhandled Items

- No 11d adapter/writer G1 baseline cleanup was attempted in this task.
- No known open concerns.
