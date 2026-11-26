import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';
import { Icon } from '@/components/icon/icon';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Components/Dialog/Examples',
    component: Dialog,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="danger" onClick={() => setOpen(true)}>
                Delete account
            </Button>
            <Dialog
                open={open}
                title="Delete your account?"
                actions={
                    <>
                        <Button ghost variant="danger" onClick={() => setOpen(false)}>
                            Delete account
                        </Button>
                        <Button ghost onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                    </>
                }
                onClose={() => setOpen(false)}
            >
                <p>Your expenses, categories, income, budgets and nickname go for good. This can&apos;t be undone.</p>
            </Dialog>
        </>
    );
};

export const Sheet = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>Settle up</Button>
            <Dialog
                open={open}
                variant="sheet"
                title="Settle up"
                closeLabel="Close"
                closeOnOutside={false}
                actions={
                    <Button block variant="primary" onClick={() => setOpen(false)}>
                        Save
                    </Button>
                }
                onClose={() => setOpen(false)}
            >
                <p>Ana pays you €21.50.</p>
            </Dialog>
        </>
    );
};

export const Page = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>Add expense</Button>
            <Dialog
                open={open}
                variant="page"
                title="Add expense"
                closeLabel="Back"
                closeOnOutside={false}
                headAction={
                    <Button ghost glyph aria-label="Add" onClick={() => setOpen(false)}>
                        <Icon name="check" />
                    </Button>
                }
                onClose={() => setOpen(false)}
            >
                <p>The fields of the form.</p>
            </Dialog>
        </>
    );
};

export default Story;
