# Task 10c Report: Shared Helper Convergence

## Status

DONE

## Changed Files

- `src/shared/text.js`
- `src/shared/style-utils.js`
- `src/shared/geometry.js`
- `src/shared/nas-paths.js`
- `src/adapters/indesign/audit/parent-page-furniture.js`
- `src/adapters/indesign/audit/reverse-snapshot-structure.js`
- `src/adapters/indesign/normalizer/blueprint-migration.js`
- `src/semantic-model/layout.js`
- `src/writers/indesign/box-model.js`
- `src/writers/html/audit/author-editability.js`
- `src/writers/html/audit/content-inventory.js`
- `src/writers/html/audit/source-roundtrip-diff.js`
- `src/writers/html/audit/structure-signature.js`
- `src/writers/html/author-css-writer.js`
- `src/writers/html/author-style-attrs.js`
- `src/writers/html/visual-html-utils.js`
- `test/shared/text.test.js`
- `test/shared/style-utils.test.js`
- `test/shared/geometry.test.js`
- `test/shared/nas-paths.test.js`
- `test/architecture/baselines/G6.json`
- `.superpowers/sdd/task-10c-report.md`

## G6 Baseline

- Before: 15 exemptions.
- After: 1 exemption.
- Removed: 14 exemptions for 10c text normalization, class token, and CSS length helpers.
- Remaining: `src/adapters/html/reader/browser-snapshot.js` defines `parseZIndex`, outside 10c scope.
- No new G6 baseline entries were added.

## RED Evidence

Command:

```powershell
node --test .\test\shared\text.test.js .\test\shared\style-utils.test.js .\test\shared\geometry.test.js .\test\shared\nas-paths.test.js
```

Expected RED result before production changes:

- Exit code: 1.
- 10 passing, 6 failing.
- Failures were the intended missing shared APIs:
  - `Cannot find module '../../src/shared/text'`
  - `cssLengthToMm is not a function`
  - `nasUrlToUncPath is not a function`
  - `safeAuthorClassToken is not a function`
  - `safeMigrationClassToken is not a function`
  - `safeVisualClassToken is not a function`

G6 pre-baseline-update evidence after replacing local helpers:

```powershell
node --test test/architecture/single-implementation.test.js
```

- Exit code: 1.
- `New violations: none`.
- 14 expired exemptions reported, matching the 10c helper removals.

## GREEN Evidence

Shared helper focused GREEN:

```powershell
node --test .\test\shared\text.test.js .\test\shared\style-utils.test.js .\test\shared\geometry.test.js .\test\shared\nas-paths.test.js
```

- Exit code: 0.
- 17/17 passing.

G6 after baseline shrink:

```powershell
node --test test/architecture/single-implementation.test.js
```

- Exit code: 0.
- 4/4 passing.

Focused 10c suite:

```powershell
node --test test/shared/text.test.js test/shared/style-utils.test.js test/shared/geometry.test.js test/shared/nas-paths.test.js test/paged-html/layout.test.js test/indesign-reverse/author-css-writer.test.js test/indesign-reverse/blueprint-migration.test.js test/indesign-reverse/content-inventory.test.js test/indesign-reverse/source-roundtrip-diff.test.js test/indesign-reverse/structure-signature.test.js test/indesign-reverse/reverse-snapshot-structure.test.js test/indesign-reverse/parent-page-furniture-audit.test.js test/indesign-reverse/author-editability-audit.test.js
```

- Exit code: 0.
- 102/102 passing.

Full suite:

```powershell
npm test
```

- Exit code: 0.
- 910/910 passing.

Whitespace check:

```powershell
git diff --check
```

- Exit code: 0.

## Notes

- Text helpers were split by behavior: `normalizeLineEndings` preserves spacing and only normalizes CRLF/CR, while `collapseWhitespace` folds JavaScript whitespace including NBSP and trims.
- Class token helpers remain domain-specific: `safeAuthorClassToken`, `safeMigrationClassToken`, and `safeVisualClassToken` preserve the previous call-site differences instead of hiding them behind one ambiguous fallback.
- CSS length helpers preserve previous null/zero/visual-rounding semantics with separate shared functions.
- `content-inventory` now reuses `shared/nas-paths.js` for `/nas/...` to UNC identity conversion.

## Concerns

- No blocking concerns.
- G6 is not fully zero because the remaining `parseZIndex` exemption is outside W2 Task 10c.
