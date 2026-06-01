# PPTX Adapter Contracts

This directory is Stage 10 contract-only surface for future PPTX support. There is no PPTX package read/write implementation yet.

The PPTX adapter boundary must use the Semantic Model and the protocol registry. PPTX must not introduce direct HTML <-> PPTX or InDesign <-> PPTX conversion paths, and PPTX-only facts must stay under `extensions.pptx.*`.

The current contract reserves:

- `PptxReaderContract`: accepts a `pptx-package`, produces a `pptx-raw-snapshot`, and normalizes into the Semantic Model.
- `PptxWriterContract`: accepts the Semantic Model, produces a future `pptx-package`, and persists roundtrip metadata through `pptx-custom-data`.
- `PptxContractCapabilities`: documents fallback/resource strategy for fields that PPTX cannot edit natively.

PDF/AI/PSD assets are fallback visual outputs in PPTX. Their visual output may be a preview image, but metadata persists losslessly through custom data so later adapters can roundtrip the original semantic facts.
