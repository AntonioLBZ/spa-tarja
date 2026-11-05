import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { useLocale } from '@/lib/i18n';
import { useGroupOutbox } from '@/lib/offline';
import { fromDateString } from '@core/date';
import { formatAmount } from '@core/money';

import { LedgerRow } from './ledger-row';

import type { Ledger } from './use-ledgers';
import type { LedgerEntry } from '@core/shared-entry';

import '@/features/expenses/expense-list.css';
import './group-ledger.css';

interface GroupLedgerProps {
    ledger: Ledger;
}

// The entries of one day, with what its expenses add up to; settlements count for nobody
interface LedgerDay {
    day: string;
    entries: LedgerEntry[];
    expenseCents: number;
}

// How many rows the ledger draws, and how many more each "Show more" adds
const PAGE_SIZE = 100;

const newestFirst = (a: LedgerEntry, b: LedgerEntry): number => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
};

// The entries that aren't deleted, newest day first and the latest made first within a day, a day at a time
const ledgerDays = (entries: readonly LedgerEntry[]): LedgerDay[] => {
    const days: LedgerDay[] = [];
    for (const entry of entries.filter((item) => item.deletedAt === null).toSorted(newestFirst)) {
        let last = days.at(-1);
        if (last?.day !== entry.date) {
            last = { day: entry.date, entries: [], expenseCents: 0 };
            days.push(last);
        }
        last.entries.push(entry);
        if (entry.kind === 'expense') last.expenseCents += entry.amountCents;
    }
    return days;
};

// The first `max` rows of the days, in order; a day cut short keeps the total of all its expenses
const firstRows = (days: readonly LedgerDay[], max: number): LedgerDay[] => {
    const limited: LedgerDay[] = [];
    let left = max;
    for (const day of days) {
        if (left <= 0) break;
        limited.push(day.entries.length <= left ? day : { ...day, entries: day.entries.slice(0, left) });
        left -= day.entries.length;
    }
    return limited;
};

// The entries of a group, newest first, a day on each sheet like the expenses at home
const GroupLedger = (props: GroupLedgerProps) => {
    const { ledger } = props;
    const { group, entries } = ledger;
    const t = useTranslations('groups.ledger');
    const tList = useTranslations('expenses.list');
    const { locale } = useLocale();
    const outbox = useGroupOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const pendingIds = useMemo(() => new Set(pending.map((write) => write.id)), [pending]);
    const [limit, setLimit] = useState(PAGE_SIZE);
    // The row of each entry, and the entry whose row "Show more" brought in first, which takes the focus once it is there
    const rows = useRef(new Map<string, HTMLLIElement>());
    const title = useRef<HTMLHeadingElement>(null);
    const moreFocus = useRef<string | null>(null);
    useEffect(() => {
        if (moreFocus.current === null) return;
        (rows.current.get(moreFocus.current) ?? title.current)?.focus();
        moreFocus.current = null;
    });

    const days = useMemo(() => ledgerDays(entries), [entries]);
    const total = days.reduce((sum, day) => sum + day.entries.length, 0);
    const drawn = firstRows(days, limit);
    const hidden = total - drawn.reduce((sum, day) => sum + day.entries.length, 0);

    // The days say the year only when the ledger goes over a New Year
    const spansYears = days.length > 0 && days[0]!.day.slice(0, 4) !== days.at(-1)!.day.slice(0, 4);
    const dayFormat = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                ...(spansYears ? { year: 'numeric' } : {}),
            }),
        [locale, spansYears]
    );

    const showMore = () => {
        moreFocus.current = days.flatMap((day) => day.entries)[total - hidden]?.id ?? null;
        setLimit((current) => current + PAGE_SIZE);
    };

    return (
        <section className="group-ledger">
            <h2 className="group-ledger__title" ref={title} tabIndex={-1}>
                {t('title')}
            </h2>
            {total === 0 && <Notice tone="quiet">{t('empty')}</Notice>}
            {drawn.map((day) => (
                <Sheet key={day.day} label={dayFormat.format(fromDateString(day.day))} level="h3">
                    <CardList flush>
                        {day.entries.map((entry) => (
                            <LedgerRow
                                key={entry.id}
                                group={group}
                                entry={entry}
                                pending={pendingIds.has(entry.id)}
                                rowRef={(node) => {
                                    if (node) rows.current.set(entry.id, node);
                                    return () => {
                                        rows.current.delete(entry.id);
                                    };
                                }}
                            />
                        ))}
                    </CardList>
                    {day.entries.some((entry) => entry.kind === 'expense') && (
                        <p className="expense-list__total">
                            <span className="expense-list__total-label">{tList('total')}</span>{' '}
                            <span className="expense-list__subtotal">
                                {formatAmount(day.expenseCents, group.currency, locale)}
                            </span>
                        </p>
                    )}
                </Sheet>
            ))}
            {hidden > 0 && (
                <Button className="group-ledger__more" onClick={showMore}>
                    {tList('showMore')}
                </Button>
            )}
        </section>
    );
};

export { GroupLedger, type GroupLedgerProps };
