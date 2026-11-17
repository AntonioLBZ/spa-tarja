import { useSearch } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { TabLink } from '@/components/tab/tab-link';

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

// The tabs slide the screen along their row like the sections along the bar: to the right of the shown one is next.
// `tabs` says the row stays on both screens, so it alone holds still.
const slideTo = (index: number, shown: number): TabSlide => {
    return { types: [index > shown ? 'next' : 'previous', 'tabs'] };
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
            <TabLink className="pinned-tabs__home" to="/" activeOptions={ACTIVE} viewTransition={slideTo(0, shown)}>
                {t('title')}
            </TabLink>
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
        <TabLink
            className="pinned-tabs__group"
            to="/"
            search={{ group: group.id }}
            activeOptions={ACTIVE}
            title={title}
            viewTransition={slide}
        >
            {title}
        </TabLink>
    );
};

export { PinnedTabs, type PinnedTabsProps };
