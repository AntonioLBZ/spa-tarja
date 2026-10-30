import { IncomeForm as IncomeFormComponent, type IncomeFormProps } from '@/features/summary/income-form';

import { AppData } from './app-data';

import type { Meta } from '@storybook/react-vite';

interface IncomeFormStoryProps extends Omit<IncomeFormProps, 'income'> {
    // Whether the month already has an income, of `amountCents`
    isSet: boolean;
    amountCents: number;
}

const Story: Meta<IncomeFormStoryProps> = {
    title: 'Features/IncomeForm',
    args: { month: '2026-10', monthName: 'October 2026', isSet: false, amountCents: 150000 },
    argTypes: { month: { control: 'text' }, monthName: { control: 'text' } },
};

export const IncomeForm = (args: IncomeFormStoryProps) => {
    const { month, monthName, isSet, amountCents } = args;
    const income = isSet ? [{ month, amountCents, currency: 'EUR' }] : [];

    return (
        <AppData key={`${month}:${isSet}:${amountCents}`} api={{ income }}>
            {() => <IncomeFormComponent month={month} monthName={monthName} income={income[0]} />}
        </AppData>
    );
};

export default Story;
