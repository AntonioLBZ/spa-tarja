import { Button } from '@/components/button/button';
import { ToastProvider, useToast } from '@/components/toast/toast';

import type { Meta, StoryObj } from '@storybook/react-vite';

function ShowButtons() {
    const toast = useToast();

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)' }}>
            <Button onClick={() => toast.show({ message: 'Expense saved' })}>Show a message</Button>
            <Button
                onClick={() =>
                    toast.show({
                        message: 'Expense deleted',
                        action: { label: 'Undo', onAction: () => toast.show({ message: 'Expense restored' }) },
                    })
                }
            >
                Show with an action
            </Button>
            <Button onClick={() => toast.dismiss()}>Dismiss</Button>
        </div>
    );
}

const meta = {
    title: 'Components/Toast',
    parameters: { layout: 'fullscreen' },
    render: () => (
        <ToastProvider>
            <div style={{ padding: 'var(--size-4)' }}>
                <ShowButtons />
            </div>
        </ToastProvider>
    ),
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
