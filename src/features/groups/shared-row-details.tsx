import { useTranslations } from 'use-intl';

import { useLocale } from '@/lib/i18n';
import { countedCents } from '@core/counting';
import { formatAmount } from '@core/money';

import { useGroupWords } from './use-group-words';

import type { SharedExpenseRow } from '@core/shared-expense';
import type { SharedGroup } from '@core/shared-group';

interface SharedRowDetailsProps {
    row: SharedExpenseRow;
    group: SharedGroup;
}

// What a shared row of your expenses says beyond an expense of yours alone: the group, or the person for a friend, and
// who paid, with the total when it isn't your part
const SharedRowDetails = (props: SharedRowDetailsProps) => {
    const { row, group } = props;
    const t = useTranslations('expenses.list');
    const { locale } = useLocale();
    const words = useGroupWords(group);
    const { paidBy, totalCents } = row.shared;

    const total = totalCents === countedCents(row) ? null : formatAmount(totalCents, row.currency, locale);
    const name = words.nameOf(paidBy);
    const paid =
        paidBy === group.me
            ? total === null
                ? t('youPaid')
                : t('youPaidTotal', { total })
            : total === null
              ? t('paidBy', { name })
              : t('paidByTotal', { name, total });

    return (
        <>
            <span>{words.title}</span>
            <span>{paid}</span>
        </>
    );
};

export { SharedRowDetails, type SharedRowDetailsProps };
