import { IncomeForm } from '@/features/summary/income-form';
import { withAppData } from '@stories/shared/app-data';

import type { Meta } from '@storybook/react-vite';

const OCTOBER = { month: '2026-10', amountCents: 150000, currency: 'EUR' };

const Story: Meta = {
    title: 'Features/IncomeForm',
    component: IncomeForm,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: {
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 200 } },
        appData: { income: [OCTOBER] },
    },
};

export const Basic = () => {
    return <IncomeForm month="2026-09" monthName="September 2026" income={undefined} />;
};

export const Set = () => {
    return <IncomeForm month="2026-10" monthName="October 2026" income={OCTOBER} />;
};

export default Story;
