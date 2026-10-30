import { Button } from '@/components/button/button';
import { ToastProvider, useToast } from '@/components/toast/toast';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface ToastStoryProps {
    message: string;
    actionLabel: string;
    onAction: () => void;
}

const ToastButtons = (props: ToastStoryProps) => {
    const { message, actionLabel, onAction } = props;
    const toast = useToast();
    const action = actionLabel ? { label: actionLabel, onAction } : undefined;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)' }}>
            <Button onClick={() => toast.show({ message, action })}>Show</Button>
            <Button onClick={() => toast.dismiss()}>Dismiss</Button>
        </div>
    );
};

const Story: Meta<ToastStoryProps> = {
    title: 'Components/Toast',
    args: { message: 'Expense deleted', actionLabel: 'Undo', onAction: fn() },
    argTypes: { message: { control: 'text' }, actionLabel: { control: 'text' } },
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
