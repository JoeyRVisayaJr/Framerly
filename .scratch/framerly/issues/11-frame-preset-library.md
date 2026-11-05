# 11: Frame Preset Library

**What to build:** A persistent in-browser Frame Preset Library backed by IndexedDB that allows event organizers to store, name, and switch between multiple Frames (such as 1:1, 9:16, or 16:9 variants) with their verified or calibrated Apertures. Switching the active Frame immediately re-renders all Framed Pictures in the Visual Grid without requiring re-ingestion of the Batch.

**Blocked by:** None

**Status:** done

## Library storage & persistence

- [x] Lightweight IndexedDB storage engine (`indexedDbFrameStore.ts`) storing high-resolution PNG Frame blobs with fallback to ephemeral in-memory storage
- [x] Each Frame Preset entry stores unique id, display name, dimensions, Aperture, calibrated flag, and creation timestamp
- [x] Storing large multi-megabyte PNG Frames succeeds without triggering browser storage quota warnings
- [x] Deleting a Frame Preset removes its record and blob from IndexedDB

## User interface & interaction

- [x] Preset picker in the Frame area displaying all saved Frame Presets alongside an "Add Frame" action
- [x] Saving a newly uploaded Frame allows providing an optional descriptive name (e.g., "Gala 2026 - Story 9:16")
- [x] Switching active Frame Preset immediately updates the active Frame and Aperture across the application
- [x] Visual Grid reactively re-renders all framed picture preview cards to the new Frame dimensions and Aperture bounds without clearing the current Batch
- [x] Option to rename or delete existing Frame Presets with confirmation

## Seam testing & verification

- [x] Unit tests for the IndexedDB storage adapter (CRUD operations and error handling)
- [x] Component tests for the Frame Preset selector and naming workflow
- [x] Visual Grid reactivity tests proving card dimensions and framing adjust when active Frame changes

## Comments

- 2026-11-06: Created based on Gemini architecture exploration and user request. Addresses the single-frame constraint and storage quota warnings on high-resolution print-ready Frames.
- 2026-11-06: Completed by Antigravity worker (Wave 2). Implemented persistent IndexedDB Frame Preset engine with in-memory fallback, Frame Preset Picker UI with naming modal, rename/delete actions, and reactive Visual Grid re-rendering without Batch re-ingestion. Verified all 245 test suites pass green.
