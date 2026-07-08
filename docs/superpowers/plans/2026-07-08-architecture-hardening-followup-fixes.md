# Architecture Hardening Follow-up Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every actionable issue found by the 2026-07-08 core-code growth audit without adding new compatibility paths, fallback behavior, or long-lived scratch artifacts.

**Architecture:** This is a shrink-and-close plan, not a new feature plan. Fixes must converge existing protocol lifecycle, reverse audit gates, architecture guardrails, and shared helper ownership into single source paths, then record the long-term boundary in docs.

**Tech Stack:** Node.js built-in test runner, CommonJS modules, existing `src/protocol`, `src/reverse-pipeline`, `src/writers/*/audit`, `test/architecture`, and `docs/AI协作` workflows.

## Global Constraints

- `.superpowers/` remains local scratch and must not be tracked by Git.
- `.codex/skills/` remains the repository skill source; do not move skills into `.superpowers/`.
- Retired fields must be registered in `src/protocol/fields/retired.js`; `migration.from` and description text cannot substitute for lifecycle.
- Audit gates must fail early and visibly; no script-only stronger gate, no reverse-export weaker path, no false success.
- Shared helper semantics must have a single executable source; do not preserve renamed duplicate helpers as "compatibility".
- Architecture baselines must not allow silent new exemptions.
- Do not run real InDesign E2E for this plan unless a task touches executor output or explicitly needs real ID verification.

---

### Task 1: Remove Tracked `.superpowers` Process Reports

**Files:**
- Remove from index: `.superpowers/sdd/*.md`
- Keep local only: `.superpowers/sdd/progress.md`, review packages, briefs, reports
- Verify: `.gitignore`

**Interfaces:**
- Consumes: existing `.gitignore` entry `.superpowers/`
- Produces: no tracked `.superpowers/sdd/*.md`

- [x] **Step 1: Verify tracked scratch files**

Run:

```powershell
git ls-files .superpowers/sdd/*.md
```

Expected before fix: the command may list tracked process reports.

- [x] **Step 2: Remove tracked reports from Git only**

Run:

```powershell
$files = git ls-files '.superpowers/sdd/*.md'
if ($files) { git rm --cached -- $files }
```

Expected: files are staged as deletions but still exist locally.

- [x] **Step 3: Verify scratch remains usable but untracked**

Run:

```powershell
git ls-files .superpowers/sdd/*.md
Test-Path .superpowers/sdd/progress.md
```

Expected:

```text
<no tracked files>
True
```

- [x] **Step 4: Commit**

```powershell
git add .gitignore
git commit -m "chore: stop tracking superpowers scratch reports"
```

Expected: commit removes only tracked `.superpowers/sdd/*.md` from version control.

Completed in `f562732`: `git ls-files .superpowers` has no output, `.superpowers/sdd/progress.md` remains available locally, and the branch is pushed to `origin/codex/architecture-hardening-guardrails`.

### Task 2: Complete Retired Model Path Lifecycle Governance

**Files:**
- Modify: `src/protocol/registry.js`
- Modify: `src/protocol/field-query.js`
- Modify: `src/protocol/validators/validate-retired-fields.js`
- Modify: `src/protocol/fields/retired.js`
- Modify: `src/protocol/fields/reverse-surfaces.js`
- Modify: `src/protocol/docs/generate-field-docs.js`
- Test: `test/protocol/lifecycle.test.js`
- Test: `test/protocol/validate-retired-fields.test.js`
- Test: `test/protocol/validate-model-fields.test.js`
- Test: `test/protocol/current-field-facts.test.js`
- Test: `test/protocol/generated-docs.test.js`

**Interfaces:**
- Consumes: `fieldRegistry.getByPath(path)`, `lifecyclePolicyFor(fieldRegistry, path)`, existing retired HTML attr policy
- Produces: registered and queryable retired model paths for `items[].type`, `items[].effects`, and `items[].textFrameStyle`

- [ ] **Step 1: Add failing lifecycle tests**

Add tests proving:

```js
assert.equal(lifecyclePolicyFor(fieldRegistry, 'items[].type').lifecycle, 'retired');
assert.equal(lifecyclePolicyFor(fieldRegistry, 'items[].effects').lifecycle, 'retired');
assert.equal(lifecyclePolicyFor(fieldRegistry, 'items[].textFrameStyle').lifecycle, 'retired');
```

