import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { Bar } from '@/components/bar/bar';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useLocale } from '@/lib/i18n';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { CategoryStyle } from '@core/category-style';
import type { CategoryTotal } from '@core/charts';

import './category-breakdown.css';

interface CategoryBreakdownProps {
    totals: readonly CategoryTotal[];
    labelOf: (id: string) => string;
    styleOf: (id: string) => CategoryStyle;
}

// What each category took, with its icon and name (the color alone says nothing), its amount and its share of the
// total. The biggest comes first, and the ones that took the same go in the order of the names that are read.
function CategoryBreakdown(props: CategoryBreakdownProps) {
    const { totals, labelOf, styleOf } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    const percent = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
        [locale]
    );
    const all = totals.reduce((sum, item) => sum + item.totalCents, 0);
    const ordered = useMemo(
        () =>
            [...totals].sort(
                (a, b) =>
                    b.totalCents - a.totalCents || labelOf(a.categoryId).localeCompare(labelOf(b.categoryId), locale)
            ),
        [totals, labelOf, locale]
    );

    return (
        <ul className="category-breakdown" aria-label={t('byCategory')}>
            {ordered.map((item) => {
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
