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
