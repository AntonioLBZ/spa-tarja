import { Button } from '@/components/button/button';
import { ToastProvider, useToast } from '@/components/toast/toast';
import { StoryRow } from '@stories/shared/layout';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface ToastStoryProps {
    message: string;
    /** The mark of something done in front of the message */
    check: boolean;
    /** The words of its action; empty for none */
    actionLabel: string;
    /** Stays until it is answered, with two answers and no count */
    pinned: boolean;
    onAction: () => void;
}

const Buttons = (props: ToastStoryProps) => {
    const { message, check, actionLabel, pinned, onAction } = props;
    const toast = useToast();
    const show = () => {
        if (pinned) {
            toast.pin({
                message,
                actions: [
                    { label: 'Update', onAction },
                    { label: 'Later', onAction },
                ],
                onSwipeAway: onAction,
            });
            return;
        }
        toast.show({
            message,
            icon: check ? 'check' : undefined,
            action: actionLabel ? { label: actionLabel, onAction } : undefined,
        });
    };

    return (
        <StoryRow>
            <Button onClick={show}>Show</Button>
            <Button onClick={() => (pinned ? toast.unpin() : toast.dismiss())}>Take it away</Button>
        </StoryRow>
    );
};

const Story: Meta<ToastStoryProps> = {
    title: 'Components/Toast',
    args: { message: 'Expense deleted', check: false, actionLabel: 'Undo', pinned: false, onAction: fn() },
    argTypes: {
        message: { control: 'text' },
        check: { if: { arg: 'pinned', truthy: false } },
        actionLabel: { control: 'text', if: { arg: 'pinned', truthy: false } },
        onAction: { table: { disable: true } },
    },
};

export const Playground = (args: ToastStoryProps) => {
    return (
        <ToastProvider dismissLabel="Dismiss">
            <Buttons {...args} />
        </ToastProvider>
    );
};

export default Story;
