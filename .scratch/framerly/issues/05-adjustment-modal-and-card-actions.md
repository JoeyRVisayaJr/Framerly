# 05: Adjustment Modal and Card Actions

**What to build:** Interactive manual adjustment modal and per-picture grid actions. Users can click any picture card in the Visual Grid to open a modal where they can drag-to-pan, zoom with a slider, rotate by 90-degree steps, or reset to auto-centered. Each card also provides a quick remove button and an instant single-picture download button.

**Blocked by:** 04: Auto-Centering and Crop Modes

**Status:** done

- [x] Clicking the preview image on any card opens the Adjustment Modal with live interactive preview; the card's Remove and Download buttons never open the modal
- [x] Direct click-and-drag panning within the frame aperture, supported by mouse and touch via pointer events, with the pan clamped so the Picture always covers the Aperture in `Crop to Fill` and left free in `Fit with Blurred Background` (blur fills any gaps)
- [x] Smooth zoom slider ranging from 1.0x to 3.0x in 0.01 steps, defaulting to 1.0x (the auto-centered fit from 04), keyboard accessible and clamped at both ends
- [x] Single 90-degree rotation button cycling clockwise through 0, 90, 180, 270 degrees, applied around the aperture center and preserving the current pan and zoom re-clamped to the new bounds
- [x] Reset button restores pan to 0, zoom to 1.0x, and rotation to 0, re-running the 04 Auto-Centering offset; it does not change the global Crop Mode or remove the Picture
- [x] Adjustment Modal applies changes live with no Save or Cancel step, closes on Escape, the close button, or a click on the backdrop, traps focus while open, and restores focus to the originating card on close
- [x] Adjustment Modal renders the lightweight ~800px thumbnail tier for smooth dragging, reserving full-resolution rendering for download
- [x] Individual picture cards feature a quick Remove button that requires a lightweight inline two-step confirmation (no native browser `confirm()`), and removes the Picture from the Batch and the total count on confirm
- [x] Individual picture cards and the Adjustment Modal feature a "Download Picture" button that renders a full-resolution Framed Picture at the Frame's exact pixel dimensions with the current pan, zoom, rotation, and Crop Mode applied, encoded as high-quality JPEG by default, and saved under the Picture's exact original filename
- [x] The single-picture download uses the same rendering seam the 06 Batch Export pipeline uses, and a failed download surfaces an error naming the Picture while keeping the Adjustment Modal open so no work is lost
- [x] Adjustment state (pan, zoom, rotation) is held in memory only and resets on page reload, matching the ephemeral lifetime of raw Pictures

## Notes

- Crop Mode stays a global toggle from 04; 05 introduces no per-Picture Crop Mode override.
- Adjustment state lives in the per-Picture transform described by the spec's Adjustment State Model and must not mutate the original raw image file.

## Comments

- 2026-10-17: Implemented and committed as 2d5e572 (116 tests green, typecheck and build clean). Added `Adjustment`/`AdjustmentInput`/`Rotation` and `calculateAdjustedPlacement` in `src/lib/framing.ts`, the `batchState.ts` reducer plus `useBatch` wiring, `AdjustmentModal.tsx`, card actions in `VisualGrid.tsx`, and `pictureExport.ts` for full-resolution single downloads. Review findings applied: fixed a rotation double-apply in `renderFramedPicture` (dimension swap plus context rotate drew into a swapped box), made the modal preview use the Frame aperture and focal-point position, added the focus trap and focus restore, added the "Download Picture" card label, extracted a shared cover-placement helper, removed the now-dead `calculateFramingPlacement`, and typed rotation as a quarter-turn union. `BatchPicture.file` retains the original File in memory so full-resolution export works; the raw Picture stays in memory only, per the Local Persistence decision.
