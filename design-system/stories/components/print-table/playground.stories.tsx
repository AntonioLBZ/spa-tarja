import { PrintTable } from '@/components/print-table/print-table';

import type { Meta } from '@storybook/react-vite';

interface PrintTableStoryProps {
    caption: string;
}

const Story: Meta<PrintTableStoryProps> = {
    title: 'Components/PrintTable',
    args: { caption: 'Nov 1, 2026 to Nov 30, 2026' },
    argTypes: { caption: { control: 'text' } },
};

export const Playground = (args: PrintTableStoryProps) => {
    return (
        <PrintTable caption={args.caption}>
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
        </PrintTable>
    );
};

export default Story;
