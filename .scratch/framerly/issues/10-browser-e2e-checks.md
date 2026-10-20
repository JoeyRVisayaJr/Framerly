# 10: Real-Browser e2e Checks (Playwright)

**What to build:** A small Playwright suite in `e2e/` covering the browser-only parts of the workflow that jsdom stubs away: real PNG decode, Framed Picture pixel output, the Batch Export Web Worker, and the ZIP download. No committed binary fixtures; test Pictures are drawn in the page canvas.

**Blocked by:** None (01-03, 05, 06, 08 are done, which is exactly the build the suite checks)

**Status:** done

- [x] Playwright tooling installed: `@playwright/test`, bundled Chromium, `playwright.config.ts`, `npm run test:e2e`
- [x] Vitest no longer collects `e2e/*.spec.ts` (`test.exclude` in `vite.config.ts`)
- [x] Single-Picture download renders a full-resolution Framed Picture: JPEG bytes, Frame pixel dimensions, Picture colour inside the Aperture, Frame colour outside, saved under the Picture's original filename
- [x] Batch Export proves the Worker path (`page.on('worker')`) instead of trusting the ZIP, because `createDefaultPictureRenderer` falls back to the main thread silently
- [x] Batch Export ZIP keeps the Picture's exact original filename and renames the duplicate to ` (2)`; the single download and the ZIP entry decode to equal pixels, proving the shared rendering seam
- [x] Pixel assertions verified to fail on a wrong render (tampered expectation ran once and failed as expected)
- [x] Repo guards (`scripts/check-guards.sh`) scan `e2e/` and `playwright.config.ts`
- [x] CI gains an `e2e` job that builds the production bundle and serves it via `vite preview`
- [x] Seam 4 recorded in `.scratch/framerly/spec.md` Testing Decisions; `CONTRIBUTING.md` workflow updated

## Out of scope (leave for later tickets)

- Crop Mode switch/Adjustment Modal pixel checks, Frame reload persistence, modal focus checks (P2/P3 set)
- HEIC fixture, directory-drop (`webkitdirectory`) flow, Firefox/WebKit projects, Subject Detection capability question (no browser ships `FaceDetector`; separate product decision)

## Comments

- 2026-10-20: Visual Grid compositing is CSS (`object-fit` + the Frame PNG card layer), so the Framed Picture pixel assertions run the real render path end to end. Tests pass on the first full run against the current build; a deliberately tampered expectation was run once to prove the assertions bite.

- 2026-10-20: Implemented in ac5befb, then expanded across two more commits (e2e suite, guards and CI). Full verification green: `npx tsc --noEmit`, `npm test` (185 tests), `npm run build`, `npm run test:e2e` (2 Playwright tests, Chromium). The full-resolution Framed Picture and the Batch Export both render correctly and the Worker path runs in the bundled Chromium 156.
