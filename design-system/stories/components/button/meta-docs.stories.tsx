import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Button/Examples',
    component: Button,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return <Button>Save</Button>;
};

export const Primary = () => {
    return <Button variant="primary">Add</Button>;
};

export const Danger = () => {
    return <Button variant="danger">Delete account</Button>;
};

export const Ghost = () => {
    return (
        <Actions>
            <Button ghost>Edit</Button>
            <Button ghost>Duplicate</Button>
            <Button ghost variant="danger">
                Delete
            </Button>
        </Actions>
    );
};

export const Block = () => {
    return <Button block>Sign out</Button>;
};

export const Small = () => {
    return (
        <Button small>
            <Icon name="add" />
            Add expense
        </Button>
    );
};

export const Glyph = () => {
    return (
        <Actions>
            <Button ghost glyph aria-label="Search">
                <Icon name="search" />
            </Button>
            <Button ghost glyph aria-label="Filters, 2 on" badge="2">
                <Icon name="filter_list" />
            </Button>
        </Actions>
    );
};

export const Pressed = () => {
    return <Button pressed>Simplify debts</Button>;
};

export const Disabled = () => {
    return (
        <Actions>
            <Button disabled>Save</Button>
            <Button disabled variant="primary">
                Add
            </Button>
        </Actions>
    );
};

export default Story;
