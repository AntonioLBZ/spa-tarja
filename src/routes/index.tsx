import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { AddExpense } from '@/features/expenses/add-expense';
import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { healthQuery } from '@/lib/api';

import './index.css';

const TONES = { pending: 'quiet', ok: 'info', error: 'danger' } as const;

const Home = () => {
    const t = useTranslations('home');
    const health = useQuery(healthQuery());
    const state = health.isPending ? 'pending' : health.data?.ok ? 'ok' : 'error';

    return (
        <section className="home">
            <h1 className="visually-hidden">Tarja</h1>
            <AddExpense />
            <SyncStatus />
            <ExpenseList />
            <Notice tone={TONES[state]} role="status">
                {t(`health.${state}`)}
            </Notice>
        </section>
    );
};

export const Route = createFileRoute('/')({ component: Home });
