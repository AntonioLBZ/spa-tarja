# Architecture decision records

One decision each, written when it is taken. They say why; how things behave is in [`../specs/`](../specs/) and the visual rules are in [`DESIGN.md`](../../design-system/DESIGN.md).

- **File**: `NNNN-slug.md`, numbered in the order they are written. A comment in the code may cite one as `ADR-NNNN`, and nothing else about the docs.
- **Self-contained**: it can be read alone. Link to another ADR instead of copying it.
- **Immutable once accepted**: don't edit an accepted ADR to say something else. A decision that changes is a new ADR that supersedes the old one, and the old one gets the status `Superseded by ADR-NNNN`. Fixing a typo or a broken link is fine.
- **Status**: `Accepted`; `Rejected`, an option the owner turned down, kept so it isn't proposed again; `Superseded by ADR-NNNN`; or `Proposed`.
- **Date**: the day the decision was first written down.
- **Index**: every ADR is listed in `AGENTS.md`, and a test fails when one isn't.

Template:

```markdown
# ADR-NNNN: Title

- Status: Accepted
- Date: YYYY-MM-DD

## Context

What forces the decision.

## Decision

What was decided.

## Consequences

What follows from it, and what it rules out.

## Alternatives considered

What else was on the table, and why not.
```
