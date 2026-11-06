import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
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

import type { SettlementEntry } from './settle-up';
import type { Ledger } from './use-ledgers';
import type { LedgerEntry, SharedEntry } from '@core/shared-entry';
import type { SharedExpenseEntry } from '@core/shared-expense';

import '@/features/expenses/expense-list.css';
import './group-ledger.css';

interface GroupLedgerProps {
    ledger: Ledger;
    // Load an expense of the group into the add form, to change it or to start a new one from it
    onEdit: (entry: SharedExpenseEntry) => void;
    onDuplicate: (entry: SharedExpenseEntry) => void;
    // Load a settlement into Settle up, to change it
    onEditSettlement: (entry: SettlementEntry) => void;
    // An entry was deleted, so that an edit of it is over
    onDeleted: (entryId: string) => void;
    // The entry whose row takes the focus back once an edit or a copy is over, until it has it
    refocus: string | null;
    onRefocused: () => void;
}

// The entries of one sheet: a day, with what its expenses add up to (settlements count for nobody), or all of them
// when the ledger isn't by day
interface LedgerSheet {
    day: string | null;
    entries: LedgerEntry[];
    expenseCents: number;
}

// Which entry comes first: the one made last, or the one of the latest day
const LEDGER_ORDERS = ['added', 'date'] as const;

type LedgerOrder = (typeof LEDGER_ORDERS)[number];

// How many rows the ledger draws, and how many more each "Show more" adds
const PAGE_SIZE = 100;

const newestFirst = (a: LedgerEntry, b: LedgerEntry): number => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
};

// An edit never moves an entry, and the id keeps entries made at the same time from swapping places
const addedLastFirst = (a: LedgerEntry, b: LedgerEntry): number => {
    return b.createdAt - a.createdAt || a.id.localeCompare(b.id);
};

// The entries that aren't deleted: all on one sheet, the latest made first, or newest day first and the latest made
// first within a day, a day at a time
const ledgerSheets = (entries: readonly LedgerEntry[], order: LedgerOrder): LedgerSheet[] => {
    const live = entries.filter((item) => item.deletedAt === null);
    if (order === 'added') {
        return live.length === 0 ? [] : [{ day: null, entries: live.toSorted(addedLastFirst), expenseCents: 0 }];
    }
    const days: LedgerSheet[] = [];
    for (const entry of live.toSorted(newestFirst)) {
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

// The first `max` rows of the sheets, in order; a day cut short keeps the total of all its expenses
const firstRows = (sheets: readonly LedgerSheet[], max: number): LedgerSheet[] => {
    const limited: LedgerSheet[] = [];
    let left = max;
    for (const sheet of sheets) {
        if (left <= 0) break;
        limited.push(sheet.entries.length <= left ? sheet : { ...sheet, entries: sheet.entries.slice(0, left) });
        left -= sheet.entries.length;
    }
    return limited;
};

// The entries of a group, the latest added first on one sheet or by date with a day on each sheet like the expenses at
// home. In an open group a row opens on what can be done to it; deleting asks nothing and can be taken back (ADR-0010).
const GroupLedger = (props: GroupLedgerProps) => {
    const { ledger, onEdit, onEditSettlement, onDuplicate, onDeleted, refocus, onRefocused } = props;
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
    const [order, setOrder] = useState<LedgerOrder>('added');
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
    useEffect(() => {
        if (refocus === null) return;
        (targets.current.get(refocus) ?? title.current)?.focus();
        onRefocused();
    }, [refocus, onRefocused]);
    // The entry that Undo brought back, whose row takes the focus once it is there
    const [restored, setRestored] = useState<string | null>(null);

    // The rows fading out stay where they were until they are gone
    const sheets = useMemo(() => {
        if (leaving.size === 0) return ledgerSheets(entries, order);
        const live = new Set(entries.filter((entry) => entry.deletedAt === null).map((entry) => entry.id));
        return ledgerSheets([...entries, ...[...leaving.values()].filter((entry) => !live.has(entry.id))], order);
    }, [entries, leaving, order]);
    useEffect(() => {
        if (restored === null) return;
        const target = targets.current.get(restored);
        if (!target) return;
        target.focus();
        setRestored(null);
    }, [restored, sheets]);
    const total = sheets.reduce((sum, sheet) => sum + sheet.entries.length, 0);
    const drawn = firstRows(sheets, limit);
    const hidden = total - drawn.reduce((sum, sheet) => sum + sheet.entries.length, 0);

    // The days say the year only when the ledger goes over a New Year
    const spansYears =
        order === 'date' && sheets.length > 0 && sheets[0]!.day!.slice(0, 4) !== sheets.at(-1)!.day!.slice(0, 4);
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
    // Without a day over them, the rows say their own, with the year unless it is this one
    const shortDay = useMemo(() => {
        const bare = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
        const withYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        const thisYear = String(new Date().getFullYear());
        return (day: string) => (day.startsWith(thisYear) ? bare : withYear).format(fromDateString(day));
    }, [locale]);

    // The row the focus goes to when a row is deleted: the next one that stays, else the one before it
    const neighbourOf = (entryId: string): string | undefined => {
        const staying = drawn
            .flatMap((sheet) => sheet.entries.map((entry) => entry.id))
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
        onDeleted(entry.id);
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

    // An expense opens in the add form, a settlement in Settle up
    const edit = (entry: LedgerEntry) => {
        if (entry.kind === 'expense') onEdit(entry);
        else onEditSettlement(entry);
    };

    const showMore = () => {
        moreFocus.current = sheets.flatMap((sheet) => sheet.entries)[total - hidden]?.id ?? null;
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
            {total > 0 && (
                <ChoiceGroup
                    legend={t('order.legend')}
                    name="ledger-order"
                    options={LEDGER_ORDERS.map((value) => ({ value, label: t(`order.${value}`) }))}
                    value={order}
                    onChange={setOrder}
                />
            )}
            {drawn.map((sheet) => (
                <Sheet
                    key={sheet.day ?? 'added'}
                    label={sheet.day === null ? undefined : dayFormat.format(fromDateString(sheet.day))}
                    level="h3"
                >
                    <CardList flush>
                        {sheet.entries.map((entry) => (
                            <LedgerRow
                                key={entry.id}
                                group={group}
                                entry={entry}
                                date={sheet.day === null ? shortDay(entry.date) : undefined}
                                pending={pendingIds.has(entry.id)}
                                leaving={leaving.has(entry.id)}
                                onEdit={open ? edit : undefined}
                                onDuplicate={open ? onDuplicate : undefined}
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
                    {sheet.day !== null && sheet.entries.some((entry) => entry.kind === 'expense') && (
                        <p className="expense-list__total">
                            <span className="expense-list__total-label">{tList('total')}</span>{' '}
                            <span className="expense-list__subtotal">
                                {formatAmount(sheet.expenseCents, group.currency, locale)}
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
