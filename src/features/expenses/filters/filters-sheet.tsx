import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Dialog } from '@/components/dialog/dialog';

import { FilterStatus } from './filter-status';

import type { ReactNode } from 'react';

import './filters-sheet.css';

interface FiltersSheetProps {
    open: boolean;
    // Whether anything the sheet holds is in use, for Clear filters
    inUse: boolean;
    // Whether the search or any filter narrows the list, and how much of it is left
    filtering: boolean;
    shown: number;
    total: number;
    onClearFilters: () => void;
    onClose: () => void;
    children: ReactNode;
}

// The filters of a list in a sheet, applied as they change, with how much of the list they leave, since the list is
// behind it, and Clear filters and Close stuck to its foot (ADR-0024)
const FiltersSheet = (props: FiltersSheetProps) => {
    const { open, inUse, filtering, shown, total, onClearFilters, onClose, children } = props;
    const t = useTranslations('expenses.filters');

    return (
        <Dialog
            open={open}
            variant="sheet"
            title={t('title')}
            actions={
                <>
                    <Button ghost disabled={!inUse} onClick={onClearFilters}>
                        {t('clearFilters')}
                    </Button>
                    <Button ghost className="filters-sheet__close" onClick={onClose}>
                        {t('close')}
                    </Button>
                </>
            }
            onClose={onClose}
        >
            {children}
            <FilterStatus filtering={filtering} shown={shown} total={total} />
        </Dialog>
    );
};

export { FiltersSheet, type FiltersSheetProps };
