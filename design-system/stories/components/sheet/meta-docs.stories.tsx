import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { Sheet } from '@/components/sheet/sheet';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Sheet/Examples',
    component: Sheet,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <Sheet label="Your categories">
            <p className="story-flush">Gym</p>
        </Sheet>
    );
};

export const NoLabel = () => {
    return (
        <Sheet>
            <p className="story-flush">Dinner</p>
        </Sheet>
    );
};

export const Action = () => {
    return (
        <Sheet
            label="Balances"
            action={
                <Button ghost small>
                    <Icon name="payments" />
                    Settle up
                </Button>
            }
        >
            <p className="story-flush">You owe Ana €21.50</p>
        </Sheet>
    );
};

export default Story;
