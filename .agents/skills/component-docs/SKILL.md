---
name: component-docs
description: Write or change the Storybook documentation of a shared component of Tarja (design-system/stories/components/<name>/ with playground.stories.tsx, meta-docs.stories.tsx and overview.mdx) or of a piece of a feature (design-system/stories/features/<name>/ with meta-docs.stories.tsx and overview.mdx, no playground). Use when a component in src/components or a piece of src/features is added, changed or needs its Overview or Playground written, moved to the folder pattern, or reviewed; also when the owner says "documenta el componente", "la doc de Storybook", "el overview" or "el playground".
---

# Component docs in Storybook

Every shared component of `src/components` is documented in its own folder of `design-system/stories/components/`, the same way for all of them. Actions (`design-system/stories/components/actions/`) is the reference: read its three files before writing a new one and copy their shape.

## The folder

```
design-system/stories/components/<kebab-name>/
├── playground.stories.tsx   the Playground: title `Components/<Name>`, one story `Playground`
├── meta-docs.stories.tsx    the examples the Overview shows: title `Components/<Name>/Examples`, hidden
└── overview.mdx             the Overview: attached to the playground, named "Overview"
```

The sidebar then reads `Components → <Name> → Overview, Playground`, and the examples never show in it.

## playground.stories.tsx

```tsx
import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

interface ActionsStoryProps {
    count: number;
}

const Story: Meta<ActionsStoryProps> = {
    title: 'Components/Actions',
    args: { count: 3 },
    argTypes: { count: { control: { type: 'range', min: 1, max: 4, step: 1 } } },
};

export const Playground = (args: ActionsStoryProps) => { … };

export default Story;
```

- Controls only for what is worth trying, picked from named cases, never typed as JSON. A prop that needs another comes with it (a glyph with its icon and its name). Callbacks are `fn()` and hidden (`table: { disable: true }`); refs, ids and classes are hidden.
- What a component keeps itself (open, checked, the value) is kept in the args with `useArgs`, so the control follows what is clicked.
- No comments that only restate the code. A comment on a story prop only when its name doesn't say what it is.
- `component:` in the `Meta` only when the args are that component's own props.

## meta-docs.stories.tsx

```tsx
const Story: Meta = {
    title: 'Components/<Name>/Examples',
    component: <Component>,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => { … };
export const Links = () => { … };

export default Story;
```

- `component` is what feeds the Props table of the Overview.
- `tags: ['!dev']` keeps the examples out of the sidebar; `source.type: 'dynamic'` makes the shown code the rendered JSX instead of the arrow function around it.
- One function story per example of the Overview, named after the case (`Basic`, `Links`, `Danger`, `Tabs`), the least markup that shows it, with the copy the app really uses. No comments.
- No wrapper that only exists for the demo (a narrow column, a fake frame) unless the component itself has a prop or a rule about it.

## overview.mdx

```mdx
import { ArgTypes, Canvas, Meta } from '@storybook/addon-docs/blocks';

import * as Examples from './meta-docs.stories';
import * as PlaygroundStories from './playground.stories';

<Meta of={PlaygroundStories} name="Overview" />

# <Name>

One or two sentences: what it is and how it looks or behaves.

## Usage

<Canvas of={Examples.Basic} sourceState="shown" />

When to use it, and when not (from `design-system/DESIGN.md` "Components").

## <A special case, named by what it shows: "As links", "Danger", "In a form">

One sentence.

<Canvas of={Examples.Links} />

## Props

<ArgTypes of={Examples} />
```

- English, short, structured, simple. Sentences in the style of the project docs: say what it is and what it does.
- Order: title and description, **Usage** (its Canvas with the code shown), the special cases, **Props** last.
- The basic Canvas has `sourceState="shown"`; the others keep the code folded. Never a hand-written code block that repeats what a Canvas shows.
- A special case earns a section only when it is about this component and is used in the app: a prop that changes what is seen, or a real way it is used (links in an `Actions`). Leave out what belongs to another component (the look of a `Button` inside an `Actions`), props that change nothing on screen (`className`, refs, `aria-*`), and `children` unless what it takes is the point.
- Imports only from its two neighbour files: the `@/` alias doesn't resolve in an `.mdx` (the tsconfig paths cover only `.ts`/`.tsx`), so the Props table comes from `ArgTypes of={Examples}`.
- The Props table fills its Description column from `/** … */` comments on the props of the component; `//` comments leave it empty.

## A piece of a feature

A piece of a feature (`src/features`) is documented the same way in `design-system/stories/features/<kebab-name>/`, with two files and **no playground**:

- `meta-docs.stories.tsx`: title `Features/<Name>` (not `/Examples`: with no playground it is the entry of the sidebar), `component`, `tags: ['!dev']`, `source.type: 'dynamic'`, one function story per example.
- `overview.mdx`: `<Meta of={Examples} name="Overview" />`, imports only `./meta-docs.stories`; what the piece is and where the app shows it, Usage, a section per case of data or prop that changes what is seen, Props last.

The sidebar then reads `Features → <Name> → Overview`.

- A piece that reads data goes inside `AppData` (`@stories/shared/app-data`), which swaps `fetch`, the storage and the signed-in person for the whole page. Two examples on one docs page would share them, so such an examples file renders each story in its own frame: `parameters: { docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 320 } } }`, and a story that needs another height sets its own `parameters.docs.story.iframeHeight`. The same goes for anything that sets a global, as the connection (`onlineManager`).
- When `AppData` (or another provider the piece needs) is the same for every example, it goes in a `decorators` entry, so the shown code is the piece itself; what an example seeds differently goes in that story.
- The categories of the stories come from `@stories/shared/fixtures`.

## Moving a component to the folder

Delete the old `design-system/stories/components/<name>.stories.tsx` (or `features/<name>.stories.tsx`) (with `rm`: it may have local changes) and make the folder. The shared helpers of `design-system/stories/shared/` (`@stories/shared/*`) stay available for the playground.

## Checks

From the repo root:

```bash
npx tsc -p design-system --noEmit
npx eslint design-system/stories/<components|features>/<kebab-name>
npx prettier --write design-system/stories/<components|features>/<kebab-name>
```

Then look at it running. The owner may have Storybook open on 6006: never kill or restart it. Start another one on 6007 (`cd design-system && npx storybook dev -p 6007 --ci --no-open`, in the background) and open `http://localhost:6007/?path=/docs/components-<name>--overview` and `…/story/components-<name>--playground` in the browser. A "Failed to fetch dynamically imported module" there is a stale Vite cache, not the code: restart the 6007 one. Don't stop a process with `pkill -f` on a pattern that also matches the shell running the command.

## Rules that stay

- Local only: no branch, commit or push unless the owner asks (see the root `CLAUDE.md`).
- The convention lives in `docs/specs/repository-structure.md` and the Stories line of `AGENTS.md`: a change to this pattern changes them first, then this skill.
