import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Notice } from '@/components/notice/notice';
import { ExpenseList } from '@/features/expenses/expense-list';
import { MonthHero } from '@/features/expenses/month-hero';
import { SyncStatus } from '@/features/expenses/sync-status';
import { EntryRefusals } from '@/features/groups/entry-refusals';
import { Page } from '@/features/shell/page';
import { healthQuery } from '@/lib/api';

import './index.css';

const Home = () => {
    const t = useTranslations('home');
    const health = useQuery(healthQuery());
    const down = !health.isPending && !health.data?.ok;

    return (
        <Page title="Tarja" titleVisible={false} hero={<MonthHero />}>
            <div className="home">
                <SyncStatus />
                <EntryRefusals />
                <ExpenseList />
                {down && (
                    <Notice tone="danger" role="status">
                        {t('health.error')}
                    </Notice>
                )}
            </div>
        </Page>
    );
};

export const Route = createFileRoute('/')({ component: Home });
