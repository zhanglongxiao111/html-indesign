# Task 11a Report

## Status

DONE

## Changed Files

- `AGENTS.md`
- `scripts/indesign-reverse-export.js`
- `src/reverse-pipeline/index.js`
- `src/authoring/index.js`
- `src/indesign-cli-plugin/tools/reverse-export.js`
- `src/indesign-cli-plugin/tools/authoring-lint.js`
- `test/indesign-reverse/cli.test.js`
- `test/paged-html/authoring-lint-cli.test.js`
- `test/architecture/baselines/G1.json`
- `.superpowers/sdd/task-11a-report.md`

## RED Evidence

Added tests before implementation:

- `test/indesign-reverse/cli.test.js` asserts the CLI export reuses the src reverse pipeline entry.
- `test/paged-html/authoring-lint-cli.test.js` asserts the public `src/authoring` entry exports `lintAuthoringPackage`.

Initial RED command:

```text
node --test test/indesign-reverse/cli.test.js test/paged-html/authoring-lint-cli.test.js
```

Initial RED result:

- Failed because `../../src/writers/html/reverse-pipeline` did not exist.
- Failed because `require('../../src/authoring').lintAuthoringPackage` was `undefined`.

## GREEN Evidence

Implemented:

- Moved the single active `compileReverseSnapshotToHtml` implementation into `src/reverse-pipeline/index.js`.
- Kept `scripts/indesign-reverse-export.js` as a thin CLI wrapper around the src pipeline entry.
- Updated `src/indesign-cli-plugin/tools/reverse-export.js` to import the public src pipeline entry.
- Exported `lintAuthoringPackage` through `src/authoring/index.js`.
- Updated `src/indesign-cli-plugin/tools/authoring-lint.js` to import from `../../authoring`.

Note: the pipeline entry landed at `src/reverse-pipeline/index.js` instead of `src/writers/html/reverse-pipeline.js` because the pipeline orchestrates adapter, reconstruction, and writer modules. Placing it under `src/writers/html` created a new G1.1 writer-to-adapter direction violation; the top-level public src entry preserves the task intent without adding a new G1 baseline.

## G1 Baseline

Deleted exactly these two 11a exemptions from `test/architecture/baselines/G1.json`:

- `G1.3 src must not require scripts`: `src/indesign-cli-plugin/tools/reverse-export.js` requires `scripts/indesign-reverse-export.js`.
- `G1.5 plugin uses public module entries`: `src/indesign-cli-plugin/tools/authoring-lint.js` requires internal module `src/authoring/lint.js`.

Retained these three 11d exemptions:

- `G1.1 adapters-writers direction`: `src/adapters/html/normalizer/snapshot-to-model.js` requires `src/writers/indesign/style-compiler.js`.
- `G1.1 adapters-writers direction`: `src/writers/indesign/graphic-instructions.js` requires `src/adapters/html/reader/asset-detector.js`.
- `G1.1 adapters-writers direction`: `src/writers/indesign/instructions-compiler.js` requires `src/adapters/html/normalizer/snapshot-to-model.js`.

## Validation

```text
node --test test/indesign-reverse/cli.test.js test/paged-html/authoring-lint-cli.test.js
PASS: 16 tests, 0 failures.

node --test test/architecture/dependency-direction.test.js
PASS: 10 tests, 0 failures.

npm test
PASS: 914 tests, 0 failures.

git diff --check
PASS: no whitespace errors.
```

Additional manual checks:

```text
rg -n "require\(['\"]\.\./\.\./\.\./scripts/indesign-reverse-export|require\(['\"]\.\./\.\./authoring/lint" src scripts test
PASS: no stale plugin requires.

rg -n "function compileReverseSnapshotToHtml" src scripts
PASS: only one active function definition, in src/reverse-pipeline/index.js.
```

## Risks / Unhandled Items

- The three 11d G1.1 adapter/writer direction exemptions remain intentionally untouched.
- No reverse export output shape, file names, report fields, reconstruction behavior, author package behavior, plugin host action/resume behavior, or authoring lint behavior were intentionally changed.
