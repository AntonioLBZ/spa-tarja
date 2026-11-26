import { Button } from '@/components/button/button';
import { ToastProvider } from '@/components/toast/toast';
import { ExpenseForm } from '@/features/expenses/form/expense-form';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { GroupMember, SharedGroup } from '@core/groups/shared-group';
import type { Meta } from '@storybook/react-vite';

const SAVED = sampleExpense('55555555-5555-4555-8555-555555555551', '2026-10-27', {
    categoryId: 'groceries',
    text: 'Supermarket',
    amountCents: 4380,
});

const member = (id: string, name: string, rest: Partial<GroupMember> = {}): GroupMember => ({
    id,
    name,
    role: 'member',
    claimed: true,
    leftAt: null,
    mergedInto: null,
    ...rest,
});

const MARTA = '66666666-6666-4666-8666-666666666661';

const LISBON: SharedGroup = {
    id: '77777777-7777-4777-8777-777777777771',
    kind: 'group',
    name: 'Lisbon',
    currency: 'EUR',
    simplifyDebts: false,
    closed: null,
    archived: false,
    me: MARTA,
    showInExpenses: true,
    pinnedAt: null,
    seq: 0,
    members: [
        member(MARTA, 'Marta', { role: 'owner' }),
        member('66666666-6666-4666-8666-666666666662', 'Bruno'),
        member('66666666-6666-4666-8666-666666666663', 'Carla'),
    ],
};

const DANI: SharedGroup = {
    id: '77777777-7777-4777-8777-777777777772',
    kind: 'direct',
    name: null,
    currency: 'EUR',
    simplifyDebts: false,
    closed: null,
    archived: false,
    me: '66666666-6666-4666-8666-666666666664',
    showInExpenses: true,
    pinnedAt: null,
    seq: 0,
    members: [
        member('66666666-6666-4666-8666-666666666664', 'Marta', { role: 'owner' }),
        member('66666666-6666-4666-8666-666666666665', 'Dani', { claimed: false }),
    ],
};

const Story: Meta = {
    title: 'Features/ExpenseForm',
    component: ExpenseForm,
    tags: ['!dev'],
    decorators: [
        (Story) => (
            <ToastProvider dismissLabel="Dismiss">
                <Story />
            </ToastProvider>
        ),
        withAppData,
    ],
    parameters: {
        docs: { source: { type: 'code' }, story: { inline: false, iframeHeight: 560 } },
        appData: { categories: [...CUSTOM_CATEGORIES], expenses: [SAVED], groups: [LISBON, DANI] },
    },
};

export const Basic = () => {
    return (
        <>
            <ExpenseForm id="add-expense" title="Add expense" />
            <Button block variant="primary" form="add-expense" type="submit">
                Add
            </Button>
        </>
    );
};

export const Editing = () => {
    return (
        <>
            <ExpenseForm id="edit-expense" title="Edit expense" editing={[SAVED]} onDone={() => undefined} />
            <Button block variant="primary" form="edit-expense" type="submit">
                Save
            </Button>
        </>
    );
};

export const Copying = () => {
    return (
        <>
            <ExpenseForm id="copy-expense" title="Duplicate" copying={[SAVED]} onDone={() => undefined} />
            <Button block variant="primary" form="copy-expense" type="submit">
                Add
            </Button>
        </>
    );
};

export const InAGroup = () => {
    return (
        <>
            <ExpenseForm id="group-expense" title="Add expense" group={LISBON} />
            <Button block variant="primary" form="group-expense" type="submit">
                Add
            </Button>
        </>
    );
};

export const StartsShared = () => {
    return (
        <>
            <ExpenseForm id="shared-expense" title="Add expense" startGroup={DANI} />
            <Button block variant="primary" form="shared-expense" type="submit">
                Add
            </Button>
        </>
    );
};

export default Story;
