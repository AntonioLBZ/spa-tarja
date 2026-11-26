import { ChoiceGroup, type ChoiceOption } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { useState } from 'react';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

/** Boxes with words, underlined words (`tabs`) or boxes with an icon each (`swatch`) */
type Look = 'boxes' | 'tabs' | 'swatch';

interface ChoiceGroupStoryProps {
    legend: string;
    look: Look;
    onChange: (value: string) => void;
}

const SWATCHES = (
    [
        ['restaurant', 'Restaurant'],
        ['shopping_cart', 'Shopping cart'],
        ['sports_esports', 'Games'],
        ['home', 'Home'],
        ['directions_bus', 'Bus'],
        ['medical_services', 'Health'],
        ['pets', 'Pets'],
        ['bolt', 'Electricity'],
    ] as const
).map(([value, label]) => ({ value, label, content: <Icon name={value} /> }));

const OPTIONS: Record<Look, readonly ChoiceOption<string>[]> = {
    boxes: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' },
    ],
    tabs: [
        { value: 'mine', label: 'Just me' },
        { value: 'shared', label: 'Shared' },
    ],
    swatch: SWATCHES,
};

const Group = (props: ChoiceGroupStoryProps) => {
    const { legend, look, onChange } = props;
    const options = OPTIONS[look];
    const [value, setValue] = useState(options[0]?.value ?? '');

    return (
        <ChoiceGroup
            legend={legend}
            name={look}
            options={options}
            value={value}
            swatch={look === 'swatch'}
            tabs={look === 'tabs'}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
        />
    );
};

const Story: Meta<ChoiceGroupStoryProps> = {
    title: 'Components/ChoiceGroup',
    args: { legend: 'Theme', look: 'boxes', onChange: fn() },
    argTypes: {
        legend: { control: 'text' },
        look: { control: 'inline-radio', options: ['boxes', 'tabs', 'swatch'] },
        onChange: { table: { disable: true } },
    },
};

export const Playground = (args: ChoiceGroupStoryProps) => {
    return <Group key={args.look} {...args} />;
};

export default Story;
