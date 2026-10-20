# 06: Background Worker Batch ZIP Export

**What to build:** The complete Batch Export pipeline. Users click "Export All as ZIP", name the archive, choose JPEG or PNG, and watch a live progress bar while each Picture is rendered at full resolution in a background Web Worker. The rendered Framed Pictures are packed into a downloadable ZIP archive that preserves the exact original filenames.

**Blocked by:** 05: Adjustment Modal and Card Actions

**Status:** done

- [x] "Export All as ZIP" button opens a naming dialog, then triggers the full-resolution rendering pipeline
- [x] The naming dialog pre-fills `framerly-<YYYY-MM-DD>`, appends `.zip` when missing, strips path separators and Windows-illegal characters, and falls back to the default when the field is empty
- [x] The naming dialog closes on Escape or a backdrop click without exporting, and restores focus to the Export button; Enter starts the export
- [x] Pictures render one at a time in a background Web Worker using `OffscreenCanvas`, with the existing main-thread renderer as a capability fallback
- [x] Batch Export reuses the same full-resolution rendering seam as the single-Picture download, so pan, zoom, rotation, Auto-Centering, and Crop Mode all match the Visual Grid
- [x] Live progress bar displays processed count, percentage, and current filename
- [x] When rendering finishes the progress bar switches to an indeterminate "Packaging…" phase until the archive is compiled
- [x] A Cancel button stops the run between Pictures and discards the partial archive
- [x] Exported files in the ZIP archive retain their exact original filenames (e.g. `IMG_0412.jpg`); a duplicate name gets a ` (2)` suffix before the extension and is named in the completion notice
- [x] User can select between high-quality JPEG (default) and lossless PNG export; the choice belongs to one Batch Export and is not persisted
- [x] A failed Picture does not stop the run: the remaining Pictures render, the archive still downloads when at least one Picture succeeded, and one message names every failed Picture
- [x] The archive is compiled with JSZip behind a small `addFile` / `finish` interface, loaded lazily so it stays out of the main bundle
- [x] Automatic download trigger once ZIP compilation finishes
- [x] Batch Export is disabled while the Adjustment Modal is open, while the Batch is still ingesting, and while an export is in flight; Picture adjustments are blocked for the duration of a run
- [x] The export path targets evergreen browsers (Chrome/Edge 105+, Firefox 105+, Safari 16.4+); the main-thread renderer exists for capability detection and tests, not legacy support

## Comments

- 2026-10-20: Planning decisions settled before implementation. JSZip stays per ADR-0001, but only behind an `addFile` / `finish` interface so it can be swapped for a streaming writer later. Memory ceiling to watch: JSZip builds the whole archive in memory, and output size is bounded by the Frame's pixel dimensions, so a large Batch can still exhaust the tab during packaging even though rendering is sequential. If real Batches reach hundreds of Pictures, switch the archive implementation to a streaming writer and amend ADR-0001. Duplicate filenames get a ` (2)` suffix rather than folder paths inside the archive. Chrome/Edge 105+, Firefox 105+, Safari 16.4+ are the supported floor for `OffscreenCanvas`.

- 2026-10-20: Implemented in 80bbe3a. The naming dialog sanitizes and pre-fills the dated archive name, restores focus to the Export button, and carries the per-run JPEG/PNG choice. Rendering runs sequentially through a classic `OffscreenCanvas` Worker (Firefox 105-compatible, not a module Worker) so the existing `renderFramedPicture` seam drives both Batch Export and single-Picture downloads; the main-thread renderer takes over when the capability is missing or the Worker dies. Progress reports count, percentage, and filename, then an indeterminate Packaging phase. Cancel stops between Pictures and no archive is finished. Duplicate filenames get a ` (2)` suffix and are named in the completion notice, which also names every failed Picture (including ingest failures). JSZip sits behind `addFile` / `finish` and stays in a 97 kB lazy chunk. Full suite 181 tests green; typecheck and production build clean.

- 2026-10-20: Follow-up review fixes in 2559d80. The progress bar total now matches the completion notice by counting Pictures that failed at ingest; `isReadyPicture` in batchState names the ready-with-file predicate; and the shared `useModalDialog` hook carries the Escape, Tab-trap, and focus-restoration behavior for the Adjustment Modal and the Batch Export naming dialog. Full suite 185 tests green; typecheck and production build clean.
