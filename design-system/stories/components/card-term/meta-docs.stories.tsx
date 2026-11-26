import { CardList, CardTerm } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/CardTerm/Examples',
    component: CardTerm,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <CardList as="dl">
            <CardTerm term="Spent">€412.50</CardTerm>
        </CardList>
    );
};

export const Strong = () => {
    return (
        <CardList as="dl">
            <CardTerm term="Spent">€412.50</CardTerm>
            <CardTerm term="Left" strong>
                €87.50
            </CardTerm>
        </CardList>
    );
};

export default Story;
