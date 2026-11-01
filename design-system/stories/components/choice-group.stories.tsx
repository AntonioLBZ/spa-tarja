import { ChoiceGroup as ChoiceGroupComponent, type ChoiceGroupProps } from '@/components/choice-group/choice-group';
import { Icon } from '@/components/icon/icon';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const OPTIONS = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
];

// What a swatch holds in place of a word
const SWATCHES = [
    { value: 'restaurant', label: 'Restaurant', content: <Icon name="restaurant" /> },
    { value: 'shopping_cart', label: 'Shopping cart', content: <Icon name="shopping_cart" /> },
    { value: 'sports_esports', label: 'Games', content: <Icon name="sports_esports" /> },
    { value: 'home', label: 'Home', content: <Icon name="home" /> },
    { value: 'directions_bus', label: 'Bus', content: <Icon name="directions_bus" /> },
    { value: 'medical_services', label: 'Health', content: <Icon name="medical_services" /> },
    { value: 'pets', label: 'Pets', content: <Icon name="pets" /> },
    { value: 'bolt', label: 'Electricity', content: <Icon name="bolt" /> },
];

const Story: Meta<ChoiceGroupProps<string>> = {
    title: 'Components/ChoiceGroup',
    component: ChoiceGroupComponent,
    args: { legend: 'Theme', name: 'theme', options: OPTIONS, value: 'light', swatch: false },
    argTypes: {
        value: { control: 'inline-radio', options: OPTIONS.map((option) => option.value) },
        options: { control: false },
    },
};

// The choice is kept in the args, so the control follows what is clicked
export const ChoiceGroup = (args: ChoiceGroupProps<string>) => {
    const [, updateArgs] = useArgs();
    // `swatch` swaps the words for icons, with the first one checked until another is picked
    const options = args.swatch ? SWATCHES : args.options;
    const value = options.some((option) => option.value === args.value) ? args.value : (options[0]?.value ?? '');

    return (
        <ChoiceGroupComponent
            {...args}
            options={options}
            value={value}
            onChange={(next) => updateArgs({ value: next })}
        />
    );
};

export default Story;
