import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { CategoryRow } from '@/features/categories/category-row';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/CategoryRow',
    component: CategoryRow,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
    decorators: [
        (Story) => (
            <Sheet label="Yours">
                <CardList flush>
                    <Story />
                </CardList>
            </Sheet>
        ),
    ],
};

export const Basic = () => {
    return (
        <CategoryRow
            category={{ id: 'custom-pets', name: 'Pets', color: 'orange', icon: 'pets' }}
            disabled={false}
            fallbackLabel="Other"
            onEdit={() => undefined}
            onDelete={() => Promise.resolve(true)}
        />
    );
};

export const LongName = () => {
    return (
        <CategoryRow
            category={{
                id: 'custom-presents',
                name: 'Presents for the family and friends',
                color: 'purple',
                icon: 'redeem',
            }}
            disabled={false}
            fallbackLabel="Other"
            onEdit={() => undefined}
            onDelete={() => Promise.resolve(true)}
        />
    );
};

export const Disabled = () => {
    return (
        <CategoryRow
            category={{ id: 'custom-pets', name: 'Pets', color: 'orange', icon: 'pets' }}
            disabled
            fallbackLabel="Other"
            onEdit={() => undefined}
            onDelete={() => Promise.resolve(true)}
        />
    );
};

export default Story;
