# Task 10b Report

## Scope

This report records the Task 10b review-failure fix after Pauli reported `SPEC FAIL / QUALITY FAIL`.

## Changed Files

- `src/protocol/item-role-helpers.js`
- `src/adapters/html/reader/candidate-elements.js`
- `src/writers/html/audit/content-inventory.js`
- `src/adapters/html/validators/authoring-validator.js`
- `src/writers/html/audit/visual-geometry-audit.js`
- `test/paged-html/candidate-elements.test.js`
- `test/paged-html/authoring-validator.test.js`
- `test/indesign-reverse/content-inventory.test.js`

## RED Evidence

Command:

```powershell
node --test test/paged-html/candidate-elements.test.js test/paged-html/authoring-validator.test.js test/indesign-reverse/content-inventory.test.js test/indesign-reverse/html-writer.test.js test/indesign-reverse/author-html-tree.test.js
```

Result: failed as expected.

- `authorPackageContentInventory classifies sourced svg elements as graphics`: sourced `<svg src="./diagram.svg">` was counted as `shape`, proving the audit call-site did not pass asset source facts into the shared helper.
- `htmlItemRoleFromElementFacts treats paragraph-style elements as text`: `div[data-id-paragraph-style="body-copy"]` returned `shape`, proving paragraph-style text classification still lived outside the helper.

The annotation skip coverage test passed on RED because the behavior already existed; it was added to prevent later drift.

## GREEN Evidence

Command:

```powershell
node --test test/paged-html/candidate-elements.test.js test/paged-html/authoring-validator.test.js test/indesign-reverse/content-inventory.test.js test/indesign-reverse/html-writer.test.js test/indesign-reverse/author-html-tree.test.js
```

Result: 98/98 pass.

Fix summary:

- `htmlItemRoleFromElementFacts()` now owns the paragraph-style => `ITEM_ROLE.TEXT` rule.
- `candidate-elements.js` no longer performs local source/paragraph-style role adjudication; it passes facts into the shared helper.
- `content-inventory.js` now derives `hasAssetSource` with `assetSourceFromElementLike()` and `inferAssetKind()` before calling the shared helper, so sourced SVG audits classify as `ITEM_ROLE.GRAPHIC`.
- In-scope role literals in validator and visual audit were replaced with `ITEM_ROLE` constants.

## Verification

```powershell
node --test test/paged-html/candidate-elements.test.js test/paged-html/authoring-validator.test.js test/indesign-reverse/content-inventory.test.js test/indesign-reverse/html-writer.test.js test/indesign-reverse/author-html-tree.test.js
```

Result: 98/98 pass.

```powershell
node --test test/architecture/protocol-literals.test.js test/architecture/single-implementation.test.js
```

Result: 6/6 pass.

```powershell
npm test
```

Result: 903/903 pass.

```powershell
git diff --check
```

Result: pass.

## Concerns

- Real InDesign E2E was not run. This fix did not change the executor or JSX output path, and Task 10b scope calls for focused tests plus `npm test`.
- No G2/G6 baseline entries were added or edited in this fix commit.
