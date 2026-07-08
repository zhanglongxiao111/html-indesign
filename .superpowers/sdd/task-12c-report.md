# Task 12c Report: Semantic container classes from semantic preset single source

## Status

PASS.

Implemented W4 Task 12c only. Semantic container class tokens are now declared in semantic presets and consumed by author editability through semantic preset token helpers. The old local `SEMANTIC_CONTAINER_CLASSES` allowlist was removed from `src/writers/html/audit/author-editability.js`.

## Commit id(s)

- Implementation commit: `28b6718d365a099453315ebb4967751fc571382a`
- Report commit: created after this report file was written; see final response / git log.

## Files changed

- `src/semantic-preset/schema.js`
- `src/semantic-preset/maps.js`
- `src/writers/html/audit/author-editability.js`
- `presets/architecture-report/semantic-preset.json`
- `test/fixtures/e2e/architecture-report/semantic-preset.json`
- `test/semantic-preset/semantic-preset.test.js`
- `test/indesign-to-html/author-editability-audit.test.js`
- `.superpowers/sdd/task-12c-report.md`

## Implementation summary

- Added `tokens.semanticContainers` validation to semantic preset schema.
- Added `semanticContainers` to `collectKnownSemanticTokens`.
- Moved the current container class tokens into the architecture standard preset and checked-in E2E preset copy:
  - `figure-grid`
  - `image-grid`
  - `material-grid`
  - `text-block`
  - `diagram`
  - `callout`
  - `content-grid`
- Updated author editability to resolve semantic preset data for the author package and derive container classes from `collectKnownSemanticTokens(...).semanticContainers`.
- Preserved fail-closed behavior for structured package preset sources: an explicitly declared empty `semanticPreset` now throws instead of falling back to a default profile; invalid/missing project preset paths still surface through preset resolution.

## TDD / red checks

Initial red checks after adding tests:

```powershell
node --test test\semantic-preset\semantic-preset.test.js
```

Expected failures observed:

- `collects known semantic tokens from style maps and token lists` failed because `known.semanticContainers` was undefined.
- `validates semantic container token lists` failed because invalid `tokens.semanticContainers` entries were not yet validated.

```powershell
node --test test\indesign-to-html\author-editability-audit.test.js
```

Expected failure observed:

- `author editability audit does not declare a local semantic container allowlist` failed because `SEMANTIC_CONTAINER_CLASSES` still existed in `author-editability.js`.

## Required verification

```powershell
node --test test\semantic-preset\semantic-preset.test.js
```

PASS: 7 tests, 7 pass, 0 fail.

```powershell
node --test test\indesign-to-html\author-editability-audit.test.js
```

PASS: 7 tests, 7 pass, 0 fail.

```powershell
node --test test\indesign-to-html\conversion-gate-cli.test.js
```

PASS: 11 tests, 11 pass, 0 fail.

```powershell
npm test
```

PASS: 924 tests, 924 pass, 0 fail.

```powershell
git diff --check
```

PASS: exit code 0, no whitespace errors.

```powershell
rg "SEMANTIC_CONTAINER_CLASSES|figure-grid|image-grid|material-grid|text-block|content-grid" src\writers\html\audit\author-editability.js src\semantic-preset presets test\semantic-preset test\indesign-to-html\author-editability-audit.test.js
```

PASS: exit code 0. Output only showed preset/test fixture data and the test assertion that checks `SEMANTIC_CONTAINER_CLASSES` is absent; it did not show a local `SEMANTIC_CONTAINER_CLASSES` allowlist in `src/writers/html/audit/author-editability.js`.

## Concerns

- None for Task 12c scope.
- Report commit id cannot be self-referenced inside this committed report file without changing the commit hash; the implementation commit id is recorded above and the final response records the final report commit id.
