# Task 1 Report: Architecture Guardrail Infrastructure

## Scope

- Added helper infrastructure only under `test/architecture/helpers/`.
- Added helper tests under `test/architecture/`.
- Did not implement G1-G8 guardrails.
- Did not edit `src/`.
- Did not edit the controller-owned plan progress file.

## TDD Evidence

RED:

```powershell
node --test test/architecture/
```

Observed failure after tests were added and before helpers existed:

```text
Error: Cannot find module './helpers/require-graph'
Require stack:
- test/architecture/require-graph.test.js
- test/architecture/index.js
```

GREEN:

```powershell
node --test test/architecture/
```

Observed result:

```text
# tests 7
# pass 7
# fail 0
```

## Files Added

- `test/architecture/index.js`
- `test/architecture/require-graph.test.js`
- `test/architecture/baseline-ratchet.test.js`
- `test/architecture/guardrail-report.test.js`
- `test/architecture/helpers/require-graph.js`
- `test/architecture/helpers/baseline-ratchet.js`
- `test/architecture/helpers/guardrail-report.js`

## Helper Behavior

- `require-graph.js`
  - Scans `.js` and `.cjs` files under explicit root directories.
  - Resolves static relative `require('...')` edges with Node resolution.
  - Ignores built-in and package requires.
  - Records dynamic `require(...)` expressions as observations only.
  - Throws on malformed roots or unresolved static relative requires.

- `baseline-ratchet.js`
  - Compares actual violations to `baseline.exemptions`.
  - Reports actual entries missing from the baseline as `newViolations`.
  - Reports baseline entries missing from actual violations as `expiredExemptions`.
  - Returns `passed: false` if either list is non-empty.
  - Throws on malformed actual violations or malformed baseline exemptions.

- `guardrail-report.js`
  - Requires all four failure fields: `rule`, `reason`, `remediation`, `specPath`.
  - Formats optional `newViolations` and `expiredExemptions` sections.
  - Throws if required fields or report lists are malformed.

## Notes

- Added `test/architecture/index.js` because the required command `node --test test/architecture/` is treated as a directory module entry in this Windows Node environment. The entry file loads the helper test files without adding guardrail behavior.
