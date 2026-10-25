import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { ExpenseForm } from '@/features/expenses/expense-form';
import { ExpenseList } from '@/features/expenses/expense-list';
import { SyncStatus } from '@/features/expenses/sync-status';
import { healthQuery } from '@/lib/api';

import './index.css';

const TONES = { pending: 'quiet', ok: 'info', error: 'danger' } as const;

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
            <Notice tone={TONES[state]} role="status">
                {t(`health.${state}`)}
            </Notice>
        </section>
    );
}
