# Framerly Specification

**Status:** ready-for-agent

## Problem Statement

After an event concludes, event organizers, photographers, and social media managers are left with hundreds of individual pictures in a single folder. For social media postings, recap galleries, and attendee souvenirs, every picture must be placed inside a consistent, branded event frame. In existing tools like Canva or Photoshop, users cannot simply drop an entire folder and apply a single frame in bulk; they are forced to manually place, resize, and align each picture one by one. This repetitive manual process takes hours, introduces visual inconsistencies, and delays post-event media publishing.

## Solution

Framerly is a fast, web-based tool that eliminates manual 1-by-1 framing. An organizer uploads their branded Frame once, drops their entire folder of Pictures, and Framerly automatically fits, centers, and frames every single picture across the Batch in seconds. 

Users can inspect all framed pictures at a glance in a responsive Visual Grid, make instant manual adjustments (pan, zoom, rotate) to any specific picture via an Adjustment Modal, and export the entire collection in one click as a ZIP file with their exact original filenames preserved. All rendering, subject detection, and file packaging run 100% client-side in the browser, providing instant local processing with zero server bandwidth costs and total privacy.

## User Stories

1. As an event organizer, I want to upload a branded PNG Frame with a transparent cutout, so that my event branding is applied over every picture.
2. As an event organizer, I want to drag and drop an entire folder containing hundreds of event pictures at once, so that I don't have to select files individually.
3. As an event organizer, I want to select multiple image files from a file picker, so that I have flexibility if my pictures are not in a single folder.
4. As an event organizer, I want Framerly to automatically detect the transparent Aperture in my Frame, so that I don't have to manually configure cropping boundaries.
5. As an event organizer, I want an optional Aperture Calibration tool, so that I can define custom picture boundaries if my Frame graphic is opaque or requires specific margins.
6. As an attendee photographer, I want Framerly to automatically center pictures around human faces and focal subjects, so that attendees' heads and faces are not awkwardly cut off by the frame.
7. As an event organizer, I want Framerly to fall back to optical center-cropping when no faces are detected, so that landscape or object photos are evenly framed.
8. As a social media manager, I want pictures with different aspect ratios to default to "Crop to Fill", so that no framed picture has ugly blank margins or black borders.
9. As a social media manager, I want an optional "Fit with Blurred Background" toggle, so that I can preserve the full original composition of wide or tall shots without cropping edges.
10. As an event organizer, I want to view all processed pictures in a responsive Visual Grid, so that I can quickly review hundreds of framed photos in seconds.
11. As an event organizer, I want the Visual Grid to load lightweight thumbnail previews immediately, so that the web page stays responsive and does not freeze or crash under heavy batches.
12. As an event organizer, I want to click any picture in the Visual Grid to open an Adjustment Modal, so that I can fine-tune its framing.
13. As an event organizer, I want to click and drag inside the Adjustment Modal to pan the picture, so that I can adjust its position within the aperture.
14. As an event organizer, I want a zoom slider in the Adjustment Modal, so that I can scale the picture up or down to frame the subject perfectly.
15. As an event organizer, I want a 90-degree rotation button in the Adjustment Modal, so that I can fix pictures that were taken sideways or upside-down.
16. As an event organizer, I want a reset button in the Adjustment Modal, so that I can instantly restore the picture to its original auto-centered state.
17. As an event organizer, I want a quick remove button on each picture card, so that I can discard blurry or unwanted photos before downloading the batch.
18. As an event organizer, I want a single-picture download button on each card and inside the modal, so that I can grab an urgent photo immediately without waiting for the full batch export.
19. As an event organizer, I want to export the entire batch as a single ZIP archive with one click, so that all framed pictures are downloaded efficiently to my computer.
20. As an event organizer, I want exported pictures in the ZIP to retain their exact original filenames (e.g., `IMG_0412.jpg`), so that my existing file organization and photo references remain intact.
21. As an event organizer, I want to see a real-time progress bar during ZIP export, so that I know exactly how many pictures have been processed and when the download will complete.
22. As an iPhone user, I want Framerly to automatically convert `.heic` and `.heif` photos in the browser, so that pictures dropped straight from Apple devices work seamlessly without manual conversion.
23. As an event organizer, I want the exported pictures to match the high-resolution dimensions of my Frame template, so that the output files are ready for print and high-definition social media posting.
24. As an event organizer, I want to choose between high-quality JPEG (default for smaller file sizes) and lossless PNG export, so that I can balance download size and quality.
25. As an event organizer, I want my uploaded Frame template and aperture calibration to persist when I refresh the page, so that I can process multiple batches without re-uploading the frame.
26. As an event organizer, I want all processing to happen locally on my computer without uploading images to any third-party server, so that attendee photos remain private and secure.

