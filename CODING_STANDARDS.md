# Coding Standards

Reviewer-enforced rules for this repo. The reviewer agent applies these to
every diff; the implementer does not need them in context. Each rule below is
a judgement call no automated check can substitute for. Mechanical patterns
(banned characters, types, imports) belong in CI or a linter instead.

## Merge by location identity

When merging files that arrive from more than one directory (drops, folder
picks, multi-source ingestion), key identity on **location**, never on bare
file attributes. Two Pictures in different subdirectories may share a name,
size, and timestamp while being distinct files.

Concretely: dedupe only what is provably the same physical file (object
identity, or a basename + size + time match against an already-traversed
entry). Distinct sources stay distinct, even when every attribute matches.

Tests for merge logic must include a same-name-different-location case.
