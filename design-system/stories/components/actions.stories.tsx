import { Actions as ActionsComponent, type ActionsProps } from '@/components/actions/actions';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<ActionsProps> = {
    title: 'Components/Actions',
    component: ActionsComponent,
    argTypes: { children: { control: false }, className: { control: false } },
};

// The actions under an open expense; narrow the frame to see them wrap
export const Actions = (args: ActionsProps) => {
    return (
        <ActionsComponent {...args}>
            <Button ghost>Edit</Button>
            <Button ghost>Duplicate</Button>
            <Button ghost variant="danger">
                Delete
            </Button>
        </ActionsComponent>
    );
};

export default Story;