Also assert `validateRetiredFields(fieldRegistry, { modelPaths: ['items[].effects'] })` reports retired policy rather than unknown field.

Run:

```powershell
node --test test/protocol/lifecycle.test.js test/protocol/validate-retired-fields.test.js
```

Expected: FAIL before implementation.

- [ ] **Step 2: Index retired model paths in registry**

Extend `src/protocol/registry.js` with a `byRetiredModelPath` index parallel to `byRetiredHtmlAttr`. The index must read `field.retired.modelPaths[].path` and must not infer retired fields from `migration.from`.

- [ ] **Step 3: Teach lifecycle query about retired model paths**

Update `src/protocol/field-query.js` so `lifecyclePolicyFor(fieldRegistry, 'items[].type')` and the two flat reverse paths return a retired policy object with `replacedBy`, `readPolicy`, and field metadata.

- [ ] **Step 4: Extend retired validator input**

Update `src/protocol/validators/validate-retired-fields.js` to accept:

```js
validateRetiredFields(fieldRegistry, {
  htmlAttrs: ['data-id-page'],
  modelPaths: ['items[].effects'],
});
```

Strict invalid model paths must fail visibly; they must not be silently ignored.

- [ ] **Step 5: Register flat reverse paths as retired**

Add formal retired entries for:

```text
items[].effects -> items[].extensions.indesign.effects
items[].textFrameStyle -> items[].extensions.indesign.textFrameStyle
```

Keep current active extension fields in `src/protocol/fields/reverse-surfaces.js`, but remove wording that treats `migration.from` as the lifecycle source.

- [ ] **Step 6: Update generated docs**

Run:

```powershell
npm run docs:protocol
```

If there is no script for this repository, run the existing generator command used by `test/protocol/generated-docs.test.js` and record it in the task report.

- [ ] **Step 7: Verify**

Run:

```powershell
node --test test/protocol/lifecycle.test.js test/protocol/validate-retired-fields.test.js test/protocol/validate-model-fields.test.js test/protocol/current-field-facts.test.js test/protocol/generated-docs.test.js
```

Expected: all pass; retired model paths are documented in `docs/规范/PROTOCOL_FIELD_REGISTRY.md`.

- [ ] **Step 8: Commit**

```powershell
git add src/protocol docs/规范/PROTOCOL_FIELD_REGISTRY.md test/protocol
git commit -m "protocol: complete retired model path lifecycle"
```

### Task 3: Unify Reverse Export and E2E Author Audit Gates

**Files:**
- Modify: `src/reverse-pipeline/index.js`
- Modify: `src/writers/html/audit/reverse-roundtrip.js`
- Modify: `scripts/indesign-e2e.js`
- Modify: `scripts/indesign-reverse-export.js` if CLI options need source audit wiring
- Modify: `src/indesign-cli-plugin/tools/reverse-export.js`
- Test: `test/indesign-to-html/cli.test.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`
- Test: `test/indesign-e2e-runner.test.js`
- Test: `test/indesign-to-html/source-roundtrip-cli.test.js`

**Interfaces:**
- Consumes: `compileReverseSnapshotToHtml(options)`
- Produces: one `src`-level reverse author audit result used by CLI, plugin resume, and E2E

- [ ] **Step 1: Add failing tests for strong reverse pipeline audit**

Add a test that calls `compileReverseSnapshotToHtml({ sourceRoot, ... })` and asserts returned author audit includes:

```js
result.files.author.audit.sourceRoundtrip
result.files.author.audit.contentInventory
result.files.author.audit.structureSignature
```

Also assert an invalid content inventory produces `ok: false` from the same pipeline, not only from `scripts/indesign-e2e.js`.

Run:

```powershell
node --test test/indesign-to-html/cli.test.js test/indesign-e2e-runner.test.js
```

Expected: FAIL before implementation.

- [ ] **Step 2: Route reverse pipeline through high-level audit**

In `src/reverse-pipeline/index.js`, replace direct low-level `author-audit` usage with `src/writers/html/audit/reverse-roundtrip.js` when source package context is present.

The pipeline must accept explicit options:

```js
{
  sourceRoot,
  strictSourceRoundtrip,
  strictStructureSignature,
}
```

No default sourceRoot inference outside the provided reverse/export context.

