import { createFileRoute } from '@tanstack/react-router';

import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { EntryRefusals } from '@/features/groups/entry-refusals';

import './index.css';

const Home = () => {
    return (
        <section className="home">
            <h1 className="visually-hidden">Tarja</h1>
            <SyncStatus />
            <EntryRefusals />
            <ExpenseList />
        </section>
    );
};

export const Route = createFileRoute('/')({ component: Home });
