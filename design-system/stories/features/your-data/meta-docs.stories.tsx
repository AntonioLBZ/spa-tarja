import { YourData } from '@/features/export/your-data';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/YourData',
    component: YourData,
    tags: ['!dev'],
    decorators: [
        (Story) => (
            <RouterFrame paths={['/settings/account/print']}>
                <Story />
            </RouterFrame>
        ),
        withAppData,
    ],
    parameters: {
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 320 } },
        appData: {
            categories: [...CUSTOM_CATEGORIES],
            expenses: [
                sampleExpense('44444444-4444-4444-8444-444444444441', '2026-10-03'),
                sampleExpense('44444444-4444-4444-8444-444444444442', '2026-10-12', {
                    categoryId: 'custom-pets',
                    text: 'Vet',
                    amountCents: 4200,
                }),
            ],
            income: [{ month: '2026-10', amountCents: 150000, currency: 'EUR' }],
        },
    },
};

export const Basic = () => {
    return <YourData />;
};

export default Story;
