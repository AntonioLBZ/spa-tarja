import { CardList, CardTerm as CardTermComponent, type CardTermProps } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<CardTermProps> = {
    title: 'Components/CardTerm',
    component: CardTermComponent,
    args: { term: 'Spent', children: '€ 412.50', strong: false },
    argTypes: { term: { control: 'text' }, children: { control: 'text' } },
};

// The first is the one the controls drive; under it the row that sums up the others
export const CardTerm = (args: CardTermProps) => {
    return (
        <CardList as="dl">
            <CardTermComponent {...args} />
            <CardTermComponent strong term="Left">
                € 87.50
            </CardTermComponent>
        </CardList>
    );
};

export default Story;
