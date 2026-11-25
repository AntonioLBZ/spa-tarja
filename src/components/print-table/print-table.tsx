import clsx from 'clsx';
import { useId } from 'react';

import type { ReactNode } from 'react';

import './print-table.css';

interface PrintTableProps {
    // What the table holds, in words: it names the box that scrolls and is printed above the table
    caption: string;
    // The head and the body of the table, with the classes of the cells below
    children: ReactNode;
    className?: string;
}

// A table made to be read and printed: on screen it scrolls sideways in a box the keyboard reaches when it is wider than
// the column; on paper it takes the width of the sheet and never cuts a row. Its cells take `print-table__number` for
// an amount, `print-table__end` for a heading over amounts and `print-table__date` for a day; a row of sums takes
// `print-table__sum`, and the last one `print-table__sum--last`, which rules it off.
const PrintTable = (props: PrintTableProps) => {
    const { caption, children, className } = props;
    const captionId = useId();
    const tableClsx = clsx('print-table', className);

    return (
        <div className={tableClsx} role="region" aria-labelledby={captionId} tabIndex={0}>
            <table className="print-table__table">
                <caption className="print-table__caption" id={captionId}>
                    {caption}
                </caption>
                {children}
            </table>
        </div>
    );
};

export { PrintTable, type PrintTableProps };
