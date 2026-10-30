import { Card, CardList as CardListComponent, type CardListProps } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const ITEMS = [
    { name: 'Supermarket', amount: '42,30 €' },
    { name: 'Bakery', amount: '3,80 €' },
    { name: 'Market', amount: '18,00 €' },
];

const Story: Meta<CardListProps> = {
    title: 'Components/CardList',
    component: CardListComponent,
    args: { as: 'ul', flush: false, label: 'Groceries' },
    argTypes: {
        as: { control: 'inline-radio', options: ['ul', 'ol', 'dl'] },
        children: { control: false },
    },
};

export const CardList = (args: CardListProps) => {
    return (
        <CardListComponent {...args}>
            {ITEMS.map((item) =>
                args.as === 'dl' ? (
                    <Card key={item.name}>
                        <dt>{item.name}</dt>
                        <dd>{item.amount}</dd>
                    </Card>
                ) : (
                    <Card as="li" key={item.name}>
                        {item.name}
                    </Card>
                )
            )}
        </CardListComponent>
    );
};

export default Story;
