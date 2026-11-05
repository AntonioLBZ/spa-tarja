import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { useToast } from '@/components/toast/toast';
import { useLocale } from '@/lib/i18n';
import { useGroupOutbox } from '@/lib/offline';
import { useFadeOut } from '@/lib/use-fade-out';
import { fromDateString } from '@core/date';
import { formatAmount } from '@core/money';

import { failureOf, useFailureWords, type GroupFailure } from './group-failure';
import { LedgerRow } from './ledger-row';
import { useEntryActions } from './use-entry-actions';
import { useEntryWords } from './use-entry-words';

import type { Ledger } from './use-ledgers';
import type { LedgerEntry, SharedEntry } from '@core/shared-entry';

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

// The entries of a group, newest first, a day on each sheet like the expenses at home. In an open group a row opens
// on what can be done to it; deleting asks nothing and can be taken back (ADR-0010).
const GroupLedger = (props: GroupLedgerProps) => {
    const { ledger } = props;
    const { group, entries } = ledger;
    const t = useTranslations('groups.ledger');
    const tList = useTranslations('expenses.list');
    const { locale } = useLocale();
    const toast = useToast();
    const words = useEntryWords(group);
    const failureWords = useFailureWords();
    const actions = useEntryActions();
    const outbox = useGroupOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const pendingIds = useMemo(() => new Set(pending.map((write) => write.id)), [pending]);
    const { leaving, fadeOut } = useFadeOut<LedgerEntry>();
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [failure, setFailure] = useState<GroupFailure | null>(null);
    const open = group.closed === null;

    // What takes the focus in each row by the id of its entry, and the title, where it goes when no row is left
    const targets = useRef(new Map<string, HTMLElement>());
    const title = useRef<HTMLHeadingElement>(null);
    // The entry of the row that "Show more" brought in first, which takes the focus once the row is there
    const moreFocus = useRef<string | null>(null);
    useEffect(() => {
        if (moreFocus.current === null) return;
        (targets.current.get(moreFocus.current) ?? title.current)?.focus();
        moreFocus.current = null;
    });
    // The entry that Undo brought back, whose row takes the focus once it is there
    const [restored, setRestored] = useState<string | null>(null);

    // The rows fading out stay where they were until they are gone
    const days = useMemo(() => {
        if (leaving.size === 0) return ledgerDays(entries);
        const live = new Set(entries.filter((entry) => entry.deletedAt === null).map((entry) => entry.id));
        return ledgerDays([...entries, ...[...leaving.values()].filter((entry) => !live.has(entry.id))]);
    }, [entries, leaving]);
    useEffect(() => {
        if (restored === null) return;
        const target = targets.current.get(restored);
        if (!target) return;
        target.focus();
        setRestored(null);
    }, [restored, days]);
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

    // The row the focus goes to when a row is deleted: the next one that stays, else the one before it
    const neighbourOf = (entryId: string): string | undefined => {
        const staying = drawn
            .flatMap((day) => day.entries.map((entry) => entry.id))
            .filter((id) => id === entryId || !leaving.has(id));
        const at = staying.indexOf(entryId);
        return staying[at + 1] ?? (at > 0 ? staying[at - 1] : undefined);
    };

    const undo = async (deleted: SharedEntry) => {
        setFailure(null);
        try {
            await actions.restore(group.id, deleted);
            setRestored(deleted.id);
        } catch (error) {
            setFailure(failureOf(error));
        }
    };

    // The focus leaves the button that is going away at once; the toast comes once the delete is safe on the device
    const remove = async (entry: LedgerEntry) => {
        const neighbour = neighbourOf(entry.id);
        fadeOut([entry]);
        setRestored(null);
        setFailure(null);
        ((neighbour && targets.current.get(neighbour)) || title.current)?.focus();
        try {
            const deleted = await actions.remove(group.id, entry);
            const name = words.entryName(entry);
            toast.show({
                message: t(entry.kind === 'expense' ? 'deleted' : 'deletedSettlement', { name, group: words.title }),
                action: { label: tList('undo'), onAction: () => void undo(deleted) },
            });
        } catch (error) {
            setFailure(failureOf(error));
        }
    };

    const showMore = () => {
        moreFocus.current = days.flatMap((day) => day.entries)[total - hidden]?.id ?? null;
        setLimit((current) => current + PAGE_SIZE);
    };

    return (
        <section className="group-ledger">
            <h2 className="group-ledger__title" ref={title} tabIndex={-1}>
                {t('title')}
            </h2>
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
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
                                leaving={leaving.has(entry.id)}
                                onDelete={open ? (item) => void remove(item) : undefined}
                                focusRef={(node) => {
                                    if (node) targets.current.set(entry.id, node);
                                    return () => {
                                        targets.current.delete(entry.id);
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
