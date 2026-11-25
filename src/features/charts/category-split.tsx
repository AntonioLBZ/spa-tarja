import clsx from 'clsx';
import { useMemo, type CSSProperties } from 'react';
import { useTranslations } from 'use-intl';

import { Card, CardList } from '@/components/card/card';
import { Icon } from '@/components/icon/icon';
import { CategoryBadge } from '@/features/categories/category-badge';
import { useMoney } from '@/lib/amounts';
import { useLocale } from '@/lib/i18n';

import type { CategoryStyle } from '@core/category-style';
import type { CategoryTotal } from '@core/charts';

import './category-split.css';

interface CategorySplitProps {
    totals: readonly CategoryTotal[];
    labelOf: (id: string) => string;
    styleOf: (id: string) => CategoryStyle;
    // The category the chart is narrowed to, or null for all of them
    picked: string | null;
    // Picks a category, or null to go back to all of them
    onPick: (id: string | null) => void;
}

// What each category took: one strip cut into a segment per category in its color, and under it a row for each with
// its icon and name (the color alone says nothing), its amount and its share. The biggest comes first, and the ones
// that took the same go in the order of the names that are read. Pressing a row picks its category, and pressing it again
// lets go of it (ADR-0045). The picked one stays at the end, at zero, when it took nothing.
const CategorySplit = (props: CategorySplitProps) => {
    const { totals, labelOf, styleOf, picked, onPick } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();
    const money = useMoney();

    const percent = useMemo(
        () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
        [locale]
    );
    const segments = useMemo(() => {
        const all = totals.reduce((sum, item) => sum + item.totalCents, 0);
        const ordered = [...totals].sort(
            (a, b) => b.totalCents - a.totalCents || labelOf(a.categoryId).localeCompare(labelOf(b.categoryId), locale)
        );
        if (picked !== null && !ordered.some((item) => item.categoryId === picked)) {
            ordered.push({ categoryId: picked, totalCents: 0 });
        }
        // Each segment starts where the ones before it end
        return ordered.reduce<(CategoryTotal & { start: number; share: number })[]>((done, item) => {
            const last = done.at(-1);
            const share = all === 0 ? 0 : item.totalCents / all;
            done.push({ ...item, start: last ? last.start + last.share : 0, share });
            return done;
        }, []);
    }, [totals, picked, labelOf, locale]);
    const drawn = segments.filter((segment) => segment.share > 0);

    return (
        <div className="category-split">
            <div className="category-split__strip" aria-hidden="true">
                {drawn.map((segment) => {
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
                {drawn.slice(1).map((segment) => (
                    <span
                        className="category-split__gap"
                        key={segment.categoryId}
                        style={{ '--start': segment.start } as CSSProperties}
                    />
                ))}
            </div>
            <p className="hint">{t('pickHint')}</p>
            <CardList label={t('byCategory')}>
                {segments.map((segment) => {
                    const isPicked = segment.categoryId === picked;
                    const rowClsx = clsx('category-split__row', { 'category-split__row--picked': isPicked });

                    return (
                        <Card as="li" className={rowClsx} key={segment.categoryId}>
                            <button
                                aria-pressed={isPicked}
                                className="category-split__pick"
                                type="button"
                                onClick={() => onPick(isPicked ? null : segment.categoryId)}
                            >
                                <span className="category-split__name">
                                    <CategoryBadge style={styleOf(segment.categoryId)} />
                                    <span className="category-split__label">{labelOf(segment.categoryId)}</span>
                                </span>
                                <span className="category-split__amount">{money(segment.totalCents)}</span>
                                <span className="category-split__share">{percent.format(segment.share)}</span>
                                <span className="category-split__mark" aria-hidden="true">
                                    {isPicked && <Icon name="check" />}
                                </span>
                            </button>
                        </Card>
                    );
                })}
            </CardList>
        </div>
    );
};

export { CategorySplit, type CategorySplitProps };
