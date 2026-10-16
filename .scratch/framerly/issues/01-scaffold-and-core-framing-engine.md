# 01: Scaffold Project and Core Framing Engine

**What to build:** The foundational web application setup and the core headless framing engine. This enables rendering a picture inside a frame on an off-screen canvas, validating dimension scaling, aspect ratio fitting, and overlay positioning through automated tests.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Vite, React, TypeScript, and Tailwind CSS application scaffolded with Vitest test environment configured
- [x] Headless framing engine accepts a frame image and picture source and composites them into an image canvas
- [x] Output canvas matches the exact pixel dimensions of the frame
- [x] Picture is placed beneath the frame layer with correct aspect-fill scaling
- [x] Automated tests verify that framing math, dimension preservation, and layering pass reliably

## Comments

- 2026-10-17: Implemented and committed as c557d2e (11 tests green, typecheck and build clean).
