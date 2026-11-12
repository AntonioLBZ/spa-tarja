import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { ExpenseList } from '@/features/expenses/expense-list';
import { MonthHero } from '@/features/expenses/month-hero';
import { SyncStatus } from '@/features/expenses/sync-status';
import { EntryRefusals } from '@/features/groups/entry-refusals';
import { healthQuery } from '@/lib/api';

import './index.css';

const Home = () => {
    const t = useTranslations('home');
    const health = useQuery(healthQuery());
    const down = !health.isPending && !health.data?.ok;

    return (
        <section className="home">
            <h1 className="visually-hidden">Tarja</h1>
            <MonthHero />
            <SyncStatus />
            <EntryRefusals />
            <ExpenseList />
            {down && (
                <Notice tone="danger" role="status">
                    {t('health.error')}
                </Notice>
            )}
        </section>
    );
};

export const Route = createFileRoute('/')({ component: Home });
