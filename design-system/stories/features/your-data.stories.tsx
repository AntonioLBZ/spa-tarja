import { YourData as YourDataComponent } from '@/features/export/your-data';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/YourData',
};

export const YourData = () => {
    return (
        <AppData
            api={{
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
            }}
        >
            {() => <YourDataComponent />}
        </AppData>
    );
};

export default Story;
