import { Navigate, createFileRoute } from '@tanstack/react-router';

import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { EntryRefusals } from '@/features/groups/entry-refusals';
import { GroupScreen } from '@/features/groups/group-screen';
import { usePinnedGroups } from '@/features/groups/pinned-groups';
import { PinnedTabs } from '@/features/groups/pinned-tabs';
import { useGroups } from '@/features/groups/use-ledgers';

import './index.css';

interface HomeSearch {
    // A pinned group shown under its tab (ADR-0018)
    group?: string;
}

const Home = () => {
    const { group: asked } = Route.useSearch();
    const { hasData } = useGroups();
    const pinned = usePinnedGroups();
    const shown = asked ? pinned.find((group) => group.id === asked.toLowerCase()) : undefined;

    // A tab that went away, or an address with a group that isn't pinned, falls back to Expenses
    if (asked && !shown && hasData) return <Navigate to="/" replace />;

    return (
        <section className="home">
            <h1 className="visually-hidden">Tarja</h1>
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
