# Issue 12 Asset Frame Contract Fix Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task by task.

**Goal:** Close the three verified contract gaps in GitHub issue #12 so canonical asset frames validate consistently, AI artboards round-trip through real InDesign, and a cross-layer parent fill cannot produce a white block while the build reports success.

**Architecture:** Keep canonical fields in the existing semantic model and protocol registry. Normalize InDesign's AI-as-PDF observation at the InDesign adapter boundary, make the forward-fidelity gate consume that normalized model fact, and detect impossible HTML descendant paint order during instruction compilation. The cross-layer case fails before InDesign execution until the writer can preserve both authored layers and browser paint order without changing canonical layer facts.

**Tech Stack:** Node.js 20, `node:test`, Playwright HTML snapshot adapter, JavaScript instruction writer/validator, ExtendScript executor, JSON semantic preset, Markdown specifications.

---

### Task 1: Align the asset-fit whitelist with live canonical behavior

**Files:**
- Modify: `test/semantic-preset/semantic-preset.test.js`
- Modify: `presets/architecture-report/semantic-preset.json`
- Modify: `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`
- Verify: `docs/规范/REVERSE_EXPORT.md`

- [ ] Add a failing preset test asserting that `manual` and CSS-native `none` are known fit tokens.
- [ ] Run `node --test test/semantic-preset/semantic-preset.test.js` and confirm the new assertion fails because the standard preset omits both tokens.
- [ ] Add `manual` and `none` to the standard preset and document `manual` as the canonical explicit-content-geometry mode.
- [ ] Re-run the targeted test and confirm it passes.

### Task 2: Normalize real InDesign AI page observations to canonical artboards

**Files:**
- Modify: `test/indesign-to-html/reverse-model.test.js`
- Modify: `test/semantic-model/forward-fidelity-audit.test.js`
- Modify: `src/adapters/indesign/normalizer/snapshot-to-model.js`
- Modify: `src/semantic-model/audit/forward-fidelity.js`

- [ ] Add a failing reverse-normalizer test for an `.ai` link whose InDesign snapshot reports `placement.pageNumber`.
- [ ] Add a failing fidelity test proving expected `artboard: 1` matches the normalized actual model even though the raw snapshot only reports `pageNumber: 1`.
- [ ] Run both targeted test files and confirm the new cases fail for the intended missing-artboard reason.
- [ ] Normalize `.ai` placed assets by moving observed `pageNumber` to canonical `artboard` without mutating the raw snapshot, and make fidelity compare the normalized model asset.
- [ ] Re-run both targeted test files and confirm they pass while PDF page-number behavior remains unchanged.

### Task 3: Reject cross-layer ancestor fills that would cover descendants

**Files:**
- Modify: `test/semantic-model/to-instructions.test.js`
- Modify: `test/html-to-indesign/instructions-validator.test.js`
- Modify: `src/writers/indesign/instruction-writer.js`
- Modify: `src/writers/indesign/instructions-validator.js`

- [ ] Add a failing writer test with a filled parent on `content` and a nested graphic on lower `image`, asserting a dedicated compile error.
- [ ] Add a failing validator test asserting compile-report errors make instructions invalid before host execution.
- [ ] Run the two targeted test files and confirm the new cases fail.
- [ ] Detect the unsupported descendant paint-order conflict from canonical structure, effective fill, bounds overlap, and final layer order; record `NESTED_LAYER_PAINT_ORDER_UNSUPPORTED` with page/item evidence.
- [ ] Promote compiler report errors into instruction validation failures so plugin and E2E builds stop before InDesign.
- [ ] Re-run the targeted tests and the existing nested same-layer paint-order regression.

### Task 4: Publish the canonical authoring rule and regression coverage

**Files:**
- Modify: `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md`
- Modify in unified Skill repository: `D:/AI/mcp-indesign/skills/indesign-cli/references/html-authoring.md`
- Test: `test/html-to-indesign/authoring-validator.test.js`

- [ ] Document that PDF/AI source fields belong on the real `<object data="...">`/resource element, not a visual wrapper, and include `manual` crop geometry.
- [ ] Document the cross-layer limitation as an explicit compile failure with a safe authoring shape: keep a filled ancestor at or below its nested asset layer, or use a sibling background object.
- [ ] Synchronize the same rule to the only published unified Skill source after checking the separate repository status and using an isolated worktree if needed.
- [ ] Confirm existing authoring validation still rejects wrapper-only asset fields and accepts real resource elements.

### Task 5: Verify the complete fix

**Files:**
- Test: `test/`
- Verify: package and plugin artifacts

- [ ] Run all targeted regression files.
- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run plugin:validate` and `npm run pack:dry-run`.
- [ ] Run proportionate real InDesign verification for AI placement/artboard round-trip if a repository-safe AI fixture is available; otherwise record the exact environmental limitation and retain the unit/static executor evidence.
- [ ] Inspect `git diff --check`, worktree status, and the final diff; confirm no customer paths or private artifacts entered version control.
