import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Actions/Examples',
    component: Actions,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <Actions>
            <Button ghost>Edit</Button>
            <Button ghost>Duplicate</Button>
        </Actions>
    );
};

export const Links = () => {
    return (
        <Actions>
            <a href="#budgets">Budgets</a>
            <a href="#charts">Charts</a>
        </Actions>
    );
};

export default Story;
