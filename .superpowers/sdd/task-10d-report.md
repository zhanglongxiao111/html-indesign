# Task 10d Report

## Scope

- Task: W2 Task 10d only.
- Goal: migrate active `data-id-*` literals in `src/` and `scripts/` to registry-derived protocol constants and reduce `test/architecture/baselines/G2.json` to zero exemptions.
- Constraint: no subagents used.

## G2 Before / After

- Before: 331 exemptions across 46 files.
- After: 0 exemptions; `test/architecture/baselines/G2.json` is `{"exemptions": []}`.

## RED Evidence

- Command: inline G2-equivalent collector over current `src/` excluding `src/protocol/` plus `scripts/`.
- Result: 331 violations across 46 files.
- Representative violations:
  - `scripts/audit-reverse-visual.js` / `field data-id-object-style`
  - `scripts/audit-reverse-visual.js` / `field data-id-paragraph-style`
  - `scripts/audit-reverse-visual.js` / `field data-id-role`
  - `scripts/indesign-e2e.js` / `field data-id-layout`
  - `scripts/indesign-e2e.js` / `field data-id-parent-page`
  - `src/adapters/html/normalizer/snapshot-to-model.js` / `field data-id-baseline`
  - `src/adapters/html/normalizer/snapshot-to-model.js` / `field data-id-baseline-guides`
- Baseline confirmation command: `node --test test/architecture/protocol-literals.test.js`
- Baseline confirmation result: pass, 2/2 tests. This confirmed the current 331 findings were covered by existing G2 exemptions and had to be retired by this task.
- Additional RED for retired cleanup helper:
  - Command: `node --test test/protocol/constants.test.js`
  - Initial result: failed because `RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES` was not exported.

## Changed Files

- `.superpowers/sdd/task-10d-report.md`
- `scripts/audit-reverse-visual.js`
- `scripts/indesign-e2e.js`
- `src/adapters/html/normalizer/snapshot-to-model.js`
- `src/adapters/html/normalizer/svg-vector-geometry.js`
- `src/adapters/html/reader/asset-detector.js`
- `src/adapters/html/reader/browser-element-capture.js`
- `src/adapters/html/reader/browser-snapshot-capture.js`
- `src/adapters/html/reader/browser-snapshot.js`
- `src/adapters/html/reader/source-metadata.js`
- `src/adapters/html/validators/authoring-validator.js`
- `src/adapters/indesign/normalizer/label-whitelist.js`
- `src/adapters/indesign/normalizer/snapshot-to-model.js`
- `src/authoring/source-package.js`
- `src/protocol/constants.js`
- `src/protocol/index.js`
- `src/semantic-model/layout.js`
- `src/semantic-preset/audit-authoring.js`
- `src/semantic-reconstruction/caption-structure.js`
- `src/shared/assets.js`
- `src/writers/html/asset-html.js`
- `src/writers/html/asset-reference-policy.js`
- `src/writers/html/audit/author-editability.js`
- `src/writers/html/audit/content-inventory.js`
- `src/writers/html/audit/source-roundtrip-diff.js`
- `src/writers/html/audit/structure-signature.js`
- `src/writers/html/audit/visual-geometry-audit.js`
- `src/writers/html/author-asset-attrs.js`
- `src/writers/html/author-asset-packager.js`
- `src/writers/html/author-asset-renderer.js`
- `src/writers/html/author-attribute-writer.js`
- `src/writers/html/author-node-attrs.js`
- `src/writers/html/author-package-writer.js`
- `src/writers/html/author-pdf-renderer.js`
- `src/writers/html/author-render-utils.js`
- `src/writers/html/author-resource-paths.js`
- `src/writers/html/author-rich-text-renderer.js`
- `src/writers/html/author-style-attrs.js`
- `src/writers/html/author-table-renderer.js`
- `src/writers/html/author-vector-renderer.js`
- `src/writers/html/reveal-presentation-writer.js`
- `src/writers/html/table-html.js`
- `src/writers/html/vector-svg.js`
- `src/writers/html/visual-html-writer.js`
- `src/writers/html/visual-style-css.js`
- `src/writers/indesign/instruction-writer.js`
- `src/writers/indesign/layer-instructions.js`
- `src/writers/indesign/style-compiler.js`
- `src/writers/indesign/style-identities.js`
- `src/writers/indesign/text-instructions.js`
- `test/architecture/baselines/G2.json`
- `test/protocol/constants.test.js`
- `test/protocol/validate-retired-fields.test.js`

## GREEN Evidence