## Implementation Decisions

- **Client-Side SPA Architecture**: see [ADR-0001](file:///home/vsy_joey/Framerly/docs/adr/0001-client-side-batch-processing.md).
- **Two-Tier Rendering Pipeline**: see [ADR-0002](file:///home/vsy_joey/Framerly/docs/adr/0002-two-tier-rendering-pipeline.md).
- **Frame & Aperture Layering**: Framed Pictures are composited by rendering the Picture on the bottom layer and the Frame graphic on the top layer. For transparent PNG frames, the transparent cutout serves as the aperture. For non-standard or opaque frames, an Aperture Calibration bounding rectangle defines the clip and placement bounds.
- **Auto-Centering Engine**: Combines client-side face/subject detection (lightweight browser model) with geometric optical center fallback. The bounding box of detected faces determines the optimal translation offset to keep subjects centered in the aperture.
- **Crop Modes**: Supports two fitting strategies:
  1. *Crop to Fill (Default)*: Picture is scaled so that both width and height fully cover the aperture, with excess clipped.
  2. *Fit with Blurred Background*: Picture is scaled so its entire content fits within the aperture, and a blurred, scaled version of the same picture fills the remaining empty space.
- **Adjustment State Model**: Each Picture in a Batch maintains its own transform state (pan X offset, pan Y offset, zoom level, rotation degrees, crop mode override). Changes made in the Adjustment Modal update this state without mutating the original raw image file.
- **In-Browser HEIC Conversion**: Integrates client-side HEIC decoding (`heic2any`) to transparently convert Apple iPhone HEIC pictures to standard image bitmaps before rendering.
- **Local Persistence**: Stores Frame metadata, data URLs, and Aperture Calibration settings in browser storage (IndexedDB / localStorage). Raw batch pictures remain ephemeral in memory to avoid storage quota exhaustion.
- **Batch Export Engine**: Utilizes Web Workers to sequentially composite full-resolution canvases, convert them into compressed blobs (JPEG/PNG), and stream them into `JSZip` for one-click downloading, preserving exact original file names.

## Testing Decisions

- **Seam 1: Core Framing & Geometry Engine**: The primary domain seam sits at the headless framing composition engine. This engine takes a Frame descriptor, a Picture source, aperture coordinates, crop mode, and transform parameters, and outputs calculated coordinate transforms and canvas renders.
  - *Good test criteria*: Tests external rendering math and positioning (verifying correct scaling factors, boundary clipping, center coordinate alignment for portrait vs landscape photos, rotation transforms) without testing internal UI state.
- **Seam 2: Batch State & Workflow Controller**: The state machine controlling batch ingestion, thumbnail generation, picture removal, and adjustment state updates.
  - *Good test criteria*: Verifies that adding files, removing pictures, updating individual adjustment offsets, and resetting to auto-center updates the batch collection accurately and handles invalid/corrupted files gracefully.
- **Seam 3: Top-Level UI Integration**: React Testing Library / Vitest tests verifying key user flows (uploading frame, dropping folder, opening adjustment modal, triggering export).
  - *Good test criteria*: Tests user-visible reactions and events, avoiding assertions on private component states.

## Out of Scope

- Cloud-based backend processing, server-side queue workers, or remote cloud storage.
- User accounts, login/password systems, or multi-tenant team management.
- Multi-frame batches (assigning different frame templates to different pictures in a single export run).
- Vector graphic manipulation or in-app design creation (adding stickers, text boxes, or drawing tools inside Framerly).
- Video or animated GIF frame rendering.

## Further Notes

- Domain vocabulary is formally documented in [GLOSSARY.md](file:///home/vsy_joey/Framerly/GLOSSARY.md).
- Architectural rationale for client-side processing is documented in [docs/adr/0001-client-side-batch-processing.md](file:///home/vsy_joey/Framerly/docs/adr/0001-client-side-batch-processing.md).
- Rationale for the two-tier rendering pipeline is documented in [docs/adr/0002-two-tier-rendering-pipeline.md](file:///home/vsy_joey/Framerly/docs/adr/0002-two-tier-rendering-pipeline.md).
