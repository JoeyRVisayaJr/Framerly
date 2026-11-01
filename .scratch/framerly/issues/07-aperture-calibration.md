# 07: Aperture Calibration

**What to build:** An interactive manual Aperture Calibration tool so opaque or imperfectly-detected Frames are fully usable. The user drags an adjustable bounding rectangle over the Frame preview, and that calibrated Aperture overrides detection everywhere Framerly renders a Framed Picture.

**Blocked by:** 06: Background Worker Batch ZIP Export

**Status:** done

## Entry points

- [x] When Automatic Aperture Detection returns nothing (opaque Frame), the Frame area shows a prominent "Calibrate Aperture" call to action beside the existing "No transparent Aperture found" message
- [x] When detection succeeds, the Frame preview offers an "Adjust Aperture" control so the detected Aperture can be nudged

## Calibration interaction

- [x] Calibration overlay drawn over the Frame preview, seeded with the detected Aperture rectangle, or with a centered default rectangle when detection found nothing
- [x] Four draggable edge/corner handles resize the rectangle; dragging inside it moves it
- [x] Rectangle coordinates snap to whole Frame pixels
- [x] A reset control restores the auto-detected Aperture (or the centered default) without leaving calibration
- [x] Confirm and cancel controls; cancel discards any in-progress edits

## State and persistence

- [x] A calibrated Aperture overrides the detected Aperture for every downstream render (Visual Grid, Adjustment Modal, Batch Export) with no changes needed in those consumers
- [x] The calibrated Aperture persists with the Frame in browser storage and is restored on reload
- [x] Uploading a new Frame clears the previous calibration so fresh detection runs

## Validation

- [x] Degenerate rectangles (thinner than the minimum in either axis, or outside the Frame bounds) are rejected with an inline alert, reusing the rules in `detectAperture`
- [x] An opaque Frame with a calibrated Aperture renders correct Framed Pictures in the Visual Grid

## Verification

- [x] Unit tests at the calibration geometry and Frame storage seams
- [x] Component tests for the calibration overlay entry points and handle interaction
- [x] End-to-end verification of the full event photo framing workflow: opaque Frame upload, calibration, batch ingestion, adjustment, Batch Export

**Out of scope:** file error messages, empty states, drag-and-drop hover animations, and help tooltips. Those belong to 09.

## Comments

- 2026-10-20: Split out of 07 so the work that does not need the Batch Export could start now. 07 keeps Aperture Calibration and the end-to-end verification.
- 2026-10-20: Elaborated before implementation. Dropped the duplicated error-message, empty-state, and tooltip bullets (they stay in 09) and committed to: a Calibrate button on detection failure plus an optional Adjust control; handle-based editing seeded from the detected rectangle; override semantics persisted in local storage and cleared on new Frame upload; validation via the existing `detectAperture` rules.
- 2026-11-01: Implemented and committed as 6a8f918. Added Aperture Calibration (`ApertureCalibrator`, `calibration.ts`), Frame store persistence, opaque Frame canvas clipping and Visual Grid CSS clipping, unit/component tests, and Playwright e2e test. All checks passing.
