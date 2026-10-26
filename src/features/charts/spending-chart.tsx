import clsx from 'clsx';
import {
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import { useTranslations } from 'use-intl';

import { Disclosure } from '@/components/disclosure/disclosure';
import { useLocale } from '@/lib/i18n';
import { bucketStart, niceScale } from '@core/charts';
import { DEFAULT_CURRENCY, formatAmount } from '@core/money';

import { useBucketNames } from './use-bucket-names';

import type { Bucket, Granularity } from '@core/charts';

import './spending-chart.css';

// The plot in user units, one per CSS pixel at the default font size: room above it for the cap of the biggest column,
// then the columns themselves. The stylesheet sizes the box to match (`--size-2` and `--plot`).
const HEADROOM = 8;
const PLOT = 160;
const CAP = 3;
const CAP_GAP = 2;

// Up to this many columns stand a quarter of their slot apart; more touch and read as a silhouette
const GAPPED_UP_TO = 60;
const GAP = 0.25;

interface SpendingChartProps {
    buckets: readonly Bucket[];
    granularity: Granularity;
    today: string;
    // The name of the category the buckets are narrowed to, if any
    category: string | null;
}

// Spending over time: a column for each bucket on a round scale, the biggest and today's marked by shape, a readout of
// the column picked by tap or by the arrows, and the numbers in a table for whoever can't see the columns
function SpendingChart(props: SpendingChartProps) {
    const { buckets, granularity, today, category } = props;
    const t = useTranslations('charts');
    const { locale } = useLocale();
    const readoutId = useId();
    const { nameOf, shortNameOf } = useBucketNames(buckets, granularity);
    const scroller = useRef<HTMLDivElement>(null);
    // The row picked, by the grouping it was picked in: a week and a day can start on the same date
    const [selected, setSelected] = useState<{ granularity: Granularity; start: string } | null>(null);

    const count = buckets.length;
    const index =
        selected === null || selected.granularity !== granularity
            ? -1
            : buckets.findIndex((bucket) => bucket.start === selected.start);
    // A row that left the range or the grouping lets go of the selection, so it doesn't come back with the row
    if (selected !== null && index < 0) setSelected(null);
    const select = (at: number) => setSelected({ granularity, start: buckets[at]!.start });

    const total = buckets.reduce((sum, bucket) => sum + bucket.totalCents, 0);
    const peak = buckets.reduce(
        (best, bucket, at) => (bucket.totalCents > (buckets[best]?.totalCents ?? 0) ? at : best),
        -1
    );
    const biggest = buckets[peak]?.totalCents ?? 0;
    const scale = niceScale(biggest);
    const todayAt = buckets.findIndex((bucket) => bucket.start === bucketStart(today, granularity));
    const gap = count <= GAPPED_UP_TO ? GAP : 0;
    // The first and the last row, named under the plot
    const ends = count > 1 ? [buckets[0]!, buckets[count - 1]!] : buckets;

    const money = (cents: number) => formatAmount(cents, DEFAULT_CURRENCY, locale);
    const wholeEuros = scale.step % 100 === 0;
    const tickFormat = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: DEFAULT_CURRENCY,
                ...(wholeEuros && { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            }),
        [locale, wholeEuros]
    );

    const span = t('chartSpan', { granularity, count });
    const summary =
        peak < 0
            ? t('chartSummaryEmpty', { span })
            : t('chartSummary', {
                  span,
                  total: money(total),
                  biggest: money(biggest),
                  label: nameOf(buckets[peak]!.start),
              });

    const current = buckets[index];
    const readout =
        current === undefined
            ? t('readoutHint')
            : category === null
              ? t('readout', { label: nameOf(current.start), amount: money(current.totalCents) })
              : t('readoutCategory', { label: nameOf(current.start), category, amount: money(current.totalCents) });

    // A column picked out of view, in a chart wider than its box, is scrolled into it
    useEffect(() => {
        const box = scroller.current;
        if (!box || index < 0 || box.scrollWidth <= box.clientWidth) return;
        const slot = box.scrollWidth / count;
        const left = index * slot;
        if (left < box.scrollLeft) box.scrollLeft = left;
        else if (left + slot > box.scrollLeft + box.clientWidth) box.scrollLeft = left + slot - box.clientWidth;
    }, [index, count]);

    function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
        // Alt with an arrow is the browser's back and forward
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const last = count - 1;
        const moves: Partial<Record<string, number>> = {
            ArrowRight: index < 0 ? 0 : Math.min(index + 1, last),
            ArrowLeft: index < 0 ? last : Math.max(index - 1, 0),
            Home: 0,
            End: last,
        };
        const next = moves[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next);
    }

    function handleClick(event: MouseEvent<SVGSVGElement>) {
        const slot = (event.target as Element).closest('[data-index]');
        if (slot) select(Number(slot.getAttribute('data-index')));
    }

    const top = (share: number) => HEADROOM + PLOT * (1 - share);

    return (
        <div className="spending-chart">
            <div className="spending-chart__frame">
                <div className="spending-chart__ticks" aria-hidden="true">
                    {scale.ticks.map((tick) => (
                        <span
                            className="spending-chart__tick"
                            key={tick}
                            style={{ '--at': tick / scale.max } as CSSProperties}
                        >
                            {tickFormat.format(tick / 100)}
                        </span>
                    ))}
                </div>
                <div className="spending-chart__scroller" ref={scroller}>
                    <svg
                        className="spending-chart__plot"
                        role="img"
                        aria-label={summary}
                        aria-describedby={readoutId}
                        tabIndex={0}
                        viewBox={`0 0 ${count} ${HEADROOM + PLOT}`}
                        preserveAspectRatio="none"
                        style={{ '--columns': count } as CSSProperties}
                        onClick={handleClick}
                        onKeyDown={handleKeyDown}
                    >
                        {buckets.map((bucket, at) => (
                            <rect
                                className={clsx(
                                    'spending-chart__slot',
                                    at === index && 'spending-chart__slot--selected'
                                )}
                                key={bucket.start}
                                data-index={at}
                                x={at}
                                y={0}
                                width={1}
                                height={HEADROOM + PLOT}
                            />
                        ))}
                        {scale.ticks.slice(1).map((tick) => (
                            <line
                                className="spending-chart__grid"
                                key={tick}
                                x1={0}
                                x2={count}
                                y1={top(tick / scale.max)}
                                y2={top(tick / scale.max)}
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                        {buckets.map((bucket, at) => (
                            <rect
                                className={clsx(
                                    'spending-chart__column',
                                    bucket.totalCents > 0 && 'spending-chart__column--spent',
                                    at === index && 'spending-chart__column--selected'
                                )}
                                key={bucket.start}
                                x={at + gap / 2}
                                y={HEADROOM}
                                width={1 - gap}
                                height={PLOT}
                                style={{ '--share': bucket.totalCents / scale.max } as CSSProperties}
                            />
                        ))}
                        {todayAt >= 0 && (
                            <rect
                                className="spending-chart__today"
                                x={todayAt}
                                y={HEADROOM}
                                width={1}
                                height={PLOT}
                                vectorEffect="non-scaling-stroke"
                            />
                        )}
                        {peak >= 0 && (
                            <rect
                                className="spending-chart__peak"
                                x={peak + gap / 2}
                                y={HEADROOM + PLOT - CAP_GAP - CAP}
                                width={1 - gap}
                                height={CAP}
                                style={{ '--lift': (PLOT * biggest) / scale.max } as CSSProperties}
                            />
                        )}
                    </svg>
                </div>
                <div className="spending-chart__axis" aria-hidden="true">
                    {ends.map((bucket) => (
                        <span className="spending-chart__end" key={bucket.start}>
                            {shortNameOf(bucket.start)}
                        </span>
                    ))}
                </div>
            </div>

            <p className="spending-chart__readout" id={readoutId} aria-live="polite">
                {readout}
            </p>

            <Disclosure summary={t('showNumbers')} chevron>
                <table className="spending-chart__table">
                    <caption className="visually-hidden">{t('spendingTitle')}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t(`group.${granularity}`)}</th>
                            <th scope="col">{t('amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buckets.map((bucket) => (
                            <tr key={bucket.start}>
                                <th scope="row">{nameOf(bucket.start)}</th>
                                <td>{money(bucket.totalCents)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Disclosure>
        </div>
    );
}

export { SpendingChart };
