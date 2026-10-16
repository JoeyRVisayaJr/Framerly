# 02: Frame Upload and Aperture Detection

**What to build:** The interactive upload area for branded PNG frames. Users can drop or select a PNG frame, the application automatically analyzes the Frame to detect the transparent Aperture, shows an instant preview, and saves the frame in browser storage so it survives page reloads.

**Blocked by:** 01: Scaffold Project and Core Framing Engine

**Status:** done

- [x] Drag-and-drop or file picker upload area specifically accepting PNG frames
- [x] Automatic transparency analysis detects the aperture bounding box within the uploaded frame
- [x] Frame preview displays clearly on the screen with detected aperture dimensions indicated
- [x] Frame image and aperture data persist across browser refreshes via local browser storage
- [x] User can replace or clear the current frame with a single click

## Comments

- 2026-10-17: Implemented and committed as fa321c4 (31 tests green, typecheck and build clean). Notes: global transparency bounding box is v1 behavior; disjoint transparency (rounded corners, shadows) merges into one box and is left for manual Aperture Calibration in 07. Opaque Frames persist with null aperture. Oversized Frames that exceed localStorage quota load for the session with a warning instead of failing.
