import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { budgetsQuery, categoriesQuery, incomeQuery } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { useLocale } from '@/lib/i18n';
import { backupJson, expensesCsv, exportFileName, type CsvLabels } from '@core/export';

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
] as const;

// All the data as JSON and the expenses as CSV, made on the device from what it holds: the cache with the outbox on top.
// Nothing is sent (ADR-0001).
const YourData = () => {
    const t = useTranslations('settings.data');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const { expenses } = useExpenses();
    const { labelOf } = useCategoryOptions();
    const { data: categories = [] } = useQuery(categoriesQuery());
    const { data: income = [] } = useQuery(incomeQuery());
    const { data: budgets = [] } = useQuery(budgetsQuery());

    const downloadJson = () => {
        const now = new Date();
        downloadFile(
            exportFileName(now, 'json'),
            backupJson({ expenses, categories, income, budgets }, now),
            'application/json'
        );
    };

    const downloadCsv = () => {
        const labels: CsvLabels = {
            columns: COLUMNS.map((column) => t(`columns.${column}`)),
            payments: { direct: tPayment('direct'), credit: tPayment('credit'), voucher: tPayment('voucher') },
            categoryName: labelOf,
        };
        downloadFile(
            exportFileName(new Date(), 'csv'),
            expensesCsv(expenses, locale, labels),
            'text/csv;charset=utf-8'
        );
    };

    return (
        <section className="your-data">
            <h2 className="your-data__title">{t('title')}</h2>
            <p className="your-data__hint">{t('description')}</p>
            <div className="your-data__actions">
                <Button block onClick={downloadJson}>
                    {t('json')}
                </Button>
                <Button block onClick={downloadCsv}>
                    {t('csv')}
                </Button>
            </div>
        </section>
    );
};

export { YourData };
