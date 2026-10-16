# 04: Auto-Centering and Crop Modes

**What to build:** Intelligent subject positioning and crop mode options. Incorporates client-side face and subject detection to automatically center the aperture on people, with smooth fallback to optical center-fitting. Introduces a global toggle between "Crop to Fill" and "Fit with Blurred Background".

**Blocked by:** 03: Batch Ingestion and Visual Grid

**Status:** done

- [x] Client-side face and subject detection analyzes each picture to find primary focal subjects
- [x] Auto-centering shifts the picture offset so detected faces remain centered inside the frame aperture
- [x] Fallback to optical center-cropping when no faces or prominent subjects are detected
- [x] Global toggle for "Crop to Fill" (default, no blank borders) vs "Fit with Blurred Background" (preserves entire picture with soft blurred sides)
- [x] Visual Grid immediately updates preview cards when switching crop modes

## Comments

2026-10-17: Implemented client-side subject and face detection in `src/lib/subjectDetection.ts` with Shape Detection API (`FaceDetector`), collective bounding box union for multi-face groups, and optical center fallback. Added auto-centering offset math and boundary clamping in `src/lib/framing.ts` with support for 'crop-to-fill' and 'fit-blurred' crop modes, plus exact CSS `object-position` mapping for preview cards. Attached detected focal points to decoded batch pictures in `src/lib/pictureDecode.ts` and `src/lib/useBatch.ts`. Built accessible Crop Mode toggle and live-updating preview cards in `src/components/VisualGrid.tsx` and wired into `src/App.tsx`. All 73 tests passing and production build succeeded (commit 8ce0274).
