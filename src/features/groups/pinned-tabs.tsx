import { Link, useSearch } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { useGroupWords } from './use-group-words';

import type { SharedGroup } from '@core/shared-group';

import './pinned-tabs.css';

// The view transition types of a tab
interface TabSlide {
    types: string[];
}

interface PinnedTabsProps {
    groups: readonly SharedGroup[];
}

interface PinnedTabProps {
    group: SharedGroup;
    slide: TabSlide;
}

// The tabs slide the screen along their row like the sections along the bar: to the right of the shown one is next
const slideTo = (index: number, shown: number): TabSlide => {
    return { types: [index > shown ? 'next' : 'previous'] };
};

// Exact, search included, so that only the tab of what is shown is current
const ACTIVE = { exact: true, includeSearch: true } as const;

// The title of the Expenses screen while groups are pinned to it: Expenses, then each pinned group, on one line
// (ADR-0021)
const PinnedTabs = (props: PinnedTabsProps) => {
    const { groups } = props;
    const t = useTranslations('expenses.list');
    const { group: asked } = useSearch({ strict: false });
    const shown = groups.findIndex((group) => group.id === asked?.toLowerCase()) + 1;

    return (
        <nav className="pinned-tabs" aria-label={t('tabs')}>
            <Link
                className="pinned-tabs__tab pinned-tabs__tab--home"
                to="/"
                activeOptions={ACTIVE}
                viewTransition={slideTo(0, shown)}
            >
                <span className="pinned-tabs__word">{t('title')}</span>
            </Link>
            {groups.map((group, index) => (
                <PinnedTab key={group.id} group={group} slide={slideTo(index + 1, shown)} />
            ))}
        </nav>
    );
};

const PinnedTab = (props: PinnedTabProps) => {
    const { group, slide } = props;
    const { title } = useGroupWords(group);

    return (
        <Link
            className="pinned-tabs__tab"
            to="/"
            search={{ group: group.id }}
            activeOptions={ACTIVE}
            title={title}
            viewTransition={slide}
        >
            <span className="pinned-tabs__word">{title}</span>
        </Link>
    );
};

export { PinnedTabs, type PinnedTabsProps };
