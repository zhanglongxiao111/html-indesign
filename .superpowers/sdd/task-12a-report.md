# Task 12a Report: W4 test directory naming cleanup and G5 zero baseline

## Status

Complete.

Implemented W4 Task 12a only:

- Renamed `test/paged-html/` to `test/html-to-indesign/`.
- Renamed `test/fixtures/paged-html/` to `test/fixtures/fixed-html/`.
- Renamed `test/indesign-reverse/` to `test/indesign-to-html/`.
- Updated package test globs, fixture path references, current plan command/path references, and semantic-model test fixture references.
- Reduced `test/architecture/baselines/G5.json` to an empty exemptions list.
- Removed the G5 test helper path aggregation for the retired test directories; G5 still scans retired path tokens and reports the actual violating file path.

## Commit

- Implementation/report commit: `423340bd656176920df5f6bc9d4a84e5711c3292`
- Final report hash-sync commit: recorded in final response.

## Files Changed

- `package.json`
- `docs/superpowers/plans/2026-07-06-architecture-hardening-guardrails-implementation-plan.md`
- `.superpowers/sdd/task-12a-report.md`
- `test/architecture/baselines/G5.json`
- `test/architecture/retired-naming.test.js`
- `test/semantic-model/from-snapshot.test.js`
- `test/semantic-model/to-instructions.test.js`
- Renamed all files under:
  - `test/paged-html/` -> `test/html-to-indesign/`
  - `test/fixtures/paged-html/` -> `test/fixtures/fixed-html/`
  - `test/indesign-reverse/` -> `test/indesign-to-html/`

## Verification

RED before implementation:

- `node --test test/architecture/retired-naming.test.js`
  - Expected fail after temporarily emptying `G5.json`.
  - Output summary: 1/2 passed, 1 failed.
  - Failure listed exactly two new violations:
    - `test/fixtures/paged-html`
    - `test/paged-html`

Implementation verification:

- `node --test test/architecture/retired-naming.test.js`
  - Pass: 2/2.

- `node --test "test/html-to-indesign/**/*.test.js" "test/indesign-to-html/**/*.test.js"`
  - Pass: 439/439.

- `node --test test/architecture/`
  - Pass: 59/59.

- `npm test`
  - Pass: 919/919.

- `rg "test/paged-html|test/fixtures/paged-html|test/indesign-reverse" package.json test src scripts _indesign_scripts docs/superpowers/plans/2026-07-06-architecture-hardening-guardrails-implementation-plan.md`
  - Initial implementation pass: no matches, command exited 1 as expected for no results.
  - Superseded for the plan document by the post-review fix below: historical progress records intentionally retain the paths that were actually run at the time.

- `git diff --check`
  - Pass: no whitespace errors.

## Post-review Fix

Fermat review result: `SPEC: PASS`, `QUALITY: FAIL` for P2 documentation scope drift.

Fix applied:

- Restored historical progress and acceptance-command records in `docs/superpowers/plans/2026-07-06-architecture-hardening-guardrails-implementation-plan.md` to their original recorded paths:
  - `test/indesign-reverse/...`
  - `test/paged-html/instructions-compiler.test.js`
- Kept active Task 12a implementation paths unchanged:
  - `test/html-to-indesign/`
  - `test/fixtures/fixed-html/`
  - `test/indesign-to-html/`
- Did not change `package.json`, test fixture references, actual test directories, or `test/architecture/baselines/G5.json`.

Post-review verification:

- `node --test test/architecture/retired-naming.test.js`
  - Pass: 2/2.

- `node --test test/architecture/`
  - Pass: 59/59.

- `npm test`
  - Pass: 919/919.

- `git diff --check HEAD~1..HEAD`
  - Pass: no whitespace errors in the fix commit range.

## Concerns

None.
