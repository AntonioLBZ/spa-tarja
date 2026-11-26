# Architecture decision records

One decision each, written when it is taken. They say why; how things behave is in [`../specs/`](../specs/) and the visual rules are in [`DESIGN.md`](../../design-system/DESIGN.md).

- **File**: `NNNN-slug.md`, numbered in the order they are written, headed `# ADR-NNNN: Title`. A comment in the code may cite one as `ADR-NNNN`, and nothing else about the docs.
- **Self-contained**: it can be read alone. Link to another ADR instead of copying it.
- **Immutable once accepted**: don't edit an accepted ADR to say something else. A decision that changes is a new ADR that supersedes or refines the old one, and an old one it supersedes gets the status `Superseded` with `superseded_by`. Fixing a typo or a broken link is fine, and so is keeping its front matter right (a tag, the specs that describe it), which says nothing new about the decision.
- **Front matter** ([the keys and the tags](../README.md)): `status` is `Accepted`; `Rejected`, an option the owner turned down, kept so it isn't proposed again; `Superseded`, with `superseded_by`; or `Proposed`. `date` is the day the decision was first written down. `supersedes` and `refines` name the older ADRs it changes; the newer ones that refine an ADR are found by searching for its id, and where they disagree the newest wins. `summary` is the decision in a line.
- **No index**: the front matter is the index. A test checks that every ADR has one, and the `find-docs` skill (`.agents/skills/find-docs`) searches it.

Template:

```markdown
---
status: Proposed
date: YYYY-MM-DD
refines: [ADR-NNNN]
tags: [tag]
specs: [spec.md]
summary: 'What was decided, in a line.'
---

# ADR-NNNN: Title

## Context

What forces the decision.

## Decision

What was decided.

## Consequences

What follows from it, and what it rules out.

## Alternatives considered

What else was on the table, and why not.
```
