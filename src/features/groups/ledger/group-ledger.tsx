import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';

import { Amount } from '@/components/amount/amount';
import { Button } from '@/components/button/button';
import { CardList } from '@/components/card/card';
import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { Notice } from '@/components/notice/notice';
import { Sheet } from '@/components/sheet/sheet';
import { useToast } from '@/components/toast/toast';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { FilterStatus } from '@/features/expenses/filters/filter-status';
import { useExpenseSheet } from '@/features/expenses/sheet/expense-sheet-state';
import { failureOf, useFailureWords, type GroupFailure } from '@/features/groups/data/group-failure';
import { useEntryActions } from '@/features/groups/data/use-entry-actions';
import { useEntryWords } from '@/features/groups/words/use-entry-words';
import { useAmount } from '@/lib/amounts';
import { useLocale } from '@/lib/i18n';
import { useFadeOut } from '@/lib/motion';
import { useGroupOutbox } from '@/lib/offline';
import { fromDateString } from '@core/date';
import { NO_LEDGER_FILTERS, filterLedger, ledgerFilterCount } from '@core/ledger-list';
import { normalizeText } from '@core/text';

import { ledgerEffect } from './ledger-effect';
import { LedgerFilters } from './ledger-filters';
import { LedgerRow } from './ledger-row';

import type { SettlementEntry } from '@/features/groups/balances/settle-up';
import type { Ledger } from '@/features/groups/data/use-ledgers';
import type { LedgerContext, LedgerFilters as Filters } from '@core/ledger-list';
import type { LedgerEntry, SharedEntry } from '@core/shared-entry';
import type { SharedExpenseEntry } from '@core/shared-expense';
import type { SharedGroup } from '@core/shared-group';

import '@/features/expenses/list/expense-list.css';
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

// The entries of one sheet: a day, with what its expenses do to the person's balance in all (settlements count for
// nobody, ADR-0030), or all of them when the ledger isn't by day
interface LedgerSheet {
    day: string | null;
    entries: LedgerEntry[];
    yoursCents: number;
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
const ledgerSheets = (entries: readonly LedgerEntry[], order: LedgerOrder, group: SharedGroup): LedgerSheet[] => {
    const live = entries.filter((item) => item.deletedAt === null);
    if (order === 'added') {
        return live.length === 0 ? [] : [{ day: null, entries: live.toSorted(addedLastFirst), yoursCents: 0 }];
    }
    const days: LedgerSheet[] = [];
    for (const entry of live.toSorted(newestFirst)) {
        let last = days.at(-1);
        if (last?.day !== entry.date) {
            last = { day: entry.date, entries: [], yoursCents: 0 };
            days.push(last);
        }
        last.entries.push(entry);
        if (entry.kind === 'expense') last.yoursCents += ledgerEffect(entry, group).cents;
    }
    return days;
};

// The first `max` rows of the sheets, in order; a day cut short keeps the total of all its entries
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
    const amount = useAmount();
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
    const { labelOf } = useCategoryOptions();
    const { added } = useExpenseSheet();
    const [filters, setFilters] = useState<Filters>(NO_LEDGER_FILTERS);
    const query = useDeferredValue(filters.query);
    const filterCount = ledgerFilterCount(filters);
    const toggle = useRef<HTMLButtonElement>(null);

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

    // What a search reads in an entry: what its row shows of it, its name, its category and who paid
    const context = useMemo<LedgerContext>(() => {
        const texts = new WeakMap<SharedEntry, string>();
        return {
            members: group.members,
            me: group.me,
            locale,
            textOf: (entry) => {
                let text = texts.get(entry);
                if (text === undefined) {
                    const category = entry.kind === 'expense' ? labelOf(entry.categoryId) : '';
                    const payer = words.isMe(entry.paidBy) ? t('youPaid') : words.nameOf(entry.paidBy);
                    text = normalizeText(`${words.entryName(entry)} ${category} ${payer}`);
                    texts.set(entry, text);
                }
                return text;
            },
        };
    }, [group, locale, labelOf, words, t]);

    // The rows fading out stay where they were until they are gone
    const rows = useMemo(() => {
        if (leaving.size === 0) return entries;
        const live = new Set(entries.filter((entry) => entry.deletedAt === null).map((entry) => entry.id));
        return [...entries, ...[...leaving.values()].filter((entry) => !live.has(entry.id))];
    }, [entries, leaving]);
    const applied = useMemo(() => ({ ...filters, query }), [filters, query]);
    const sheets = useMemo(
        () =>
            ledgerSheets(
                filterLedger(
                    rows.filter((entry) => entry.deletedAt === null),
                    applied,
                    context
                ),
                order,
                group
            ),
        [rows, applied, context, order, group]
    );
    const all = useMemo(() => rows.filter((entry) => entry.deletedAt === null).length, [rows]);
    const filtering = ledgerFilterCount(applied) > 0;

    // A filter must never hide a new expense, nor stay on once the ledger is empty
    const [seenAdded, setSeenAdded] = useState(added);
    if (added !== seenAdded) {
        setSeenAdded(added);
        if (added && filters !== NO_LEDGER_FILTERS) setFilters(NO_LEDGER_FILTERS);
    }
    if (all === 0 && filters !== NO_LEDGER_FILTERS) setFilters(NO_LEDGER_FILTERS);

    // A row brought back by Undo takes the focus only while nothing else has moved it
    const changeFilters = (patch: Partial<Filters>) => {
        setFilters((current) => ({ ...current, ...patch }));
        setLimit(PAGE_SIZE);
        setRestored(null);
    };

    // Clear goes with the filters: the focus goes to their button, never to the search, whose keyboard would open
    const clearFilters = () => {
        setFilters(NO_LEDGER_FILTERS);
        setLimit(PAGE_SIZE);
        setRestored(null);
        toggle.current?.focus();
    };

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
                icon: 'check',
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
            {/* The order at the end of the row of the title, as tabs (ADR-0041), and the button of the search and the
                filters after it, so the screen grows no taller for them */}
            <div className="group-ledger__head">
                <h2 ref={title} tabIndex={-1}>
                    {t('title')}
                </h2>
                {all > 0 && (
                    <div className="group-ledger__tools">
                        <ChoiceGroup
                            tabs
                            legend={t('order.legend')}
                            name="ledger-order"
                            options={LEDGER_ORDERS.map((value) => ({ value, label: t(`order.${value}`) }))}
                            value={order}
                            onChange={setOrder}
                        />
                        <LedgerFilters
                            group={group}
                            filters={filters}
                            count={filterCount}
                            filtering={filtering}
                            shown={total}
                            total={all}
                            toggleRef={toggle}
                            onChange={changeFilters}
                            onClosed={() => toggle.current?.focus()}
                        />
                    </div>
                )}
            </div>
            <FilterStatus filtering={filtering} shown={total} total={all} onClear={clearFilters} />
            {failure && (
                <Notice tone="danger" role="alert">
                    {failureWords(failure)}
                </Notice>
            )}
            {all === 0 && <Notice tone="quiet">{t('empty')}</Notice>}
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
                                <Amount {...amount(sheet.yoursCents, group.currency, { cues: true })} spokenSign />
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
