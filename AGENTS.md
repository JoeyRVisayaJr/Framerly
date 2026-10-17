## Agent skills

### Working and review rules

`CONTRIBUTING.md` holds the implementation workflow: domain language, JSDoc on
exports, test seams, and the verification commands. `CODING_STANDARDS.md` holds
reviewer-enforced rules; read during review, not implementation.

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

Before proposing work or reporting a problem, scan the open tickets under
`.scratch/<feature>/issues/` and leave out anything they already track.

### Triage labels

Canonical five-role triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.

Use the glossary terms in every report, review, or UI string you write; not
the Avoid synonyms each entry lists.
