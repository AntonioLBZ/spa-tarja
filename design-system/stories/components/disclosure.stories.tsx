import { Disclosure as DisclosureComponent, type DisclosureProps } from '@/components/disclosure/disclosure';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<DisclosureProps> = {
    title: 'Components/Disclosure',
    component: DisclosureComponent,
    args: {
        summary: 'Filters',
        children: 'What the panel holds.',
        open: false,
        chevron: false,
        disabled: false,
        keepMounted: false,
    },
    argTypes: {
        as: { control: false },
        children: { control: 'text' },
        defaultOpen: { control: false },
        heading: { control: 'inline-radio', options: [undefined, 'h2', 'h3'] },
        summary: { control: 'text' },
    },
};

// The state is kept in the args, so the `open` control follows what is clicked
export const Disclosure = (args: DisclosureProps) => {
    const [, updateArgs] = useArgs();

    return <DisclosureComponent {...args} onOpenChange={(open) => updateArgs({ open })} />;
};

export default Story;
