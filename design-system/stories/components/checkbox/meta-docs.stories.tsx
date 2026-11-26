import { Checkbox } from '@/components/checkbox/checkbox';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Checkbox/Examples',
    component: Checkbox,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [checked, setChecked] = useState(true);

    return <Checkbox label="Simplify debts" checked={checked} onChange={setChecked} />;
};

export const Hint = () => {
    const [checked, setChecked] = useState(true);

    return (
        <Checkbox
            label="Color"
            hint="Green for what you get back, red for what you owe."
            checked={checked}
            onChange={setChecked}
        />
    );
};

export const Disabled = () => {
    return <Checkbox label="Notifications on this device" checked={false} disabled onChange={() => undefined} />;
};

export default Story;
