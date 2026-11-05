# 11: Frame Preset Library

**What to build:** A persistent in-browser Frame Preset Library backed by IndexedDB that allows event organizers to store, name, and switch between multiple Frames (such as 1:1, 9:16, or 16:9 variants) with their verified or calibrated Apertures. Switching the active Frame immediately re-renders all Framed Pictures in the Visual Grid without requiring re-ingestion of the Batch.

**Blocked by:** None

**Status:** ready-for-agent

## Library storage & persistence

- [ ] Lightweight IndexedDB storage engine (`indexedDbFrameStore.ts`) storing high-resolution PNG Frame blobs with fallback to ephemeral in-memory storage
- [ ] Each Frame Preset entry stores unique id, display name, dimensions, Aperture, calibrated flag, and creation timestamp
- [ ] Storing large multi-megabyte PNG Frames succeeds without triggering browser storage quota warnings
- [ ] Deleting a Frame Preset removes its record and blob from IndexedDB

## User interface & interaction

- [ ] Preset picker in the Frame area displaying all saved Frame Presets alongside an "Add Frame" action
- [ ] Saving a newly uploaded Frame allows providing an optional descriptive name (e.g., "Gala 2026 - Story 9:16")
- [ ] Switching active Frame Preset immediately updates the active Frame and Aperture across the application
- [ ] Visual Grid reactively re-renders all framed picture preview cards to the new Frame dimensions and Aperture bounds without clearing the current Batch
- [ ] Option to rename or delete existing Frame Presets with confirmation

## Seam testing & verification

- [ ] Unit tests for the IndexedDB storage adapter (CRUD operations and error handling)
- [ ] Component tests for the Frame Preset selector and naming workflow
- [ ] Visual Grid reactivity tests proving card dimensions and framing adjust when active Frame changes

## Comments

- 2026-11-06: Created based on Gemini architecture exploration and user request. Addresses the single-frame constraint and storage quota warnings on high-resolution print-ready Frames.
