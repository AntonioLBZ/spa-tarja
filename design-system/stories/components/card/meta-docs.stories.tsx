import { Card } from '@/components/card/card';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Card/Examples',
    component: Card,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <Card>Supermarket</Card>;
};

export const Linked = () => {
    return (
        <Card linked>
            <a href="#appearance">Appearance</a>
        </Card>
    );
};

export default Story;
