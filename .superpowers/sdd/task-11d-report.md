# Task 11d Report: Break HTML Adapter / InDesign Writer Direct Links

Date: 2026-07-08
Implementer: Codex implementation agent, no subagents used

## Changed Files

- `AGENTS.md`
- `index.js`
- `scripts/indesign-e2e.js`
- `src/adapters/html/normalizer/snapshot-to-model.js`
- `src/adapters/html/reader/asset-detector.js`
- `src/indesign-cli-plugin/tools/compile-instructions.js`
- `src/indesign-pipeline/index.js`
- `src/shared/assets.js`
- `src/style-synthesis/box-model.js`
- `src/style-synthesis/effect-style-mapping.js`
- `src/style-synthesis/index.js`
- `src/style-synthesis/style-identities.js`
- `src/style-synthesis/text-style-mapping.js`
- `src/writers/indesign/graphic-instructions.js`
- `src/writers/indesign/index.js`
- `test/architecture/baselines/G1.json`
- `test/indesign-e2e-runner.test.js`
- `test/indesign-executor/compiler-executor-workspace.js`
- `test/paged-html/instructions-compiler.test.js`
- `test/paged-html/instructions-validator.test.js`
- `test/protocol/current-field-facts.test.js`
- `test/shared/assets.test.js`

## Implementation Summary

- Moved `compileInstructions(snapshot)` orchestration to `src/indesign-pipeline/index.js`.
- Removed the active writer-layer `src/writers/indesign/instructions-compiler.js` entrypoint.
- Kept the public root API shape by composing `api.writers.indesign.compileInstructions` from the public pipeline boundary in `index.js`.
- Moved style synthesis implementation from `src/writers/indesign/*style*` helpers into `src/style-synthesis/`, and updated `snapshotToSemanticModel` to use that upstream-neutral module.
- Moved asset placement parsing into `src/shared/assets.js`; both HTML asset detection and InDesign graphic instructions now use the same `placementFromAttributes` implementation.
- Updated plugin/script/test callers to import snapshot-to-instructions compilation through `src/indesign-pipeline`.
- Updated AGENTS repository map for the two new top-level `src` ownership surfaces.

## RED Evidence

- After setting `test/architecture/baselines/G1.json` to an empty exemptions list, `node --test test/architecture/dependency-direction.test.js` failed with the expected three remaining G1.1 violations:
  - `src/adapters/html/normalizer/snapshot-to-model.js` requires `src/writers/indesign/style-compiler.js`
  - `src/writers/indesign/graphic-instructions.js` requires `src/adapters/html/reader/asset-detector.js`
  - `src/writers/indesign/instructions-compiler.js` requires `src/adapters/html/normalizer/snapshot-to-model.js`
- Added shared asset placement coverage first; `node --test test/shared/assets.test.js` failed before implementation because `placementFromAttributes` was not exported from `src/shared/assets.js`.

## GREEN Evidence

- `test/architecture/baselines/G1.json`: `{"exemptions":[]}`
- G1 baseline final count: 0
- `node --test test/architecture/dependency-direction.test.js`: pass, 10/10
- `node --test test/paged-html/style-compiler.test.js test/paged-html/instructions-compiler.test.js test/semantic-model/from-snapshot.test.js test/paged-html/synthesized-style-reader.test.js test/shared/assets.test.js test/public-api.test.js`: pass, 87/87
- `node --test test/architecture/docs-code-sync.test.js`: pass, 2/2
- `npm test`: final pass, 918/918

Note: the first `npm test` run before staging moved-file deletes failed in G2/G5/G6 with `ENOENT` on deleted tracked `src/writers/indesign/box-model.js`; after staging the file moves so Git index and filesystem matched, the same full suite passed 918/918.

## Behavior Change

No intended conversion behavior change. This is a dependency-boundary refactor:

- Existing public root API still exposes `api.writers.indesign.compileStyles`, `api.writers.indesign.compileInstructions`, `api.writers.indesign.validateInstructions`, and `api.writers.indesign.semanticModelToInstructions`.
- `compileInstructions` output shape and compile tests are unchanged.
- `snapshotToSemanticModel` still synthesizes styles for direct adapter callers.
- Asset placement fields are parsed by one shared implementation.

## Concerns

- No unresolved 11d concerns.
- 11e and 11f remain outside this task scope.
