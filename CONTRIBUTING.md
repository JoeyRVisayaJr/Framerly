# Contributing to Framerly

## Domain language

Use the terms in `GLOSSARY.md` in code, tests, and UI strings: Frame, Picture,
Batch, Framed Picture, Aperture, Aperture Calibration, Auto-Centering, Subject
Detection, Crop Mode, Adjustment Modal, Visual Grid, Batch Export.

Do not use the synonyms each entry lists as Avoid (e.g. template, cutout,
mask, photo, gallery). Platform terms (`canvas` element, `Image` object) are
fine when they refer to the platform, not to the domain concept.

## Public API docs

Every exported function and component gets a JSDoc comment stating its
contract: what it does, what each parameter means, and what it returns.
Match the style in `src/lib/framing.ts`. Unexported helpers are exempt.

## Tests at seams

Test behavior through public interfaces, never internals. The agreed seams,
what each catches, and the Testing Library convention are defined once in
Testing Decisions in `.scratch/framerly/spec.md`. Follow that section; this
file does not restate it.

## Workflow

- `npx tsc --noEmit` after each change.
- Run the single affected test file during work: `npx vitest run <file>`.
- Before finishing: full `npm test` plus `npm run build`, both green.

## Issues and specs

Issues and the spec live as local markdown under `.scratch/`
(see `docs/agents/issue-tracker.md`). When a ticket is done, check off its
acceptance boxes, set its `Status:` to `done`, and append a dated `## Comments`
entry with the outcome and commit SHA.
