# Task 12d Report

## Status

Completed. W4 Task 12d documentation closeout is done: blueprint observation record, architecture-hardening spec status/deviations, implementation plan closeout checkboxes, and full architecture baseline audit are synchronized.

## Commit ids

- Final closeout commit id: recorded in the final response after commit creation. A commit cannot embed its own final hash without changing that hash.

## Files changed

- `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`
- `docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md`
- `docs/superpowers/plans/2026-07-06-architecture-hardening-guardrails-implementation-plan.md`
- `.superpowers/sdd/task-12d-report.md`

## Verification

- `node --test test/architecture/`
  - PASS: 61 tests, 0 failures.
- `npm test`
  - PASS: 925 tests, 0 failures.
- `rg "legacy|pagedHtml|paged-html" src scripts _indesign_scripts test --iglob "!docs/**" --glob "!test/workspace/**"`
  - PASS with intentional matches only: architecture retired-name guardrail samples; protocol tests that reject `legacy`; public API and baseline tests asserting retired `pagedHtml`/`paged-html` paths are absent; one allowlisted observation parser in `src/adapters/indesign/audit/reverse-snapshot-structure.js` that emits `legacy-label` as historical label observation, not as authoring/build path.
- Baseline emptiness check:
  - Initial double-quoted PowerShell command failed before execution because `$` inside JavaScript template strings was expanded by the shell.
  - Rerun exact logic with single-quoted Node code: `node -e 'const fs=require("fs"); const path="test/architecture/baselines"; for (const file of fs.readdirSync(path)) { const json=JSON.parse(fs.readFileSync(`${path}/${file}`, "utf8")); if ((json.exemptions||[]).length) throw new Error(`${file} has exemptions`); } console.log("all baselines empty");'`
  - PASS: `all baselines empty`.
- `git diff --check`
  - PASS: no whitespace errors.

## Remaining concerns

- No blocking concerns.
- `rg` still reports intentional `legacy`/`pagedHtml` strings in tests and the `legacy-label` observation parser. The architecture baseline is empty and these matches do not restore a retired authoring/build path.
