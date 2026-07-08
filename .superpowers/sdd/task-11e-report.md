# Task 11e Report: Move E2E Audit Helpers Out of Script

Date: 2026-07-08
Implementer: Codex implementation agent, no subagents used

## Changed Files

- `scripts/indesign-e2e.js`
- `src/writers/indesign/audit/e2e-result-audit.js`
- `src/writers/html/audit/reverse-roundtrip.js`
- `test/indesign-e2e-runner.test.js`
- `docs/superpowers/plans/2026-07-06-architecture-hardening-guardrails-implementation-plan.md`

## Moved Helpers

- `assertPanelNameAuditOk` -> `src/writers/indesign/audit/e2e-result-audit.js`
- `observedPanelNamesForHtml` -> `src/writers/indesign/audit/e2e-result-audit.js`
- `assertNoTextOverset` -> `src/writers/indesign/audit/e2e-result-audit.js`
- `isAllowedBuiltInPanelName` -> `src/writers/indesign/audit/e2e-result-audit.js`
- `auditReverseHtmlSemantics` -> `src/writers/html/audit/reverse-roundtrip.js`
- `assertReverseHtmlSemantics` -> `src/writers/html/audit/reverse-roundtrip.js`
- `auditReverseAuthorPackage` -> `src/writers/html/audit/reverse-roundtrip.js`
- `auditSecondPassAuthorStability` -> `src/writers/html/audit/reverse-roundtrip.js`

## Remaining Script Exports

`scripts/indesign-e2e.js` now exports only script-owned helpers:

- `architectureStyleNameMap`
- `buildBuildJsx`
- `buildExportJsx`
- `buildReverseSnapshotJsx`
- `createRunContext`
- `loadStyleNameMapForHtml`
- `parseArgs`
- `parseCliResultJson`
- `parseTargetSize`
- `resolveIndesignCliCommand`
- `runIndesignE2E`

## RED Evidence

- Updated `test/indesign-e2e-runner.test.js` to import audit helpers from the intended `src` modules and to assert the script no longer exports audit helpers.
- RED command: `node --test test/indesign-e2e-runner.test.js`
- RED result: failed with `Cannot find module '../src/writers/indesign/audit/e2e-result-audit'`, proving the test expected the new src-owned audit module before implementation.

## GREEN Evidence

- `node --test test/indesign-e2e-runner.test.js`: pass, 31/31
- `node --test test/architecture/dependency-direction.test.js test/architecture/docs-code-sync.test.js`: pass, 12/12
- `node --test test/architecture/orphan-modules.test.js`: pass, 5/5
- `node --test test/indesign-reverse/author-audit.test.js test/paged-html/instructions-compiler.test.js`: pass, 40/40
- `node --test test/indesign-e2e-runner.test.js test/architecture/dependency-direction.test.js test/architecture/docs-code-sync.test.js`: pass, 43/43
- `npm test`: pass, 919/919

## Behavior Change

No intended behavior change. The moved helpers preserve the same hard gate behavior, report filenames, warning/error codes, and script orchestration call sites. The script still performs E2E orchestration, CLI parsing, command execution, JSX generation wrapper calls, and run context creation.

## Concerns

- No unresolved 11e concerns.
- 11f real InDesign E2E regression remains outside this task scope.
