import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { categoriesQuery, incomeQuery } from '@/lib/api';
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

// A backup and a spreadsheet, made on the device from what it holds: the cache with the outbox on top. Nothing is sent.
function YourData() {
    const t = useTranslations('settings.data');
    const tPayment = useTranslations('expenses.payment');
    const { locale } = useLocale();
    const { expenses } = useExpenses();
    const { labelOf } = useCategoryOptions();
    const { data: categories = [] } = useQuery(categoriesQuery());
    const { data: income = [] } = useQuery(incomeQuery());

    function downloadBackup() {
        const now = new Date();
        downloadFile(
            exportFileName(now, 'json'),
            backupJson({ expenses, categories, income }, now),
            'application/json'
        );
    }

    function downloadSpreadsheet() {
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
    }

    return (
        <section className="your-data">
            <h2 className="your-data__title">{t('title')}</h2>
            <p className="your-data__hint">{t('description')}</p>
            <div className="your-data__actions">
                <Button onClick={downloadBackup}>{t('backup')}</Button>
                <Button onClick={downloadSpreadsheet}>{t('spreadsheet')}</Button>
            </div>
        </section>
    );
}

export { YourData };
