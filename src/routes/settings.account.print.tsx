import { createFileRoute } from '@tanstack/react-router';

import { PrintExpenses } from '@/features/export/print-expenses';

const PrintPage = () => {
    return <PrintExpenses />;
};

export const Route = createFileRoute('/settings/account/print')({ component: PrintPage });
