import { Amount as AmountComponent, type AmountProps } from '@/components/amount/amount';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<AmountProps> = {
    title: 'Components/Amount',
    component: AmountComponent,
    args: { text: '€21.50', direction: 'in', color: true, sign: true, arrow: true },
    argTypes: {
        direction: { control: 'inline-radio', options: [undefined, 'in', 'out'] },
    },
};

// The palette for color blindness is a mark on the root; the story shows both side by side
export const Amount = (args: AmountProps) => {
    return (
        <div style={{ display: 'grid', gap: 'var(--size-4)' }}>
            <span style={{ display: 'flex', gap: 'var(--size-6)' }}>
                <AmountComponent {...args} />
                <AmountComponent {...args} direction={args.direction === 'out' ? 'in' : 'out'} />
            </span>
            <span data-money-palette="color-blind" style={{ display: 'flex', gap: 'var(--size-6)' }}>
                <AmountComponent {...args} />
                <AmountComponent {...args} direction={args.direction === 'out' ? 'in' : 'out'} />
            </span>
        </div>
    );
};

export default Story;
