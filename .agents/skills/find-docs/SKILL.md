---
name: find-docs
description: Find the ADRs and specs of Tarja that bear on a task, by topic, by a file of code or by an ADR number, from their front matter, instead of reading docs/ whole. Use before changing a feature, a screen, a rule or a file to learn what was decided and how it behaves; when a comment or a doc cites ADR-NNNN; when asked "which ADR says…", "is there a decision about…", "busca el ADR", "qué ADR habla de…", "dónde está documentado…"; and before writing a new ADR, to find the ones it refines or supersedes.
---

# Find the docs

The decisions are in `docs/adr/`, how things behave in `docs/specs/`, the look in `design-system/DESIGN.md`. Each ADR and spec opens with a front matter (`docs/README.md` has its keys and the list of tags), so the search reads that and never the bodies. Run from the root of the repository:

```bash
node .agents/skills/find-docs/find.mjs                    # every ADR and spec, a short summary each
node .agents/skills/find-docs/find.mjs 16                 # ADR-0016: what it refines and what refines it, its specs (a spec that links to it or one it names)
node .agents/skills/find-docs/find.mjs src/lib/offline    # the specs whose `code` holds that path (a root file too: wrangler.jsonc), the closest first, and their ADRs
node .agents/skills/find-docs/find.mjs swipe toast        # tags, titles and summaries that hold every word
node .agents/skills/find-docs/find.mjs --all theme        # the same, with the superseded and rejected ADRs
```

## How to use what it finds

1. **Start from what you touch.** A file of code: search its path, then the words of what it does. A behaviour: search one or two words of it, in English, the words the docs use (`settle`, `pinned`, `outbox`, `dummy`, `restaurant card`), or a tag (`groups`, `ledger`, `sync`, `design`).
2. **Read the spec first**: it says how things behave now, all decisions included. Read an ADR for the why, or when the task would change what it decided.
3. **Follow the chain.** An ADR can be refined by later ones, which change part of it without replacing it: the `refined by` line of a number search lists them, and the newest wins where they disagree. A `Superseded` ADR is history: read the one that replaced it.
4. **A miss isn't proof.** When the front matter finds nothing, search the bodies (`grep -ril "<word>" docs/ design-system/DESIGN.md`) before saying nothing was decided.
5. **Decisions are the owner's.** Don't edit an accepted ADR to say something else, nor work against one silently: a change of decision is a new ADR (`docs/adr/README.md`), proposed to the owner.

## Keeping the front matter right

When a change adds a spec or an ADR, or changes which ADRs a spec links to or which code it describes, update its front matter in the same commit: `pnpm test --project docs` checks the keys, the tags, that a spec's `adrs` are the ADRs its body links to, and that its `code` exists. A new ADR names what it `refines` or `supersedes`; the older one changes only its `status` and `superseded_by` when it is superseded.
