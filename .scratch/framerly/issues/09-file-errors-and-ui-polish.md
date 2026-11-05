# 09: File Error Messages and UI Polish

**What to build:** Clear, named error messages when a Frame or Picture cannot be read, and the final empty states, drop feedback, and help text that make the workflow explain itself. This is the part of the original polish ticket that does not depend on the Batch Export.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Informative error messages and alerts for unsupported or corrupted image files, naming the file that failed
- [x] Polished empty states for the Frame area, the Batch Dropzone, and the Visual Grid before anything is uploaded
- [x] Drag-and-drop hover animations that show whether a drop is accepted or rejected
- [x] Intuitive help tooltips for Aperture, Auto-Centering, Crop Mode, and Batch Export

## Comments

- 2026-10-20: Split out of 07 so the work that does not need the Batch Export can start now. 07 keeps Aperture Calibration and the end-to-end verification.
- 2026-11-06: Completed by OpenCode agent (Wave 1). Implemented named error messages on decode/read failures across Frame and Batch ingestion, empty states across FrameUploader, BatchDropzone, and VisualGrid, drag hover acceptance/rejection states, and contextual help tooltips. Verified all 224 unit/integration tests pass green.
