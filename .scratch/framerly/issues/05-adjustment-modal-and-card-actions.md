# 05: Adjustment Modal and Card Actions

**What to build:** Interactive manual adjustment modal and per-picture grid actions. Users can click any picture card in the Visual Grid to open a modal where they can drag-to-pan, zoom with a slider, rotate by 90-degree steps, or reset to auto-centered. Each card also provides a quick remove button and an instant single-picture download button.

**Blocked by:** 04: Auto-Centering and Crop Modes

**Status:** ready-for-agent

- [ ] Clicking the preview image on any card opens the Adjustment Modal with live interactive preview; the card's Remove and Download buttons stop event propagation and never open the modal
- [ ] Direct click-and-drag panning within the frame aperture, supported by mouse and touch via pointer events, with the pan clamped so the Picture always covers the Aperture in `Crop to Fill` and left free in `Fit with Blurred Background` (blur fills any gaps)
- [ ] Smooth zoom slider ranging from 1.0x to 3.0x in 0.01 steps, defaulting to 1.0x (the auto-centered fit from 04), keyboard accessible and clamped at both ends
- [ ] Single 90-degree rotation button cycling clockwise through 0, 90, 180, 270 degrees, applied around the aperture center and preserving the current pan and zoom re-clamped to the new bounds
- [ ] Reset button restores pan to 0, zoom to 1.0x, and rotation to 0, re-running the 04 Auto-Centering offset; it does not change the global Crop Mode or remove the Picture
- [ ] Adjustment Modal applies changes live with no Save or Cancel step, closes on Escape, the close button, or a click on the backdrop, traps focus while open, and restores focus to the originating card on close
- [ ] Adjustment Modal renders the lightweight ~800px thumbnail tier for smooth dragging, reserving full-resolution rendering for download
- [ ] Individual picture cards feature a quick Remove button that requires a lightweight inline two-step confirmation (no native browser `confirm()`), and removes the Picture from the Batch and the total count on confirm
- [ ] Individual picture cards and the Adjustment Modal feature a "Download Picture" button that renders a full-resolution Framed Picture at the Frame's exact pixel dimensions with the current pan, zoom, rotation, and Crop Mode applied, encoded as high-quality JPEG by default, and saved under the Picture's exact original filename
- [ ] The single-picture download uses the same rendering seam the 06 Batch Export pipeline uses, and a failed download surfaces an error naming the Picture while keeping the Adjustment Modal open so no work is lost
- [ ] Adjustment state (pan, zoom, rotation) is held in memory only and resets on page reload, matching the ephemeral lifetime of raw Pictures

## Notes

- Crop Mode stays a global toggle from 04; 05 introduces no per-Picture Crop Mode override.
- Adjustment state lives in the per-Picture transform described by the spec's Adjustment State Model and must not mutate the original raw image file.

## Comments