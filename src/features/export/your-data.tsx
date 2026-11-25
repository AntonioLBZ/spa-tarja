import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { ButtonLink } from '@/components/button/button-link';
import { LiveNotice } from '@/components/notice/live-notice';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { sharedRowsOf } from '@/features/groups/share/use-shared-expense-rows';
import { budgetsQuery, categoriesQuery, incomeQuery } from '@/lib/api';
import { downloadFile } from '@/lib/files';
import { useLocale } from '@/lib/i18n';
import { backupJson, expensesCsv, exportFileName, type CsvLabels } from '@core/export';

import { useExportGroups } from './use-export-groups';

import './your-data.css';

const COLUMNS = [
    'date',
    'text',
    'category',
    'amount',
    'currency',
    'payment',
    'chargeDate',
    'personal',
    'part',
    'group',
] as const;

// The heading of the section, where the focus goes to download the data before deleting the account
const YOUR_DATA_ID = 'your-data';

// All the data as JSON and the expenses as CSV, made on the device from what it holds: the cache with the outbox on top.
// The JSON holds the groups and only the person's own expenses; the CSV adds their part of the shared ones. Nothing is
// sent (ADR-0001). The printable view of the expenses is a page of its own.
const YourData = () => {
    const t = useTranslations('settings.data');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const { expenses } = useExpenses();
    const { labelOf } = useCategoryOptions();
    const { data: categories = [] } = useQuery(categoriesQuery());
    const { data: income = [] } = useQuery(incomeQuery());
    const { data: budgets = [] } = useQuery(budgetsQuery());
    const { ledgers, titles, loading, missing } = useExportGroups();

    const downloadJson = () => {
        const now = new Date();
        downloadFile(
            exportFileName(now, 'json'),
            backupJson({ expenses, categories, income, budgets, groups: ledgers }, now),
            'application/json'
        );
    };

    const downloadCsv = () => {
        const labels: CsvLabels = {
            columns: COLUMNS.map((column) => t(`columns.${column}`)),
            payments: { direct: tPayment('direct'), credit: tPayment('credit'), voucher: tPayment('voucher') },
            categoryName: labelOf,
            groupName: (groupId) => titles.get(groupId) ?? '',
        };
        const shared = ledgers.flatMap(({ group, entries }) => sharedRowsOf(group, entries));
        downloadFile(
            exportFileName(new Date(), 'csv'),
            expensesCsv([...expenses, ...shared], locale, labels),
            'text/csv;charset=utf-8'
        );
    };

    return (
        <section className="your-data">
            <h2 id={YOUR_DATA_ID} tabIndex={-1}>
                {t('title')}
            </h2>
            <p className="hint">{t('description')}</p>
            <LiveNotice>{loading && t('loading')}</LiveNotice>
            <LiveNotice tone="danger">{!loading && missing && t('missing')}</LiveNotice>
            <div className="your-data__actions">
                <Button block disabled={loading} onClick={downloadJson}>
                    {t('json')}
                </Button>
                <Button block disabled={loading} onClick={downloadCsv}>
                    {t('csv')}
                </Button>
                <ButtonLink block className="your-data__print" to="/settings/account/print">
                    {t('print')}
                </ButtonLink>
            </div>
        </section>
    );
};

export { YOUR_DATA_ID, YourData };
