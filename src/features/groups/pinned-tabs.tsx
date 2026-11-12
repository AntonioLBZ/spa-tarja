import { Link } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { useGroupWords } from './use-group-words';

import type { SharedGroup } from '@core/shared-group';

import './pinned-tabs.css';

interface PinnedTabsProps {
    groups: readonly SharedGroup[];
}

interface PinnedTabProps {
    group: SharedGroup;
}

// Exact, search included, so that only the tab of what is shown is current
const ACTIVE = { exact: true, includeSearch: true } as const;

// The title of the Expenses screen while groups are pinned to it: Expenses, then each pinned group, on one line
// (ADR-0018)
const PinnedTabs = (props: PinnedTabsProps) => {
    const { groups } = props;
    const t = useTranslations('expenses.list');

    return (
        <nav className="pinned-tabs" aria-label={t('tabs')}>
            <Link className="pinned-tabs__tab pinned-tabs__tab--home" to="/" activeOptions={ACTIVE}>
                <span className="pinned-tabs__word">{t('title')}</span>
            </Link>
            {groups.map((group) => (
                <PinnedTab key={group.id} group={group} />
            ))}
        </nav>
    );
};

const PinnedTab = (props: PinnedTabProps) => {
    const { group } = props;
    const { title } = useGroupWords(group);

    return (
        <Link className="pinned-tabs__tab" to="/" search={{ group: group.id }} activeOptions={ACTIVE} title={title}>
            <span className="pinned-tabs__word">{title}</span>
        </Link>
    );
};

export { PinnedTabs, type PinnedTabsProps };