- [ ] **Step 3: Thin E2E script to consume pipeline audit**

Update `scripts/indesign-e2e.js` so first-pass author audit comes from the reverse pipeline result. E2E may still run second-pass stability, but it must not recompute a stronger first-pass gate only in the script.

- [ ] **Step 4: Keep plugin reverse export fail-visible**

Ensure `src/indesign-cli-plugin/tools/reverse-export.js` passes any available source-root context into `compileReverseSnapshotToHtml` and surfaces `author.audit.ok === false` as a failed plugin result, not a successful result with warnings.

- [ ] **Step 5: Verify**

Run:

```powershell
node --test test/indesign-to-html/cli.test.js test/indesign-cli-plugin/plugin-tools.test.js test/indesign-e2e-runner.test.js test/indesign-to-html/source-roundtrip-cli.test.js
```

Expected: all pass; reverse export and E2E share the same first-pass author audit result.

- [ ] **Step 6: Commit**

```powershell
git add src/reverse-pipeline src/writers/html/audit scripts/indesign-e2e.js scripts/indesign-reverse-export.js src/indesign-cli-plugin test/indesign-to-html test/indesign-cli-plugin test/indesign-e2e-runner.test.js
git commit -m "audit: unify reverse author gates"
```

### Task 4: Move Reverse Visual Evidence Enrichment into `src`

**Files:**
- Create or modify: `src/writers/html/audit/reverse-visual-evidence.js`
- Modify: `src/writers/html/audit/visual-geometry-audit.js` if the compare API should own enrichment
- Modify: `scripts/audit-reverse-visual.js`
- Test: `test/indesign-to-html/visual-geometry-cli.test.js`
- Test: `test/indesign-to-html/visual-geometry-audit.test.js`

**Interfaces:**
- Consumes: reverse snapshot/model source metadata
- Produces: `enrichCaptureWithReverseModelSourceMetadata(capture, reverseModel)` exported from `src`

- [ ] **Step 1: Add failing src-level evidence test**

Move the existing script-only evidence enrichment assertion into a `src` audit test. The test must import from `src/writers/html/audit/...`, not `scripts/audit-reverse-visual.js`.

Run:

```powershell
node --test test/indesign-to-html/visual-geometry-audit.test.js test/indesign-to-html/visual-geometry-cli.test.js
```

Expected: FAIL before implementation if no src export exists.

- [ ] **Step 2: Move enrichment helpers**

Move these helpers out of `scripts/audit-reverse-visual.js`:

```text
loadReverseHtmlEvidence
enrichCaptureWithReverseModelSourceMetadata
reverseModelSourceMetadataByKey
collectReverseModelSourceMetadata
```

Keep script responsibilities limited to argument parsing, file loading, calling src helpers, output writing, and exit code mapping.

- [ ] **Step 3: Verify**

Run:

```powershell
node --test test/indesign-to-html/visual-geometry-audit.test.js test/indesign-to-html/visual-geometry-cli.test.js
```

Expected: all pass; script imports enrichment from `src`.

- [ ] **Step 4: Commit**

```powershell
git add src/writers/html/audit scripts/audit-reverse-visual.js test/indesign-to-html
git commit -m "audit: move reverse visual evidence into src"
```

### Task 5: Harden Architecture Guardrails Against False Green

**Files:**
- Modify: `test/architecture/helpers/baseline-ratchet.js`
- Modify: `test/architecture/audit-fail-closed.test.js`
- Modify: `test/architecture/dependency-direction.test.js`
- Modify: `test/architecture/protocol-literals.test.js`
- Modify: `test/architecture/retired-naming.test.js`
- Modify: `test/architecture/single-implementation.test.js`
- Modify: `test/architecture/docs-code-sync.test.js`
- Modify: `test/architecture/orphan-modules.test.js`
- Modify: `test/architecture/baselines/G*.json`

**Interfaces:**
- Consumes: actual guardrail violations and baseline files
- Produces: baseline comparison that fails on newly added exemptions unless an explicit reviewed start-point is encoded

- [ ] **Step 1: Add failing baseline anti-expansion tests**

In `test/architecture/helpers/baseline-ratchet.js` tests, add coverage proving a baseline with a new exemption fails unless the guardrail explicitly declares an approved starting baseline.

Run:

```powershell
node --test test/architecture/baseline-ratchet.test.js test/architecture/single-implementation.test.js
```

