import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { ExpenseForm } from '@/features/expenses/expense-form';
import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { healthQuery } from '@/lib/api';

import './index.css';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
    const t = useTranslations('home');
    const health = useQuery(healthQuery());
    const state = health.isPending ? 'pending' : health.data?.ok ? 'ok' : 'error';

    return (
        <section className="home">
            <h1 className="visually-hidden">Tarja</h1>
            <ExpenseForm />
            <SyncStatus />
            <ExpenseList />
            <p className={clsx('home__status', `home__status--${state}`)} role="status">
                {t(`health.${state}`)}
            </p>
        </section>
    );
}
