import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { ExpenseItemBody } from '@/features/expenses/list/expense-item-body';
import { useMoney } from '@/lib/amounts';
import { countedOn } from '@core/expenses/counting';
import { isSharedRow } from '@core/groups/shared-expense';

import { useBucketNames } from './use-bucket-names';

import type { SharedRowSource } from '@/features/groups/share/use-shared-expense-rows';
import type { CountedGroup, Granularity } from '@core/reports/charts';

import './counted-expenses.css';

// Rows drawn at first and added by each Show more
const PAGE = 100;

interface CountedExpensesProps {
    groups: readonly CountedGroup[];
    granularity: Granularity;
    pendingIds: ReadonlySet<string>;
    sourceOf: (rowId: string) => SharedRowSource | undefined;
}

// What the chart counts, expense by expense, on a ticket for each of its rows that has any, the total of each ticket
// being its column (ADR-0043). The rows only read: what is done to an expense is done in the list.
const CountedExpenses = (props: CountedExpensesProps) => {
    const { groups, granularity, pendingIds, sourceOf } = props;
    const t = useTranslations('charts');
    const money = useMoney();
    const { nameOf } = useBucketNames(groups, granularity);
    const [limit, setLimit] = useState(PAGE);
    const firstNew = useRef<string | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());

    // Each group keeps its whole total while its rows are cut at the limit
    const shown = useMemo(() => {
        let left = limit;
        const cut: CountedGroup[] = [];
        for (const group of groups) {
            if (left === 0) break;
            cut.push({ ...group, expenses: group.expenses.slice(0, left) });
            left -= Math.min(left, group.expenses.length);
        }
        return cut;
    }, [groups, limit]);
    const count = groups.reduce((sum, group) => sum + group.expenses.length, 0);

    // The first row that Show more brings in takes the focus, also when the button is gone
    useEffect(() => {
        if (firstNew.current === null) return;
        rowRefs.current.get(firstNew.current)?.focus();
        firstNew.current = null;
    }, [shown]);

    const showMore = () => {
        firstNew.current = groups.flatMap((group) => group.expenses)[limit]?.id ?? null;
        setLimit(limit + PAGE);
    };

    return (
        <section className="counted-expenses">
            <h2>{t('expensesTitle')}</h2>
            {shown.map((group) => (
                <Sheet key={group.start} label={nameOf(group.start)} level="h3">
                    <CardList flush>
                        {group.expenses.map((expense) => {
                            const source = isSharedRow(expense) ? sourceOf(expense.id) : undefined;
                            return (
                                <li
                                    key={expense.id}
                                    ref={(node) => {
                                        if (node) rowRefs.current.set(expense.id, node);
                                        return () => {
                                            rowRefs.current.delete(expense.id);
                                        };
                                    }}
                                    className="expense-item"
                                    tabIndex={-1}
                                >
                                    <ExpenseItemBody
                                        expenses={[expense]}
                                        isPlan={false}
                                        pending={pendingIds.has(expense.id)}
                                        showDate={granularity !== 'day' || countedOn(expense) !== expense.date}
                                        shared={
                                            source && isSharedRow(expense)
                                                ? { row: expense, group: source.group }
                                                : undefined
                                        }
                                    />
                                </li>
                            );
                        })}
                    </CardList>
                    <p className="counted-expenses__total">
                        <span className="counted-expenses__total-label">{t('total')}</span>{' '}
                        <span className="counted-expenses__subtotal">{money(group.totalCents)}</span>
                    </p>
                </Sheet>
            ))}
            {count > limit && (
                <Button className="counted-expenses__more" onClick={showMore}>
                    {t('showMore')}
                </Button>
            )}
        </section>
    );
};

export { CountedExpenses, type CountedExpensesProps };
