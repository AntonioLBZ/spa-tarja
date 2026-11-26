import { Card, CardList, CardTerm } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/CardList/Examples',
    component: CardList,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <CardList label="Budgets">
            <Card as="li">Groceries</Card>
            <Card as="li">Leisure</Card>
            <Card as="li">Bills</Card>
        </CardList>
    );
};

export const Flush = () => {
    return (
        <CardList flush>
            <Card as="li">Groceries</Card>
            <Card as="li">Leisure</Card>
            <Card as="li">Bills</Card>
        </CardList>
    );
};

export const Terms = () => {
    return (
        <CardList as="dl">
            <CardTerm term="Spent">€412.50</CardTerm>
            <CardTerm term="Income">€500.00</CardTerm>
        </CardList>
    );
};

export default Story;
