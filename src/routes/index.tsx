import { Navigate, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useLayoutEffect } from 'react';

import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { EntryRefusals } from '@/features/groups/data/entry-refusals';
import { useGroups } from '@/features/groups/data/use-ledgers';
import { usePinnedGroups } from '@/features/groups/pins/pinned-groups';
import { PinnedTabs } from '@/features/groups/pins/pinned-tabs';
import { GroupScreen } from '@/features/groups/screen/group-screen';
import { useUserData } from '@/lib/offline';

import './index.css';

interface HomeSearch {
    // A pinned group shown under its tab (ADR-0021)
    group?: string;
}

const Home = () => {
    const { group: asked } = Route.useSearch();
    const { hasData } = useGroups();
    const pinned = usePinnedGroups();
    const shown = asked ? pinned.find((group) => group.id === asked.toLowerCase()) : undefined;
    const shownId = shown?.id ?? null;
    const { homeTab } = useUserData();
    const navigate = useNavigate();

    // The app opens on the tab shown last on this device
    useLayoutEffect(() => {
        const to = homeTab.follow(asked, shownId);
        if (to !== null) void navigate({ to: '/', search: { group: to }, replace: true, viewTransition: false });
    }, [homeTab, asked, shownId, navigate]);

    // A tab that went away, or an address with a group that isn't pinned, falls back to Expenses
    if (asked && !shown && hasData) return <Navigate to="/" replace />;

    return (
        <section className="home">
            {pinned.length > 0 && <PinnedTabs groups={pinned} />}
            {shown ? (
                <GroupScreen groupId={shown.id} inTab />
            ) : (
                <>
                    <SyncStatus />
                    <EntryRefusals />
                    <ExpenseList titleHidden={pinned.length > 0} />
                </>
            )}
        </section>
    );
};

export const Route = createFileRoute('/')({
    component: Home,
    validateSearch: (search: Record<string, unknown>): HomeSearch => {
        return typeof search.group === 'string' ? { group: search.group } : {};
    },
});
