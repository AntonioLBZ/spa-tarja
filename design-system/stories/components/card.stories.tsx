import { Card as CardComponent, type CardProps } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<CardProps> = {
    title: 'Components/Card',
    component: CardComponent,
    args: { children: 'A box with the notch' },
    argTypes: { as: { control: false }, children: { control: 'text' } },
};

export const Card = (args: CardProps) => {
    return <CardComponent {...args} />;
};

export default Story;
