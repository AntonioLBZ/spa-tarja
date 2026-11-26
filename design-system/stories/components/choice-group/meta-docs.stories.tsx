import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/ChoiceGroup/Examples',
    component: ChoiceGroup,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [value, setValue] = useState('system');

    return (
        <ChoiceGroup
            legend="Theme"
            name="theme"
            options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
            ]}
            value={value}
            onChange={setValue}
        />
    );
};

export const Tabs = () => {
    const [value, setValue] = useState('mine');

    return (
        <ChoiceGroup
            tabs
            legend="For"
            name="for"
            options={[
                { value: 'mine', label: 'Just me' },
                { value: 'shared', label: 'Shared' },
            ]}
            value={value}
            onChange={setValue}
        />
    );
};

export const Swatch = () => {
    const [value, setValue] = useState('restaurant');

    return (
        <ChoiceGroup
            swatch
            legend="Icon"
            name="icon"
            options={[
                { value: 'restaurant', label: 'Restaurant', content: <Icon name="restaurant" /> },
                { value: 'shopping_cart', label: 'Shopping cart', content: <Icon name="shopping_cart" /> },
                { value: 'home', label: 'Home', content: <Icon name="home" /> },
                { value: 'directions_bus', label: 'Bus', content: <Icon name="directions_bus" /> },
            ]}
            value={value}
            onChange={setValue}
        />
    );
};

export default Story;
