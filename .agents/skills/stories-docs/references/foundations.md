# A foundation

A foundation is a family of tokens or assets of the design system: Colors, Typography, Iconography, Spacing and Motion. Each one is documented in its own folder of `design-system/stories/foundations/`, with **no playground and no Props table**: its overview says how a component uses it and then lists it by category. Colors (`design-system/stories/foundations/colors/`) is the reference: read its files before writing a new one and copy their shape.

## The folder

```
design-system/stories/foundations/<kebab-name>/
├── meta-docs.stories.tsx    the samples: title `Foundations/<Name>`, hidden
├── <kebab-name>.css         the look of the samples
└── overview.mdx             the Overview, attached to the samples, named "Overview"
```

The sidebar then reads `Foundations → <Name> → Overview`.

## meta-docs.stories.tsx

```tsx
import { tokensWith, type Token } from '@stories/shared/tokens';

import type { Meta } from '@storybook/react-vite';

import './colors.css';

const Swatches = (props: SwatchesProps) => { … };

const Story: Meta = {
    title: 'Foundations/Colors',
    tags: ['!dev'],
};

export const Backgrounds = () => {
    return <Swatches tokens={tokensWith('--color-bg-')} />;
};

export default Story;
```

- One story per category of the overview, named after it (`Backgrounds`, `Sizes`, `Interface`). The helper that draws a sample (`Swatches`, `Bars`, `IconGrid`) is a component of the file, not exported.
- The samples read what they show from the source, never a copy: the tokens from `tokens.css` through `@stories/shared/tokens` (`tokensWith(prefix)`, `tokensUnder(selector)` for a rule that overrides some, as the palette for color blindness), the icons from `UI_ICONS` and `CATEGORY_ICONS`. A new token or icon then appears on its own. A category with no prefix of its own is what the others leave (`Rest` in Colors), so a token never goes missing.
- A token reaches a sample as a custom property (``style={{ '--swatch': `var(${token.name})` } as CSSProperties}``) that its CSS reads; never another inline style.
- The CSS is mobile-first like the app's: a sample fits 320 px and widens with `@media (width >= 40rem)`.
- A token name or value never breaks across lines (`white-space: nowrap`). Rows of a list share one grid (the rows `display: contents`, the columns `max-content`), so the columns fit the longest name and line up; on a phone each goes on a line of its own.

## overview.mdx

````mdx
import { Canvas, Meta } from '@storybook/addon-docs/blocks';

import * as Examples from './meta-docs.stories';

<Meta of={Examples} name="Overview" />

# <Name>

One or two sentences: what the foundation is and its idea.

## Usage

A real rule of the app that uses it, named in a line:

```css
.notice--quiet {
    border-left-color: var(--color-border-subtle);
    color: var(--color-content-secondary);
}
```

The rules for using it, from `design-system/DESIGN.md`: what a component takes, what it never does, what a new token needs.

## <A category: "Backgrounds", "Sizes", "Interface">

One or two sentences: what it is for.

<Canvas of={Examples.Backgrounds} sourceState="none" />
````

- Order: title and description, **Usage**, then one section per category, in the order the reader looks for them. No Props section.
- Usage is the only place with code: a short real rule or line of the app, copied from it (a `Notice`, a `Button`, a `Field`), never a made-up class. It is not what a Canvas shows, so it is not a repeat.
- Every Canvas has `sourceState="none"`: the code of a sample is how the sample is drawn, not how to use the tokens.
- The rules say what `DESIGN.md` says, shorter; when `DESIGN.md` changes them, the overview follows.

## Checks

The common ones, with `foundations` as the folder, plus `npx stylelint "design-system/stories/foundations/<kebab-name>/*.css"`. The page is `http://localhost:6007/?path=/docs/foundations-<name>--overview`; look at it at 320 px and in the dark theme too.
