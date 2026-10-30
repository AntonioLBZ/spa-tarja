import clsx from 'clsx';
import { useMemo, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useLocale } from '@/lib/i18n';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import type { CategoryStyle } from '@core/category-style';
import type { CategoryTotal } from '@core/charts';

import './category-split.css';

interface CategorySplitProps {
    totals: readonly CategoryTotal[];
    labelOf: (id: string) => string;
    styleOf: (id: string) => CategoryStyle;
}

// What each category took: one strip cut into a segment per category in its color, and under it a row for each with
// its icon and name (the color alone says nothing), its amount and its share. The biggest comes first, and the ones
// that took the same go in the order of the names that are read. Every total is above zero.
const CategorySplit = (props: CategorySplitProps) => {
    const { totals, labelOf, styleOf } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();

    const percent = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
        [locale]
    );
    const segments = useMemo(() => {
        const all = totals.reduce((sum, item) => sum + item.totalCents, 0);
        const ordered = [...totals].sort(
            (a, b) => b.totalCents - a.totalCents || labelOf(a.categoryId).localeCompare(labelOf(b.categoryId), locale)
        );
        // Each segment starts where the ones before it end
        return ordered.reduce<(CategoryTotal & { start: number; share: number })[]>((done, item) => {
            const last = done.at(-1);
            const share = item.totalCents / all;
            done.push({ ...item, start: last ? last.start + last.share : 0, share });
            return done;
        }, []);
    }, [totals, labelOf, locale]);

    return (
        <div className="category-split">
            <div className="category-split__strip" aria-hidden="true">
                {segments.map((segment) => {
                    const segmentClsx = clsx(
                        'category-split__segment',
                        `category-split__segment--${styleOf(segment.categoryId).color}`
                    );

                    return (
                        <span
                            className={segmentClsx}
                            key={segment.categoryId}
                            style={{ '--start': segment.start, '--share': segment.share } as CSSProperties}
                        />
                    );
                })}
                {segments.slice(1).map((segment) => (
                    <span
                        className="category-split__gap"
                        key={segment.categoryId}
                        style={{ '--start': segment.start } as CSSProperties}
                    />
                ))}
            </div>
            <CardList label={t('byCategory')}>
                {segments.map((segment) => (
                    <Card as="li" className="category-split__row" key={segment.categoryId}>
                        <span className="category-split__name">
                            <CategoryBadge style={styleOf(segment.categoryId)} />
                            <span>{labelOf(segment.categoryId)}</span>
                        </span>
                        <span className="category-split__amount">
                            {formatAmount(segment.totalCents, DEFAULT_CURRENCY, locale)}
                        </span>
                        <span className="category-split__share">{percent.format(segment.share)}</span>
                    </Card>
                ))}
            </CardList>
        </div>
    );
};

export { CategorySplit, type CategorySplitProps };
