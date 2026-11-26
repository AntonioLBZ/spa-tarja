import { Disclosure } from '@/components/disclosure/disclosure';
import { StoryNarrow } from '@stories/shared/layout';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

interface DisclosureStoryProps {
    summary: string;
    /** Empty for none */
    hint: string;
    children: string;
    open: boolean;
    disabled: boolean;
    chevron: boolean;
    wideChevron: boolean;
    align: 'center' | 'top';
    oneLine: boolean;
    inForm: boolean;
    heading: 'none' | 'h2' | 'h3';
}

const Story: Meta<DisclosureStoryProps> = {
    title: 'Components/Disclosure',
    args: {
        summary: 'Filters',
        hint: '',
        children: 'What the panel holds.',
        open: false,
        disabled: false,
        chevron: false,
        wideChevron: false,
        align: 'center',
        oneLine: false,
        inForm: false,
        heading: 'none',
    },
    argTypes: {
        summary: { control: 'text' },
        hint: { control: 'text' },
        children: { control: 'text' },
        wideChevron: { if: { arg: 'chevron' } },
        align: { control: 'inline-radio', options: ['center', 'top'] },
        oneLine: { if: { arg: 'hint', truthy: true } },
        heading: { control: 'inline-radio', options: ['none', 'h2', 'h3'] },
    },
};

export const Playground = (args: DisclosureStoryProps) => {
    const { hint, heading, children, ...props } = args;
    const [, updateArgs] = useArgs();

    return (
        <StoryNarrow>
            <Disclosure
                {...props}
                hint={hint || undefined}
                heading={heading === 'none' ? undefined : heading}
                onOpenChange={(open) => updateArgs({ open })}
            >
                {children}
            </Disclosure>
        </StoryNarrow>
    );
};

export default Story;
