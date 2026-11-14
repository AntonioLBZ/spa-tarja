import { ToastProvider } from '@/components/toast/toast';
import { ExpenseForm as ExpenseFormComponent, type ExpenseFormProps } from '@/features/expenses/expense-form';
import { fn } from 'storybook/test';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { GroupMember, SharedGroup } from '@core/shared-group';
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

// A trip with Bruno and Carla, and a friend, Dani, to share with
const GROUPS: SharedGroup[] = [
    {
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
    },
    {
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
    },
];

interface ExpenseFormStoryProps extends Omit<ExpenseFormProps, 'editing' | 'copying' | 'group'> {
    // Adds a new expense, or starts from a saved one to change it or to copy it
    mode: 'adding' | 'editing' | 'copying';
    // On the screen of a group, where the expense is shared there
    inGroup: boolean;
}

const Story: Meta<ExpenseFormStoryProps> = {
    title: 'Features/ExpenseForm',
    args: { title: 'Add an expense', mode: 'adding', inGroup: false, onDone: fn(), onAdded: fn() },
    argTypes: {
        title: { control: 'text' },
        mode: { control: 'inline-radio', options: ['adding', 'editing', 'copying'] },
        inGroup: { control: 'boolean' },
        onDone: { control: false },
        onAdded: { control: false },
    },
};

export const ExpenseForm = (args: ExpenseFormStoryProps) => {
    const { mode, inGroup, ...props } = args;

    return (
        <ToastProvider dismissLabel="Dismiss">
            <AppData
                key={`${mode}-${inGroup}`}
                api={{ categories: [...CUSTOM_CATEGORIES], expenses: [SAVED], groups: GROUPS }}
            >
                {() => (
                    <ExpenseFormComponent
                        {...props}
                        group={inGroup ? GROUPS[0] : undefined}
                        editing={mode === 'editing' ? [SAVED] : undefined}
                        copying={mode === 'copying' ? [SAVED] : undefined}
                    />
                )}
            </AppData>
        </ToastProvider>
    );
};

export default Story;
