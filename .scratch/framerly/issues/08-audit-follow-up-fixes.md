# 08: Audit Follow-up Fixes

**What to build:** Fixes for the problems surfaced by the 2026-10-18 code audit that were not already tracked in 06/07: rotated-Picture rendering correctness, hidden and silent failures, and ingestion races. Glossary and JSDoc cleanup rode along as a refactor.

**Blocked by:** 05: Adjustment Modal and Card Actions

**Status:** done

- [x] `Fit with Blurred Background` rotated Pictures render a rotated blur layer in the Picture's own aspect, not a stretched unrotated draw
- [x] Auto-Centering remaps the focal point into the rotated Picture space for 90/180/270 turns
- [x] Download errors surface inside the Adjustment Modal while it is open; the page alert waits so the error is announced once
- [x] Clear Batch is disabled while the Adjustment Modal holds in-progress work
- [x] A failed directory traversal shows an alert in the Batch Dropzone instead of an unhandled rejection
- [x] `useBatchIngest` counts overlapping runs, cancels decoding after `clearBatch` via a generation counter, and resolves chunk results through a Map instead of an O(N^2) `indexOf` scan; the hook has tests at the Batch state seam
- [x] HEIC conversion is cached per File for repeat downloads (failures stay retryable); the download Blob URL is revoked on a delayed task so Firefox/Safari downloads are not cancelled
- [x] An ErrorBoundary wraps the app so a render crash shows an error screen with a reload action
- [x] The Adjustment Modal preview pans with the arrow keys (Shift = bigger step); the Crop Mode control uses a roving tabindex with arrow-key cycling
- [x] `CropToFillPlacement` / `calculateCropToFillPlacement` replace the off-glossary Aspect Fill names; the Frame preview marker is `ApertureBox` (testid `aperture-box`); `useBatch.ts` renamed to `useBatchIngest.ts`; `FrameUploader` and `App` carry the JSDoc the contribution rules require

## Comments

- 2026-10-18: Implemented across nine commits: 50c254b (rotation rendering), f2d4d6d (modal error visibility), f76d0a9 (Clear Batch guard), dc937b5 (ingestion races + tests), ad95525 (dropzone traversal error), 24502d3 (HEIC cache + deferred revocation), d85de89 (ErrorBoundary), 60f0e4a (keyboard access), 70a174d (glossary refactor). Full suite 139 tests green, typecheck and production build clean. Remaining audit findings live in 06 (Batch Export) and 07 (informative error messages, polish).
