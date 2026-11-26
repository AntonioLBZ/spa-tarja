import { Amount } from '@/components/amount/amount';

import type { Meta } from '@storybook/react-vite';

interface AmountStoryProps {
    text: string;
    direction: 'none' | 'in' | 'out';
    color: boolean;
    sign: boolean;
    arrow: boolean;
    /** The palette for color blindness of Settings → Amounts */
    colorBlind: boolean;
}

const Story: Meta<AmountStoryProps> = {
    title: 'Components/Amount',
    args: { text: '€21.50', direction: 'in', color: true, sign: true, arrow: true, colorBlind: false },
    argTypes: {
        text: { control: 'text' },
        direction: { control: 'inline-radio', options: ['none', 'in', 'out'] },
    },
};

export const Playground = (args: AmountStoryProps) => {
    const { direction, colorBlind, ...props } = args;

    return (
        <span data-money-palette={colorBlind ? 'color-blind' : undefined}>
            <Amount {...props} direction={direction === 'none' ? undefined : direction} />
        </span>
    );
};

export default Story;
