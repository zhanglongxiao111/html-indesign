# Task 12b Report: Function split and border uniformity single implementation

## Status

PASS.

Implemented W4 Task 12b only:

- Split `instructionItemFor` in `src/writers/indesign/instruction-writer.js` into explicit base/text/graphic/table/line/shape helpers while keeping `instructionItemsFor` as the entry point.
- Split `compareVisualGeometry` in `src/writers/html/audit/visual-geometry-audit.js` into public orchestration plus page and element comparison helpers.
- Moved the shared `bordersAreUniform` / same-border comparison into `src/style-synthesis/box-model.js` and imported it from both previous call sites.
- Added a G6 guardrail test that fails when border uniformity comparison definitions reappear outside `src/style-synthesis/box-model.js`.

No changes were made to `SEMANTIC_CONTAINER_CLASSES`, blueprint/spec status lines, baseline budgets, or final closeout docs.

## Commit id(s)

- Final commit id: generated after this report file is written; see final task response for the immutable commit hash.

## Files changed

- `src/writers/indesign/instruction-writer.js`
- `src/writers/html/audit/visual-geometry-audit.js`
- `src/style-synthesis/box-model.js`
- `src/style-synthesis/index.js`
- `test/architecture/single-implementation.test.js`
- `.superpowers/sdd/task-12b-report.md`

## Verification

TDD red check:

```powershell
node --test test/architecture/single-implementation.test.js
```

Result: failed as expected before implementation. The new test reported duplicate definitions in `src/style-synthesis/index.js` and `src/writers/indesign/instruction-writer.js`.

Post-implementation checks:

```powershell
node --test test/architecture/single-implementation.test.js
```

Result: pass, 5/5 tests.

```powershell
rg "function bordersAreUniform|const bordersAreUniform|function sameCompiledBorder|function sameBorder" src/writers/indesign src/style-synthesis
```

Result: only:

```text
src/style-synthesis\box-model.js:function bordersAreUniform(borders) {
src/style-synthesis\box-model.js:function sameBorder(a, b) {
```

```powershell
node --test test/html-to-indesign/instructions-compiler.test.js test/html-to-indesign/style-compiler.test.js test/html-to-indesign/synthesized-style-compiler.test.js
```

Result: pass, 53/53 tests.

```powershell
node --test test/indesign-to-html/visual-geometry-audit.test.js test/indesign-to-html/visual-geometry-cli.test.js
```

Result: pass, 25/25 tests.

```powershell
npm test
```

Result: pass, 920/920 tests.

```powershell
git diff --check
```

Result: pass, no whitespace errors.

## Remaining concerns

- None for Task 12b scope.
- The report cannot contain the final commit hash before the commit object exists; the final response records the immutable commit id after commit creation.
