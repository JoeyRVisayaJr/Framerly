# 06: Background Worker Batch ZIP Export

**What to build:** The complete batch export pipeline. Users click "Export All as ZIP" to render all pictures at full camera resolution in a background Web Worker queue, packing them into a downloadable ZIP archive that preserves the exact original filenames, accompanied by a real-time progress bar.

**Blocked by:** 05: Adjustment Modal and Card Actions

**Status:** ready-for-agent

- [ ] "Export All as ZIP" button triggers background full-resolution rendering pipeline
- [ ] Sequential / chunked rendering in Web Workers prevents browser tab memory crashes
- [ ] Live progress bar displays processed count, percentage, and current filename
- [ ] Exported files in the ZIP archive retain their exact original filenames (e.g., `IMG_0412.jpg`)
- [ ] User can select between high-quality JPEG (default) and lossless PNG export
- [ ] Automatic download trigger once ZIP compilation finishes
