import { CardList, CardTerm } from '@/components/card/card';
import { StoryNarrow } from '@stories/shared/layout';

import type { Meta } from '@storybook/react-vite';

interface CardTermStoryProps {
    term: string;
    children: string;
    strong: boolean;
}

const Story: Meta<CardTermStoryProps> = {
    title: 'Components/CardTerm',
    args: { term: 'Spent', children: '€412.50', strong: false },
    argTypes: { term: { control: 'text' }, children: { control: 'text' } },
};

export const Playground = (args: CardTermStoryProps) => {
    const { children, ...props } = args;

    return (
        <StoryNarrow>
            <CardList as="dl">
                <CardTerm {...props}>{children}</CardTerm>
            </CardList>
        </StoryNarrow>
    );
};

export default Story;
