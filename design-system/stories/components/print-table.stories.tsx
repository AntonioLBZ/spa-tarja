import { PrintTable as PrintTableComponent, type PrintTableProps } from '@/components/print-table/print-table';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<PrintTableProps> = {
    title: 'Components/PrintTable',
    component: PrintTableComponent,
    args: { caption: 'Nov 1, 2026 to Nov 30, 2026' },
    argTypes: { children: { control: false }, className: { control: false } },
};

// A month of expenses with their total; narrow the frame to see it scroll sideways
export const PrintTable = (args: PrintTableProps) => {
    return (
        <PrintTableComponent {...args}>
            <thead>
                <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Expense</th>
                    <th scope="col">Category</th>
                    <th className="print-table__end" scope="col">
                        Amount
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="print-table__date">Nov 2, 2026</td>
                    <th scope="row">Groceries</th>
                    <td>Groceries</td>
                    <td className="print-table__number">€45.30</td>
                </tr>
                <tr>
                    <td className="print-table__date">Nov 5, 2026</td>
                    <th scope="row">Dinner</th>
                    <td>Food</td>
                    <td className="print-table__number">€20.00</td>
                </tr>
                <tr className="print-table__sum print-table__sum--last">
                    <th scope="row" colSpan={3}>
                        Total
                    </th>
                    <td className="print-table__number">€65.30</td>
                </tr>
            </tbody>
        </PrintTableComponent>
    );
};

export default Story;
