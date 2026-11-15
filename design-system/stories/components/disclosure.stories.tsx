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
        hint: { control: 'text' },
    },
};

// The first is the one the controls drive; the others show the closed, the open and the disabled toggle at once
export const Disclosure = (args: DisclosureProps) => {
    const [, updateArgs] = useArgs();

    return (
        <div style={{ display: 'grid', gap: '1rem' }}>
            <DisclosureComponent {...args} onOpenChange={(open) => updateArgs({ open })} />
            <DisclosureComponent {...args} open={false} summary="Closed" onOpenChange={undefined} />
            <DisclosureComponent {...args} open summary="Open" onOpenChange={undefined} />
            <DisclosureComponent {...args} open={false} disabled summary="Disabled" onOpenChange={undefined} />
        </div>
    );
};

export default Story;
