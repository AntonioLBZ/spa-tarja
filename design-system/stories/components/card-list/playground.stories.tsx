import { Card, CardList, CardTerm } from '@/components/card/card';
import { StoryNarrow } from '@stories/shared/layout';

import type { Meta } from '@storybook/react-vite';

interface CardListStoryProps {
    as: 'ul' | 'ol' | 'dl';
    flush: boolean;
    /** Empty for none */
    label: string;
}

const ITEMS = [
    { name: 'Supermarket', amount: '€42.30' },
    { name: 'Bakery', amount: '€3.80' },
    { name: 'Market', amount: '€18.00' },
];

const Story: Meta<CardListStoryProps> = {
    title: 'Components/CardList',
    args: { as: 'ul', flush: false, label: 'Groceries' },
    argTypes: {
        as: { control: 'inline-radio', options: ['ul', 'ol', 'dl'] },
        label: { control: 'text' },
    },
};

export const Playground = (args: CardListStoryProps) => {
    const { as, flush, label } = args;

    return (
        <StoryNarrow>
            <CardList as={as} flush={flush} label={label || undefined}>
                {ITEMS.map((item) =>
                    as === 'dl' ? (
                        <CardTerm key={item.name} term={item.name}>
                            {item.amount}
                        </CardTerm>
                    ) : (
                        <Card as="li" key={item.name}>
                            {item.name}
                        </Card>
                    )
                )}
            </CardList>
        </StoryNarrow>
    );
};

export default Story;
