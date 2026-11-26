import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Icon } from '@/components/icon/icon';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface DialogStoryProps {
    open: boolean;
    title: string;
    variant: 'dialog' | 'sheet' | 'page';
    /** Names the close button (the back chevron of a page); empty for none */
    closeLabel: string;
    message: string;
    /** The actions at its foot, or the check at the end of the title row of a page */
    withActions: boolean;
    dismissible: boolean;
    closeOnOutside: boolean;
    onClose: () => void;
}

const Story: Meta<DialogStoryProps> = {
    title: 'Components/Dialog',
    args: {
        open: true,
        title: 'Delete your account?',
        variant: 'dialog',
        closeLabel: 'Close',
        message: "Your expenses, categories, income, budgets and nickname go for good. This can't be undone.",
        withActions: true,
        dismissible: true,
        closeOnOutside: true,
        onClose: fn(),
    },
    argTypes: {
        title: { control: 'text' },
        variant: { control: 'inline-radio', options: ['dialog', 'sheet', 'page'] },
        closeLabel: { control: 'text' },
        message: { control: 'text' },
        onClose: { table: { disable: true } },
    },
};

export const Playground = (args: DialogStoryProps) => {
    const { message, withActions, closeLabel, variant, onClose, ...props } = args;
    const [, updateArgs] = useArgs();
    const isPage = variant === 'page';
    const close = () => {
        onClose();
        updateArgs({ open: false });
    };

    return (
        <>
            <Button onClick={() => updateArgs({ open: true })}>Open</Button>
            <Dialog
                {...props}
                variant={variant}
                closeLabel={closeLabel || undefined}
                actions={
                    withActions && !isPage ? (
                        <>
                            <Button ghost variant="danger" onClick={close}>
                                Delete
                            </Button>
                            <Button ghost onClick={close}>
                                Cancel
                            </Button>
                        </>
                    ) : undefined
                }
                headAction={
                    withActions && isPage ? (
                        <Button ghost glyph aria-label="Save" onClick={close}>
                            <Icon name="check" />
                        </Button>
                    ) : undefined
                }
                onClose={close}
            >
                <p>{message}</p>
            </Dialog>
        </>
    );
};

export default Story;
