import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Bar } from '@/components/bar/bar';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useLocale } from '@/lib/i18n';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { CategoryTotal } from '@core/charts';

import './category-breakdown.css';

// What each category took, with its icon and name (the color alone says nothing), its amount and its share of the total
function CategoryBreakdown(props: { totals: readonly CategoryTotal[] }) {
    const { totals } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();
    const { labelOf, styleOf } = useCategoryOptions();

    const percent = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
        [locale]
    );
    const all = totals.reduce((sum, item) => sum + item.totalCents, 0);

    return (
        <ul className="category-breakdown" aria-label={t('byCategory')}>
            {totals.map((item) => {
                const share = item.totalCents / all;
                return (
                    <li className="category-breakdown__row" key={item.categoryId}>
                        <span className="category-breakdown__name">
                            <CategoryBadge style={styleOf(item.categoryId)} />
                            <span>{labelOf(item.categoryId)}</span>
                        </span>
                        <span className="category-breakdown__amount">
                            {formatAmount(item.totalCents, DEFAULT_CURRENCY, locale)}
                        </span>
                        <span className="category-breakdown__share">{percent.format(share)}</span>
                        <Bar share={share} />
                    </li>
                );
            })}
        </ul>
    );
}

export { CategoryBreakdown };
