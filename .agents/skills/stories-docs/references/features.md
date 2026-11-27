# A piece of a feature

A piece of a feature (`src/features`) is documented in its own folder of `design-system/stories/features/`. Unlike a shared component it has **no playground**: it is shown with the data it reads, not tried prop by prop. ExpenseRow (`design-system/stories/features/expense-row/`) is the reference for a piece that reads data, YourData (`…/your-data/`) for one that also needs the router: read their files before writing a new one and copy their shape.

## The folder

```
design-system/stories/features/<kebab-name>/
├── meta-docs.stories.tsx    the examples: title `Features/<Name>`, hidden
└── overview.mdx             the Overview, attached to the examples, named "Overview"
```

The title has no `/Examples`: with no playground, the examples file is the entry of the sidebar, which then reads `Features → <Name> → Overview`.

## meta-docs.stories.tsx

```tsx
import { ExpenseRow } from '@/features/expenses/list/expense-row';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/ExpenseRow',
    component: ExpenseRow,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: {
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 120 } },
        appData: { categories: [...CUSTOM_CATEGORIES] },
    },
};

export const Basic = () => { … };

export default Story;
```

- `component` feeds the Props table of the Overview; `tags: ['!dev']` keeps the examples out of the sidebar.
- `source.type: 'dynamic'` shows the rendered JSX instead of the arrow function around it. Use `'code'` when the story as written reads better than what it renders, as one that keeps its own state (`category-select`).
- One story per example of the Overview (`Basic`, `NoText`, `Credit`). What the app always puts around the piece (the `CardList` of an `ExpenseRow`) goes in a decorator, with the feature's CSS imported if the piece needs it, so the shown code is the piece itself.

### Data, router and globals

- A piece that reads data goes inside `AppData` (`@stories/shared/app-data`), which swaps `fetch`, the storage and the signed-in person. Use the `withAppData` decorator, seeded from `parameters.appData`; a story that needs other data sets its own `parameters.appData`. Expenses come from `sampleExpense`, categories from `@stories/shared/fixtures` (`CUSTOM_CATEGORIES`, `useStoryCategories`).
- Two examples on one docs page would share that data, so such a file renders each story in its own frame: `story: { inline: false, iframeHeight: … }`, and a story that needs another height sets its own `parameters.docs.story.iframeHeight`. The same goes for anything that sets a global, as the connection (`onlineManager`).
- A piece with links goes inside `RouterFrame` (`@stories/shared/router-frame`), with the `paths` they point at, as a decorator before `withAppData`.

## overview.mdx

```mdx
import { ArgTypes, Canvas, Meta } from '@storybook/addon-docs/blocks';

import * as Examples from './meta-docs.stories';

<Meta of={Examples} name="Overview" />

# <Name>

One or two sentences: what it is, how it looks and where the app shows it.

## Usage

<Canvas of={Examples.Basic} sourceState="shown" />

Where it goes and what its main props are for.

## <A case of data or a prop that changes what is seen: "Without text", "On a credit card">

One sentence.

<Canvas of={Examples.NoText} />

## Props

<ArgTypes of={Examples} />
```

- It hangs from the examples (`<Meta of={Examples} />`) and imports only `./meta-docs.stories`.
- The description says where the app shows the piece; Usage, where it goes and what its main props are for.
- A case earns a section when the data or a prop changes what is seen (an expense with no text, on a credit card, in installments, not synced yet).

## Checks

The common ones, with `features` as the folder. The page is `http://localhost:6007/?path=/docs/features-<name>--overview`.
