# 03: Batch Ingestion and Visual Grid

**What to build:** Batch picture ingestion supporting folder drag-and-drop and multi-file selection. The application reads images (JPG, PNG, WebP, and auto-converting Apple HEIC), generates lightweight ~800px thumbnail previews, and displays them in a responsive Visual Grid composited with the active frame.

**Blocked by:** 02: Frame Upload and Aperture Detection

**Status:** done

- [x] Folder drop zone accepting entire event directories (including subfolders) and multi-file selection
- [x] In-browser conversion for Apple `.heic` and `.heif` images without external server calls
- [x] Two-tier rendering generates lightweight ~800px downscaled thumbnail previews to prevent browser out-of-memory crashes
- [x] Visual Grid displays responsive cards showing framed picture previews
- [x] Total picture count and batch status summary display prominently

## Comments

- 2026-10-17: Implemented and committed as fe07eea (51 tests green, typecheck and build clean). Notes: heic2any loads as a lazy chunk so the main bundle stays lean; multi-image HEICs decode the first image only (v1); full-resolution rendering is left to 06 Batch Export; grid virtualization is future work if large Batches grow heavy. Review findings applied: aperture-box compositing, merged entry+file drops, dropzone forwards all files so unsupported-only drops surface the hook error.
- 2026-10-17: Review follow-up fixing the dedup key (distinct subdirectory Pictures no longer merged) and the stale `BatchDropzone` contract comment.
