import { Button } from '@/components/button/button';
import { Dialog as DialogComponent, type DialogProps } from '@/components/dialog/dialog';
import { useArgs } from 'storybook/preview-api';

import type { Meta } from '@storybook/react-vite';

interface DialogStoryProps extends Omit<DialogProps, 'children' | 'onClose'> {
    message: string;
    action: string;
    dismiss: string;
}

const Story: Meta<DialogStoryProps> = {
    title: 'Components/Dialog',
    args: {
        open: true,
        title: 'Delete your account?',
        variant: 'dialog',
        closeLabel: 'Close',
        message: "Your expenses, categories, income, budgets and nickname go for good. This can't be undone.",
        action: 'Delete',
        dismiss: 'Cancel',
    },
    argTypes: {
        title: { control: 'text' },
        variant: { control: 'inline-radio', options: ['dialog', 'sheet', 'page'] },
        closeLabel: { control: 'text' },
        message: { control: 'text' },
        action: { control: 'text' },
        dismiss: { control: 'text' },
    },
};

// The state is kept in the args, so the `open` control follows what is clicked
export const Dialog = (args: DialogStoryProps) => {
    const { message, action, dismiss, ...rest } = args;
    const [, updateArgs] = useArgs();
    const close = () => updateArgs({ open: false });
    const actions = (
        <>
            <Button ghost onClick={close}>
                {action}
            </Button>
            <Button ghost onClick={close}>
                {dismiss}
            </Button>
        </>
    );

    return (
        <>
            <Button onClick={() => updateArgs({ open: true })}>Open the dialog</Button>
            <DialogComponent
                {...rest}
                actions={rest.variant === 'page' ? undefined : actions}
                headAction={
                    rest.variant === 'page' ? (
                        <Button variant="primary" onClick={close}>
                            {action}
                        </Button>
                    ) : undefined
                }
                onClose={close}
            >
                <p>{message}</p>
            </DialogComponent>
        </>
    );
};

export default Story;
