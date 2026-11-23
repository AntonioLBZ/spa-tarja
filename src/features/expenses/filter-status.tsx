import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { Notice } from '@/components/notice/notice';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import './filter-status.css';

interface FilterStatusProps {
    // Whether the search or any filter narrows the list
    filtering: boolean;
    // The rows that pass, and all of them
    shown: number;
    total: number;
    // Drops the search and every filter; without it the line has no Clear
    onClear?: () => void;
}

// How much of a list the search and the filters leave, while they narrow it. Its live region is always in the page, so
// the first count is announced too, and the count, which changes with every key, is read out once the typing pauses.
const FilterStatus = (props: FilterStatusProps) => {
    const { filtering, shown, total, onClear } = props;
    const t = useTranslations('expenses.filters');
    const tList = useTranslations('expenses.list');
    const status = shown === 0 ? tList('noMatch') : t('showing', { shown, total });
    const settled = useDebouncedValue(filtering ? status : '');
    const spoken = filtering ? settled : '';
    const statusClsx = clsx('filter-status', { 'filter-status--bare': !onClear, 'filter-status--idle': !filtering });

    return (
        <div className={statusClsx}>
            <div>
                <div className="visually-hidden" role="status">
                    {spoken}
                </div>
                <div aria-hidden="true">{filtering && <Notice tone="quiet">{status}</Notice>}</div>
            </div>
            {filtering && onClear && (
                <Button ghost onClick={onClear}>
                    {t('clear')}
                </Button>
            )}
        </div>
    );
};

export { FilterStatus, type FilterStatusProps };
