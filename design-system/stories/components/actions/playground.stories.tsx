import { Actions } from '@/components/actions/actions';
import { Button } from '@/components/button/button';

import type { Meta } from '@storybook/react-vite';

interface ActionsStoryProps {
    count: number;
}

const WORDS = ['Edit', 'Duplicate', 'Move to a group', 'Delete'];

const Story: Meta<ActionsStoryProps> = {
    title: 'Components/Actions',
    args: { count: 3 },
    argTypes: { count: { control: { type: 'range', min: 1, max: WORDS.length, step: 1 } } },
};

export const Playground = (args: ActionsStoryProps) => {
    const { count } = args;

    return (
        <Actions>
            {WORDS.slice(0, count).map((word) => (
                <Button key={word} ghost variant={word === 'Delete' ? 'danger' : 'default'}>
                    {word}
                </Button>
            ))}
        </Actions>
    );
};

export default Story;
