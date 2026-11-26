import { Actions } from '@/components/actions/actions';
import { Amount } from '@/components/amount/amount';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Amount/Examples',
    component: Amount,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <Actions>
            <Amount text="€21.50" direction="in" color sign />
            <Amount text="€8.00" direction="out" color sign />
        </Actions>
    );
};

export const Arrow = () => {
    return (
        <Actions>
            <Amount text="€21.50" direction="in" color sign arrow />
            <Amount text="€8.00" direction="out" color sign arrow />
        </Actions>
    );
};

export const ColorAlone = () => {
    return (
        <p>
            You are owed <Amount text="€21.50" direction="in" color />
        </p>
    );
};

export const Neutral = () => {
    return <Amount text="€30.00" />;
};

export const ColorBlind = () => {
    return (
        <Actions>
            <span data-money-palette="color-blind">
                <Amount text="€21.50" direction="in" color sign />
            </span>
            <span data-money-palette="color-blind">
                <Amount text="€8.00" direction="out" color sign />
            </span>
        </Actions>
    );
};

export default Story;
