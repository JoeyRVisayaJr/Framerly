# 12: EXIF Metadata Preservation

**What to build:** Preserve original camera metadata and capture timestamps (specifically `DateTimeOriginal`, camera make, model, and exposure parameters) across the client-side rendering pipeline so that exported JPEG Framed Pictures in the Batch Export ZIP archive maintain their chronological ordering in photo management tools.

**Blocked by:** None

**Status:** ready-for-agent

## Ingestion & extraction

- [ ] Zero-dependency client-side EXIF APP1 parser (`src/lib/exif.ts`) extracting metadata segments from JPEG Picture files during batch ingestion
- [ ] Preserved metadata attached ephemerally to the in-memory `BatchPicture` state model without increasing thumbnail footprint
- [ ] Non-JPEG files (PNG, WebP, HEIC) handle metadata gracefully without error

## Export & re-injection

- [ ] Web Worker Batch Export (`batchExport.worker.ts`) receives the preserved EXIF payload alongside rendering commands
- [ ] After rendering full-resolution Framed Pictures to JPEG blobs, the preserved EXIF APP1 segment is re-injected before the blob is streamed to JSZip
- [ ] Single Picture download similarly preserves and re-injects EXIF data
- [ ] Batch Export dialog provides a toggle to enable or disable EXIF preservation (default: enabled)

## Seam testing & verification

- [ ] Unit tests for EXIF segment extraction from sample JPEG buffers
- [ ] Unit tests for EXIF re-injection into freshly generated canvas JPEG blobs
- [ ] End-to-end / worker test asserting exported JPEG files contain original capture timestamps

## Comments

- 2026-11-06: Created based on Gemini architecture exploration and user request. Solves the issue where HTML5 Canvas encoding strips all EXIF metadata and breaks event timelines upon export.