- Active `data-id-*` literals were migrated to `HTML_DATA_ID_ATTRIBUTES` / `HTML_DATA_ID_ATTRIBUTE_NAMES`.
- Retired cleanup for `data-id-page` now uses registry-derived `RETIRED_HTML_DATA_ID_ATTRIBUTES.PAGE` from `src/protocol/`; active `HTML_DATA_ID_ATTRIBUTES.PAGE` remains absent.
- Browser-injected snapshot scripts receive `HTML_DATA_ID_ATTRIBUTES` from Node-side protocol constants via `window.htmlIndesignDataIdAttributes`; they do not `require()` protocol inside the browser runtime.
- G2 after migration:
  - Command: `node --test test/architecture/protocol-literals.test.js`
  - Result: pass, 2/2 tests.
- Non-protocol runtime scan:
  - Command: `rg -n "data-id-[a-z0-9-]+" src scripts ... | rg -v "^src\\protocol\\|^src/protocol/"`
  - Result: no matches.

## Verification

- `node --test test/architecture/protocol-literals.test.js` -> pass, 2/2.
- `node --test test/protocol/constants.test.js` -> pass, 6/6.
- `node --test test/architecture/single-implementation.test.js` -> pass, 4/4.
- Focused tests:
  - Command: `node --test test/paged-html/authoring-validator.test.js test/paged-html/asset-detector.test.js test/semantic-model/from-snapshot.test.js test/semantic-model/to-instructions.test.js test/shared/assets.test.js test/authoring/source-package.test.js test/indesign-reverse/author-editability-audit.test.js test/indesign-reverse/asset-reference-policy.test.js test/indesign-reverse/source-roundtrip-diff.test.js test/indesign-reverse/visual-geometry-audit.test.js test/protocol/validate-retired-fields.test.js test/indesign-e2e-runner.test.js`
  - Result: pass, 171/171.
- Additional CLI focused regression:
  - Command: `node --test test/indesign-reverse/visual-geometry-cli.test.js`
  - Result: pass, 6/6.
- Syntax check:
  - Command: `node --check` over changed JS files.
  - Result: pass, 51 files checked, 0 failures.
- Full suite:
  - Command: `npm test`
  - Result: pass, 911/911.
- Whitespace:
  - Command: `git diff --check`
  - Result: pass.

## Concerns

- No open implementation concerns.
- Real InDesign E2E was not run because Task 10d only changes protocol literal indirection and the brief minimum verification did not require true InDesign execution.

## 2026-07-08 Review Fix

### Review Failure

- Reviewer: Anscombe.
- Verdict: SPEC FAIL / QUALITY FAIL.
- P1: `src/writers/html/audit/source-roundtrip-diff.js` still had active bare protocol regex literal `/\s(data-id-(?:object|ignore))\s*=\s*["']{2}/gi`.
- P2: `src/writers/html/audit/visual-geometry-audit.js` still had runtime protocol prefix knowledge via `attr.startsWith(`data-id-`)`.

### RED Evidence

- Command: `node --test test/architecture/protocol-literals.test.js`
- Result: failed after expanding G2 to scan regex literals and bare `data-id-` prefix literals.
- Representative failure:
  - `src/writers/html/audit/source-roundtrip-diff.js` / `field data-id-object`
  - `src/writers/html/audit/source-roundtrip-diff.js` / `field data-id-ignore`
  - `src/writers/html/audit/source-roundtrip-diff.js` / `field data-id- prefix`
  - `src/writers/html/audit/visual-geometry-audit.js` / `field data-id- prefix`

### Fix

- `test/architecture/protocol-literals.test.js`: G2 now scans regex literals, expands simple `data-id-(?:a|b)` regex alternatives into concrete fields, and reports bare `data-id-` prefix literals.
- `src/writers/html/audit/source-roundtrip-diff.js`: empty project boolean attribute regex is now built from `HTML_DATA_ID_ATTRIBUTES.OBJECT` and `HTML_DATA_ID_ATTRIBUTES.IGNORE` with `escapeRegExp`.
- `src/writers/html/audit/visual-geometry-audit.js`: data-id attribute normalization now filters with `HTML_DATA_ID_ATTRIBUTE_NAMES` instead of hard-coded prefix checks.
- `test/architecture/baselines/G2.json` remains `{"exemptions": []}`.

### GREEN Evidence / Verification

- `node --test test/architecture/protocol-literals.test.js` -> pass, 2/2.
- `node --test test/indesign-reverse/source-roundtrip-diff.test.js test/indesign-reverse/visual-geometry-audit.test.js` -> pass, 28/28.
- `node --test test/protocol/constants.test.js` -> pass, 6/6.
- `rg -n "data-id-" src scripts | rg -v "^src[\\/]protocol[\\/]"` -> no output, exit 1, meaning no non-protocol matches.
- `npm test` -> pass, 911/911.

### Concerns

- No open implementation concerns.
- Real InDesign E2E was not run; this review fix stays within G2 literal guardrail coverage and protocol constant indirection.
