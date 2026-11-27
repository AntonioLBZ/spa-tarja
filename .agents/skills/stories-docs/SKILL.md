---
name: stories-docs
description: Write, change or review the Storybook documentation of Tarja (design-system/stories/). A shared component of src/components has a folder in design-system/stories/components/<name>/ (playground.stories.tsx, meta-docs.stories.tsx, overview.mdx); a piece of src/features has one in design-system/stories/features/<name>/ (meta-docs.stories.tsx, overview.mdx, no playground); a foundation (Colors, Typography, Iconography, Spacing, Motion) has one in design-system/stories/foundations/<name>/ (meta-docs.stories.tsx, overview.mdx, its CSS). Use when one of them or a token is added, changed or needs its Overview, Playground or examples written or reviewed; also when the owner says "documenta el componente", "documenta la feature", "las foundations", "la doc de Storybook", "las stories", "el overview" or "el playground".
---

# Docs in Storybook

What is being documented decides the folder and its files. Read the page for it, then come back here for the overview and the checks:

| What                                     | Folder                                      | Read                                                   |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| A shared component (`src/components`)    | `design-system/stories/components/<name>/`  | [references/components.md](references/components.md)   |
| A piece of a feature (`src/features`)    | `design-system/stories/features/<name>/`    | [references/features.md](references/features.md)       |
| A foundation (colors, type, icons, …)    | `design-system/stories/foundations/<name>/` | [references/foundations.md](references/foundations.md) |

`<name>` is the kebab-case name of the component, piece or foundation. Stories are built from the helpers of `design-system/stories/shared/` (`@stories/shared/*`), with `export default Story` last.

## The overview of a component or a piece

A foundation has an overview of its own shape, in its reference; the first rule here and the one on what an `.mdx` imports hold for it too.

- English, short, structured, simple. Sentences in the style of the project docs: say what it is and what it does.
- Order: title and description, **Usage** (its Canvas with the code shown), a section per special case, **Props** last.
- The Usage Canvas has `sourceState="shown"`; the others keep the code folded. Never a hand-written code block that repeats what a Canvas shows.
- A special case earns a section only when it changes what is seen and the app really uses it. Leave out what belongs to another component, props that change nothing on screen (callbacks, `className`, refs, `aria-*`), and `children` unless what it takes is the point.
- An `.mdx` imports only its neighbour files: the `@/` alias doesn't resolve there (the tsconfig paths cover only `.ts`/`.tsx`), so the Props table comes from `<ArgTypes of={Examples} />`.
- The Props table fills its Description column from `/** … */` comments on the props; `//` comments leave it empty.
- The examples are one function story each, named after the case, the least markup that shows it, with the copy the app really uses. No comments, and no wrapper that only exists for the demo.

## Checks

From the repo root, with `<folder>` the one from the table:

```bash
npx tsc -p design-system --noEmit
npx eslint design-system/stories/<folder>/<name>
npx prettier --write design-system/stories/<folder>/<name>
```

Then look at it running. The owner may have Storybook open on 6006: never kill or restart it. Start another one on 6007 (`cd design-system && npx storybook dev -p 6007 --ci --no-open`, in the background) and open the pages the reference names. A "Failed to fetch dynamically imported module" there is a stale Vite cache, not the code: restart the 6007 one. Don't stop a process with `pkill -f` on a pattern that also matches the shell running the command.

## Rules that stay

- Local only: no branch, commit or push unless the owner asks (see the root `CLAUDE.md`).
- The convention lives in `docs/specs/repository-structure.md` and the Stories line of `AGENTS.md`: a change to this pattern changes them first, then this skill.
- A new kind of page gets its own file in `references/` and a row in the table above.
- `design-system/stories/getting-started.mdx` is the first page, outside every folder, and the preview (`parameters.options.storySort`) sets the order of the sidebar. A new section or foundation goes into both.
