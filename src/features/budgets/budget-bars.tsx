import clsx from 'clsx';
import { useMemo, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { useLocale } from '@/lib/i18n';
import { TOTAL_SCOPE, budgetUses } from '@core/budget';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { useBudgets } from './use-budgets';

import './budget-bars.css';

// How much of each limit the month holds has been used: the total first, then the categories that have one. The words
// say it all, so the bar itself is only a picture of it.
function BudgetBars(props: { month: string }) {
    const { month } = props;
    const t = useTranslations('budgets');
    const { locale } = useLocale();
    const { expenses } = useExpenses();
    const { budgets, scopes, categoryOf } = useBudgets();
    const { labelOf, styleOf } = useCategoryOptions();

    const uses = useMemo(
        () => budgetUses({ month, expenses, budgets, scopes, categoryOf }),
        [month, expenses, budgets, scopes, categoryOf]
    );
    if (uses.length === 0) return null;

    const money = (cents: number) => formatAmount(cents, DEFAULT_CURRENCY, locale);

    return (
        <CardList label={t('title')}>
            {uses.map((use) => {
                const over = use.state === 'over';
                return (
                    <Card as="li" key={use.scope} className={clsx('budget-bar', over && 'budget-bar--over')}>
                        <div className="budget-bar__head">
                            <span className="budget-bar__name">
                                {use.scope === TOTAL_SCOPE ? (
                                    t('total')
                                ) : (
                                    <>
                                        <CategoryBadge style={styleOf(use.scope)} />
                                        {labelOf(use.scope)}
                                    </>
                                )}
                            </span>
                            <span className="budget-bar__percent">{use.percent} %</span>
                        </div>
                        <p className="budget-bar__amounts">
                            {t('bar.of', { spent: money(use.spentCents), limit: money(use.limitCents) })}
                            {over && ` · ${t('bar.over', { amount: money(use.spentCents - use.limitCents) })}`}
                        </p>
                        <div aria-hidden className="budget-bar__track">
                            <div
                                className="budget-bar__fill"
                                style={{ '--use': Math.min(use.percent, 100) / 100 } as CSSProperties}
                            />
                        </div>
                    </Card>
                );
            })}
        </CardList>
    );
}

export { BudgetBars };
