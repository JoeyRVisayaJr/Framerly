# 04: Auto-Centering and Crop Modes

**What to build:** Intelligent subject positioning and crop mode options. Incorporates client-side face and subject detection to automatically center the aperture on people, with smooth fallback to optical center-fitting. Introduces a global toggle between "Crop to Fill" and "Fit with Blurred Background".

**Blocked by:** 03: Batch Ingestion and Visual Grid

**Status:** ready-for-agent

- [ ] Client-side face and subject detection analyzes each picture to find primary focal subjects
- [ ] Auto-centering shifts the picture offset so detected faces remain centered inside the frame aperture
- [ ] Fallback to optical center-cropping when no faces or prominent subjects are detected
- [ ] Global toggle for "Crop to Fill" (default, no blank borders) vs "Fit with Blurred Background" (preserves entire picture with soft blurred sides)
- [ ] Visual Grid immediately updates preview cards when switching crop modes