Expected: FAIL before implementation.

- [ ] **Step 2: Extend baseline ratchet helper**

Add an option such as:

```js
compareViolationsToBaseline({
  actualViolations,
  baseline,
  approvedBaseline,
  forbidNewExemptions: true,
});
```

If `forbidNewExemptions` is true, any exemption not present in `approvedBaseline` must be reported separately as a baseline expansion failure.

- [ ] **Step 3: Apply anti-expansion to G1/G2/G4/G5/G6/G7/G8**

Wire every architecture guardrail to forbid silent baseline growth. Because current baselines are empty, approved baseline should also be empty for these rules.

- [ ] **Step 4: Replace G4 name-only invalid-input coverage**

Change G4.1 so it does not accept empty tests that merely contain the required name. Acceptable evidence must be one of:

```text
spawnSync(...) or equivalent process execution with nonzero exit assertion
assert.throws(...) against invalid input
assert.equal(result.ok, false) plus a specific error code assertion
```

Keep G4.2 process execution for audit scripts.

- [ ] **Step 5: Exclude transient workspace from G4 scans**

Change G4 file collection to exclude `test/workspace/` and handle `ENOENT` during recursive scans without turning missing temporary directories into guardrail failures.

- [ ] **Step 6: Verify**

Run:

```powershell
node --test test/architecture/
```

Expected: 61+ tests pass; added tests prove baseline expansion and empty invalid-input tests fail.

- [ ] **Step 7: Commit**

```powershell
git add test/architecture
git commit -m "test: harden architecture guardrails"
```

### Task 6: Consolidate Shared Helpers and Expand G6 Semantic Coverage

**Files:**
- Modify or create: `src/writers/html/asset-path-helpers.js` or `src/shared/assets.js`
- Modify: `src/writers/html/asset-reference-policy.js`
- Modify: `src/writers/html/author-asset-packager.js`
- Modify: `src/writers/html/author-resource-paths.js`
- Modify: `src/writers/html/audit/source-roundtrip-diff.js`
- Modify: `src/style-synthesis/index.js`
- Modify: `src/style-synthesis/box-model.js`
- Modify: `src/writers/indesign/table-instructions.js`
- Modify: `src/writers/indesign/instruction-writer.js`
- Modify: `src/shared/text.js` if an instruction-text helper belongs there
- Modify: `test/architecture/single-implementation.test.js`
- Test: `test/shared/assets.test.js`
- Test: `test/shared/text.test.js`
- Test: `test/indesign-to-html/asset-reference-policy.test.js`
- Test: `test/html-to-indesign/instructions-compiler.test.js`
- Test: `test/semantic-model/to-instructions.test.js`

**Interfaces:**
- Consumes: current path normalization, remote detection, table width normalization, border visibility, text normalization behavior
- Produces: single executable helper per semantic family and a G6 guardrail that detects renamed duplicates

- [ ] **Step 1: Add failing behavior tests for canonical helper semantics**

Add tests for:

```text
file: URLs are not treated as remote HTTP-style references
path key normalization is identical in reference/copy/resource/audit paths
table width normalization has one named semantic contract
visibleBorder comes from box-model helper
instruction text normalization reuses shared text semantics or has a distinct explicit helper name
```

Run:

```powershell
node --test test/shared/assets.test.js test/shared/text.test.js test/indesign-to-html/asset-reference-policy.test.js test/html-to-indesign/instructions-compiler.test.js test/semantic-model/to-instructions.test.js
```

Expected: at least one new test fails before consolidation.

- [ ] **Step 2: Consolidate HTML asset path helpers**

Move `normalizePathKey`, `sourceFileKey`, `sanitizeRelative`, and remote-reference detection to one module. Prefer `src/shared/assets.js` if the helpers are format-neutral; otherwise use `src/writers/html/asset-path-helpers.js` and document that it is the HTML writer source of truth.

Delete local copies from writer/audit modules.

- [ ] **Step 3: Consolidate table width semantics**

Resolve the difference between:

```text
src/style-synthesis/index.js normalizeTableWidths
src/writers/indesign/table-instructions.js normalizeTableWidths
```

If both semantics are needed, rename one to describe its distinct contract and add tests. If not, delete one implementation and import the canonical helper.

- [ ] **Step 4: Consolidate border and text helpers**

