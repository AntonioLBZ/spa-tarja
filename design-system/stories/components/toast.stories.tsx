import { Button } from '@/components/button/button';
import { ToastProvider, useToast } from '@/components/toast/toast';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface ToastStoryProps {
    message: string;
    actionLabel: string;
    // The message of the toast that stays until it is answered
    pinnedMessage: string;
    onAction: () => void;
}

const ToastButtons = (props: ToastStoryProps) => {
    const { message, actionLabel, pinnedMessage, onAction } = props;
    const toast = useToast();
    const action = actionLabel ? { label: actionLabel, onAction } : undefined;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)' }}>
            <Button onClick={() => toast.show({ message, action })}>Show</Button>
            <Button onClick={() => toast.dismiss()}>Dismiss</Button>
            <Button
                onClick={() =>
                    toast.pin({
                        message: pinnedMessage,
                        actions: [
                            { label: 'Update', onAction },
                            { label: 'Later', onAction },
                        ],
                    })
                }
            >
                Pin
            </Button>
            <Button onClick={() => toast.unpin()}>Unpin</Button>
        </div>
    );
};

const Story: Meta<ToastStoryProps> = {
    title: 'Components/Toast',
    args: {
        message: 'Expense deleted',
        actionLabel: 'Undo',
        pinnedMessage: 'A new version is ready',
        onAction: fn(),
    },
    argTypes: { message: { control: 'text' }, actionLabel: { control: 'text' }, pinnedMessage: { control: 'text' } },
    parameters: { layout: 'fullscreen' },
};

export const Toast = (args: ToastStoryProps) => {
    return (
        <ToastProvider>
            <div style={{ padding: 'var(--size-4)' }}>
                <ToastButtons {...args} />
            </div>
        </ToastProvider>
    );
};

export default Story;
