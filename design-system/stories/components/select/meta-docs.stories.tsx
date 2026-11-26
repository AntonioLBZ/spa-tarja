import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Select } from '@/components/select/select';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Select/Examples',
    component: Select,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [value, setValue] = useState('food');

    return (
        <Field label="Category">
            {(control) => (
                <Select
                    {...control}
                    options={[
                        { value: 'food', label: 'Food', icon: <Icon name="restaurant" /> },
                        { value: 'groceries', label: 'Groceries', icon: <Icon name="shopping_cart" /> },
                        { value: 'gym', label: 'Gym', icon: <Icon name="fitness_center" /> },
                    ]}
                    value={value}
                    onChange={setValue}
                />
            )}
        </Field>
    );
};

export const NoIcons = () => {
    const [value, setValue] = useState('day');

    return (
        <Field label="Group by">
            {(control) => (
                <Select
                    {...control}
                    options={[
                        { value: 'day', label: 'Day' },
                        { value: 'week', label: 'Week' },
                        { value: 'month', label: 'Month' },
                    ]}
                    value={value}
                    onChange={setValue}
                />
            )}
        </Field>
    );
};

export const Disabled = () => {
    return (
        <Field label="Category">
            {(control) => (
                <Select
                    {...control}
                    disabled
                    options={[{ value: 'food', label: 'Food', icon: <Icon name="restaurant" /> }]}
                    value="food"
                    onChange={() => undefined}
                />
            )}
        </Field>
    );
};

export default Story;