Export `visibleBorder` from `src/style-synthesis/box-model.js` if writer needs it. Replace local `visibleBorder` in `instruction-writer.js`.

Replace `normalizeInstructionText` with shared text helpers, or move a clearly named helper to `src/shared/text.js` and use it from writer code.

- [ ] **Step 5: Expand G6 semantic families**

Update `test/architecture/single-implementation.test.js` so G6 checks semantic families, not only exact function names. Required families:

```text
asset path key and remote detection
text whitespace normalization
table width normalization
border visibility/uniformity
```

Add fixtures proving renamed duplicates fail.

- [ ] **Step 6: Verify**

Run:

```powershell
node --test test/architecture/single-implementation.test.js test/shared/assets.test.js test/shared/text.test.js test/indesign-to-html/asset-reference-policy.test.js test/html-to-indesign/instructions-compiler.test.js test/semantic-model/to-instructions.test.js
```

Expected: all pass; `rg` should show no duplicated helper definitions in the audited semantic families.

- [ ] **Step 7: Commit**

```powershell
git add src test
git commit -m "refactor: consolidate shared helper semantics"
```

### Task 7: Document the Closed Boundaries and Final Verification

**Files:**
- Modify: `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`
- Modify: `docs/规范/REVERSE_EXPORT.md`
- Modify: `docs/规范/PROTOCOL_FIELD_REGISTRY.md` if regenerated by Task 2
- Modify: `docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/汇总_架构硬化核心代码膨胀审计.md`
- Modify: `docs/superpowers/plans/README.md`
- Track: `docs/AI协作/本地Agent/进行中/2026-07-08_架构硬化核心代码膨胀审计/`

**Interfaces:**
- Consumes: fixes from Tasks 1-6
- Produces: current docs that describe the fixed boundary, not the pre-fix defect

- [ ] **Step 1: Update long-term specs**

Document these rules only after implementation is complete:

```text
.superpowers/ is local scratch only.
migration.from cannot replace retired lifecycle.
reverse export, plugin reverse export, and E2E share one src-level author audit gate.
architecture baselines cannot silently grow.
shared helper semantic families must have one executable source.
```

- [ ] **Step 2: Update audit summary**

In `汇总_架构硬化核心代码膨胀审计.md`, add a closeout section listing:

```text
fixed commits
remaining findings: none or explicit non-blocking follow-up
verification commands
```

- [ ] **Step 3: Register this plan**

Update `docs/superpowers/plans/README.md` with a link to this plan.

- [ ] **Step 4: Final verification**

Run:

```powershell
git ls-files .superpowers
node --test test/architecture/
node --test test/protocol/
node --test test/indesign-to-html/cli.test.js test/indesign-to-html/visual-geometry-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js test/indesign-e2e-runner.test.js
node --test test/shared/assets.test.js test/shared/text.test.js test/html-to-indesign/instructions-compiler.test.js test/semantic-model/to-instructions.test.js
npm test
git diff --check
```

Expected:

```text
git ls-files .superpowers -> no output
all listed node --test commands pass
npm test passes
git diff --check has no output
```

- [ ] **Step 5: Final review**

Request final code review with the full branch diff after Tasks 1-7. The reviewer must explicitly check:

```text
no tracked .superpowers files
retired model paths are lifecycle-governed
reverse export and E2E author gates are not strong/weak split
G4/G6/baseline guardrails cannot false-green through names or exemptions
shared helper duplicates were removed rather than renamed
```

- [ ] **Step 6: Commit**

```powershell
git add docs test src scripts .gitignore
git commit -m "docs: close architecture hardening follow-up fixes"
```

## Completion Criteria

- No tracked `.superpowers/` files remain.
- `items[].type`, `items[].effects`, and `items[].textFrameStyle` have formal retired model path lifecycle behavior.
- Reverse export, plugin reverse export, and E2E use the same `src`-level first-pass author audit gate.
- Reverse visual evidence enrichment lives in `src`, not only in a script.
- G4 cannot pass with an empty name-only invalid-input test.
- G1/G2/G4/G5/G6/G7/G8 cannot silently grow baselines.
- G6 catches renamed duplicates for the identified helper semantic families.
- Asset path, table width, border visibility, and instruction text helper semantics have a single executable source or explicitly named distinct contracts.
- `npm test` and `git diff --check` pass.
