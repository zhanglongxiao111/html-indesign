# Task 2 Report: G1 dependency-direction architecture guardrail

## Status

DONE

## Scope

- Added `test/architecture/dependency-direction.test.js` for G1 only.
- Added `test/architecture/baselines/G1.json` with the current real scanned violations.
- Reused Task 1 helpers:
  - `test/architecture/helpers/require-graph.js`
  - `test/architecture/helpers/baseline-ratchet.js`
  - `test/architecture/helpers/guardrail-report.js`
- Fixed `require-graph` parsing of regular expression literals so the G1 scan can cover real `src/` and `scripts/` files instead of failing on quoted regex character classes.

## RED Evidence

Initial human-made violation sample failed before implementation:

```text
not ok 1 - G1 catches an adapters to writers require sample and reports the required fields
Expected values to be strictly deep-equal:
+ []
- [
-   {
-     detail: 'requires src/writers/indesign/style-compiler.js',
-     file: 'src/adapters/html/example.js',
-     rule: 'G1.1 adapters-writers direction'
-   }
- ]
```

The full-repo scan then failed visibly before the baseline existed:

```text
ENOENT: no such file or directory, open '...\\test\\architecture\\baselines\\G1.json'
```

With an empty baseline, the guardrail reported the real current violations through `guardrail-report` with the required four fields:

```text
Rule: G1 dependency direction
Reason: Format adapters and writers must stay separated by the semantic model layer.
Remediation: Move cross-format orchestration into semantic-model, shared, or a higher-level pipeline instead of requiring across layers.
Spec: docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1
```

## Baseline

The initial G1 baseline was generated from the real guardrail scan, not copied from the review report. It contains exactly these current violations:

1. `src/adapters/html/normalizer/snapshot-to-model.js` requires `src/writers/indesign/style-compiler.js`.
2. `src/writers/indesign/graphic-instructions.js` requires `src/adapters/html/reader/asset-detector.js`.
3. `src/writers/indesign/instructions-compiler.js` requires `src/adapters/html/normalizer/snapshot-to-model.js`.
4. `src/indesign-cli-plugin/tools/reverse-export.js` requires `scripts/indesign-reverse-export.js`.
5. `src/indesign-cli-plugin/tools/authoring-lint.js` requires internal module `src/authoring/lint.js`.

Each exemption has `reason` and `cleanupRef: "W3"`. The baseline uses `compareViolationsToBaseline`, so it fails for both new violations and expired exemptions.

## Rules Implemented

- G1.1: `src/adapters/**` and `src/writers/**` may not require each other.
- G1.2: `src/semantic-model/`, `src/protocol/`, and `src/shared/` may not require adapters, writers, scripts, or semantic-reconstruction.
- G1.3: `src/**` may not require `scripts/**`.
- G1.4: `src/semantic-reconstruction/**` may not depend on unrelated downstream `src` modules; internal semantic-reconstruction edges and semantic-model/protocol/shared are allowed.
- G1.5: `src/indesign-cli-plugin/**` may only require other modules through public entries; plugin-internal requires are allowed.
- G1.6: local `src/` and `scripts/` require graph must be acyclic.

## Verification

```text
node --test test/architecture/dependency-direction.test.js
PASS: 2 tests, 0 failures
```

```text
npm test
PASS: 775 tests, 0 failures
```

## Concerns

None.

## Reviewer fix

### Scope

- Fixed reviewer finding 1 by making G1.4 reject any local resolved target outside `src/semantic-reconstruction`, `src/semantic-model`, `src/protocol`, and `src/shared`, including repo-root `index.js`.
- Fixed reviewer finding 2 by including the root public entrypoint `index.js` in the scanned local graph and running G1.6 cycle detection over the full scanned graph instead of filtering to `src` and `scripts` nodes.
- Fixed reviewer finding 3 by formatting G1 failures per failing subrule family, with distinct `Rule`, `Reason`, `Remediation`, and `Spec` fields for G1.0-G1.6.

### RED Evidence

Added regression tests first and ran:

```text
node --test test/architecture/dependency-direction.test.js
FAIL: 2 passed, 3 failed

Failed as expected:
- G1.4 sample returned [] instead of reporting src/semantic-reconstruction/reconstruct.js -> index.js.
- G1.6 sample returned [] instead of reporting index.js -> src/semantic-model/model.js -> index.js.
- Mixed G1.3/G1.4/G1.5/G1.6 failure report still emitted only Rule: G1 dependency direction with the G1.1 cross-format remediation.
```

### GREEN Evidence

```text
node --test test/architecture/dependency-direction.test.js
PASS: 5 tests, 0 failures
```

```text
npm test
PASS: 778 tests, 0 failures
```

### Files changed

- `test/architecture/dependency-direction.test.js`
- `.superpowers/sdd/task-2-report.md`

### Baseline changes

None. The stricter scan did not introduce new current-repo violations beyond the existing `test/architecture/baselines/G1.json` exemptions.

### Self-review

- Confirmed G1.4 still allows same-layer semantic-reconstruction dependencies plus the approved upstream layers, but now rejects root or other local resolved targets.
- Confirmed G1.6 no longer drops non-`src`/`scripts` nodes once they are part of the scanned local graph.
- Confirmed failure text for G1.3, G1.4, G1.5, and G1.6 no longer tells the user only to move cross-format orchestration.

## Second reviewer fix

### Scope

- Removed the ad hoc regex parser used for root public entrypoint require scanning in `test/architecture/dependency-direction.test.js`.
- Added `collectRequireGraphFromFiles` to `test/architecture/helpers/require-graph.js` so G1 root entry files use the same parser semantics as Task 1 directory scans.
- Kept G1.6 root entry coverage intact by combining normal `src/` and `scripts/` graph edges with parser-backed root entrypoint file edges and observations.

### RED Evidence

Added the requested regression tests first and ran:

```text
node --test test/architecture/dependency-direction.test.js
FAIL: 5 passed, 2 failed

Failed as expected:
- Comment-wrapped root require `require(/* keep */ './src/semantic-model/model')` returned [] instead of reporting the G1.6 cycle through `index.js`.
- Require-looking text inside a root entrypoint string literal produced a false G1.6 cycle through `index.js`.
```

### GREEN Evidence

```text
node --test test/architecture/dependency-direction.test.js
PASS: 7 tests, 0 failures
```

```text
npm test
PASS: 780 tests, 0 failures
```

### Files changed

- `test/architecture/dependency-direction.test.js`
- `test/architecture/helpers/require-graph.js`
- `.superpowers/sdd/task-2-report.md`

### Baseline changes

None. The current repository scan still matches `test/architecture/baselines/G1.json`; no new exemptions were added.

### Self-review

- Confirmed the root-entry parallel parser path was deleted, including `extractStaticRootEntrypointRequireRequests`.
- Confirmed comment-wrapped root requires and string-literal false matches now follow the shared `require-graph` behavior.
- Confirmed root entrypoint dynamic relative require observations are no longer dropped from G1.0 handling.

## Third reviewer fix

### Scope

- Added real collector-path artificial violation samples for G1.2, G1.3, and G1.5 in `test/architecture/dependency-direction.test.js`.
- Each new sample builds a minimal temporary file tree and calls `collectG1Violations(root)` instead of manually constructing formatter input.
- The assertions check the exact rule id, violating source file, required target path, and failure detail field.
- No baseline semantics, exemptions, compatibility paths, or implementation code were changed.

### Verification

```text
node --test test/architecture/dependency-direction.test.js
PASS: 10 tests, 0 failures
```

```text
npm test
PASS: 783 tests, 0 failures
```
