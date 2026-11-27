# A shared component

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
- One story per example of the Overview (`Basic`, `Links`, `Danger`, `Tabs`). A wrapper (a narrow column, a fake frame) only when the component itself has a prop or a rule about it.

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

- It hangs from the playground (`<Meta of={PlaygroundStories} />`) and imports only its two neighbour files.
- Usage says when to use it and when not, from `design-system/DESIGN.md` "Components".
- A special case is about this component: a prop that changes what is seen, or a real way it is used (links in an `Actions`), never the look of a `Button` inside an `Actions`.

## Checks

The common ones, with `components` as the folder. The pages are `http://localhost:6007/?path=/docs/components-<name>--overview` and `…/story/components-<name>--playground`.
