# Follow-up Task 2 Report

## Changed Files

- `src/protocol/registry.js`
- `src/protocol/field-query.js`
- `src/protocol/validators/validate-retired-fields.js`
- `src/protocol/fields/retired.js`
- `src/protocol/fields/reverse-surfaces.js`
- `docs/规范/PROTOCOL_FIELD_REGISTRY.md`
- `test/protocol/lifecycle.test.js`
- `test/protocol/validate-retired-fields.test.js`
- `test/protocol/validate-model-fields.test.js`
- `test/protocol/current-field-facts.test.js`
- `test/protocol/generated-docs.test.js`

## RED

Command:

```powershell
node --test test/protocol/lifecycle.test.js test/protocol/validate-retired-fields.test.js
```

Result: failed as expected, 19 pass / 3 fail.

Failure summary:

- `lifecyclePolicyFor returns retired model path policies from retired registry entries` failed with `LIFECYCLE_POLICY_INVALID:items[].type`.
- `retired model paths are reported from retired policy instead of unknown fields` failed because `validateRetiredFields` returned no retired model path observation.
- `retired field validation rejects unknown retired model paths visibly` failed because unknown `modelPaths` were silently ignored and the result stayed valid.

## GREEN

Commands:

```powershell
node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
node --test test/protocol/lifecycle.test.js test/protocol/validate-retired-fields.test.js test/protocol/validate-model-fields.test.js test/protocol/current-field-facts.test.js test/protocol/generated-docs.test.js
node --test test/protocol/registry.test.js test/protocol/field-entry.test.js test/protocol/constants.test.js
```

Result:

- Final focused tests: 82 pass / 0 fail.
- Related protocol tests: 31 pass / 0 fail.

## Commit

`103b5fc18b5818ed5e5a82912f0a8497697a87d2`

Message:

```text
protocol: complete retired model path lifecycle
```

## Concerns

- No unresolved implementation concerns.
- `npm run docs:protocol` is not defined in this repository, so the existing generator command used by `test/protocol/generated-docs.test.js` was used instead.

---

# Follow-up Task 2 Fix Report

## Changed Files

- `src/protocol/registry.js`
- `src/protocol/fields/retired.js`
- `src/protocol/scanners/scan-model-paths.js`
- `docs/规范/PROTOCOL_FIELD_REGISTRY.md`
- `test/protocol/registry.test.js`
- `test/protocol/field-entry.test.js`
- `test/protocol/current-field-facts.test.js`
- `test/protocol/validate-model-fields.test.js`

## RED

Command:

```powershell
node --test test/protocol/registry.test.js test/protocol/validate-model-fields.test.js test/protocol/current-field-facts.test.js
```

Result: failed as expected, 58 pass / 6 fail.

Failure summary:

- `registry owns retired model paths from retired.modelPaths without currentPaths duplication` failed because `getByPath('items[].effects')` returned `null`.
- `registry rejects retired model paths that duplicate active path ownership` failed because retired model paths were not part of registry path ownership.
- `strict DocumentModel validation rejects retired flat InDesign surface paths` failed because flat `effects` / `textFrameStyle` scanned as `pages[].items[].*` unknown paths instead of retired model paths.
- Current-field-facts tests failed because retired model entries still duplicated old flat paths in `currentPaths`.

## GREEN

Commands:

```powershell
node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
node --test test/protocol/lifecycle.test.js test/protocol/validate-retired-fields.test.js test/protocol/validate-model-fields.test.js test/protocol/current-field-facts.test.js test/protocol/generated-docs.test.js
node --test test/protocol/registry.test.js test/protocol/field-entry.test.js test/protocol/constants.test.js
node --test "test/protocol/**/*.test.js"
```

Result:

- Focused tests: 82 pass / 0 fail.
- Related protocol tests: 33 pass / 0 fail.
- Full protocol suite: 170 pass / 0 fail.

## Commit

Final commit hash is reported in the task response.

Message:

```text
protocol: fix retired model path ownership
```

## Concerns

- No unresolved implementation concerns.
- `npm run docs:protocol` is not defined in this repository, so the existing generator command used by `test/protocol/generated-docs.test.js` was used instead.
