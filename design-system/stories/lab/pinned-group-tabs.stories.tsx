import clsx from 'clsx';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

import './pinned-group-tabs.css';

type Look = 'underline' | 'title' | 'rule';

interface Option {
    look: Look;
    title: string;
    note: string;
}

const OPTIONS: readonly Option[] = [
    {
        look: 'underline',
        title: 'A. Underlined words (chosen, built)',
        note: 'The words at the size of the title today; the current one in ink with the 4 px ink bar under it, as the word of the current section in the header, the others in secondary text. No rule under the row.',
    },
    {
        look: 'title',
        title: 'B. The title and quiet words',
        note: 'The current tab is the title (bold, ink), the others are smaller secondary words after it. No bar: weight and color mark the current one. The row reads as the title of the screen with its other choices beside it.',
    },
    {
        look: 'rule',
        title: 'C. Tabs on a hairline',
        note: 'The row stands on a full-width ink hairline, and the current word puts the 4 px ink bar on it, as the header does on its own edge. The most "tab-like" of the three, and the clearest edge between the tabs and the list.',
    },
];

const WIDTHS = [
    { label: '320 px', width: '20rem' },
    { label: '390 px', width: '24.375rem' },
    { label: '640 px (40rem)', width: '40rem' },
];

const SETS = [
    {
        label: 'Three pinned, long names',
        tabs: ['Expenses', 'Trip to the mountains 2026', 'Flat on Calle Mayor', 'Ana'],
    },
    { label: 'One pinned', tabs: ['Expenses', 'Flat on Calle Mayor'] },
];

const ROWS = ['Groceries', 'Coffee', 'Train ticket', 'Dinner out'];

interface TabRowProps {
    look: Look;
    tabs: readonly string[];
}

const TabRow = (props: TabRowProps) => {
    const { look, tabs } = props;
    const [current, setCurrent] = useState(0);
    const rowClsx = clsx('pinned-tabs', `pinned-tabs--${look}`);

    return (
        <div className={rowClsx} role="tablist" aria-label="Expenses and pinned groups">
            {tabs.map((tab, index) => {
                const tabClsx = clsx('pinned-tabs__tab', {
                    'pinned-tabs__tab--current': index === current,
                    'pinned-tabs__tab--home': index === 0,
                });

                return (
                    <button
                        aria-selected={index === current}
                        className={tabClsx}
                        key={tab}
                        onClick={() => setCurrent(index)}
                        role="tab"
                        title={tab}
                        type="button"
                    >
                        <span className="pinned-tabs__word">{tab}</span>
                    </button>
                );
            })}
        </div>
    );
};

const Story: Meta = {
    title: 'Lab/Pinned group tabs',
    parameters: { layout: 'padded' },
};

export const PinnedGroupTabs = () => {
    return (
        <div className="pinned-lab">
            <p className="pinned-lab__intro">
                The title of the Expenses screen becomes a row of tabs: Expenses first, then up to three pinned groups.
                The row never wraps; Expenses never shrinks and a long group name is cut with an ellipsis. Every tab is
                at least 44 px tall. Press a tab to move the mark. Switch the theme and the language in the toolbar.
                Nothing here is in the app: the owner picks.
            </p>
            {OPTIONS.map((option) => (
                <section className="pinned-lab__option" key={option.look}>
                    <h2 className="pinned-lab__title">{option.title}</h2>
                    <p className="pinned-lab__note">{option.note}</p>
                    {SETS.map((set) => (
                        <div className="pinned-lab__set" key={set.label}>
                            <h3 className="pinned-lab__set-title">{set.label}</h3>
                            <div className="pinned-lab__frames">
                                {WIDTHS.map((width) => (
                                    <figure className="pinned-lab__frame" key={width.label}>
                                        <figcaption className="pinned-lab__caption">{width.label}</figcaption>
                                        <div className="pinned-lab__screen" style={{ inlineSize: width.width }}>
                                            <TabRow look={option.look} tabs={set.tabs} />
                                            <ul className="pinned-lab__rows">
                                                {ROWS.map((row) => (
                                                    <li key={row}>{row}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </figure>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
};

export default Story;
