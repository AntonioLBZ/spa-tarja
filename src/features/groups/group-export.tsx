import clsx from 'clsx';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Amount } from '@/components/amount/amount';
import { Button } from '@/components/button/button';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { PrintTable } from '@/components/print-table/print-table';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { FilterStatus } from '@/features/expenses/filter-status';
import { useShortDate } from '@/features/expenses/use-short-date';
import { useAmount } from '@/lib/amounts';
import { downloadFile } from '@/lib/download';
import { useLocale } from '@/lib/i18n';
import { groupCsv, groupFileName, type GroupCsvLabels } from '@core/export';
import { groupTable, type GroupTable } from '@core/group-table';
import { NO_LEDGER_FILTERS, ledgerFilterCount, ledgerMatcher } from '@core/ledger-list';
import { yourPart } from '@core/shared-expense';
import { canonicalMember } from '@core/shared-member';
import { normalizeText } from '@core/text';

import { GroupGate } from './group-gate';
import { LedgerFilters } from './ledger-filters';
import { groupTitle, memberNames } from './member-names';

import type { Ledger } from './use-ledgers';
import type { LedgerContext, LedgerFilters as Filters } from '@core/ledger-list';
import type { SharedEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

import './group-export.css';

const COLUMNS = ['date', 'text', 'category', 'paidBy', 'amount', 'currency'] as const;

interface GroupExportProps {
    groupId: string;
}

interface ExportViewProps {
    ledger: Ledger;
}

interface ExportTableProps {
    group: SharedGroup;
    table: GroupTable<SharedEntry>;
    caption: string;
    // The label of the opening balance, when the range has a first day
    opening: string;
    // The label of the last row: the balance, or the total of what the filters leave
    closing: string;
    words: TableWords;
}

interface BalanceRowProps {
    // The last row, ruled off from the entries
    closing?: boolean;
    label: string;
    columns: readonly string[];
    cells: readonly number[];
    currency: string;
}

type TableWords = ReturnType<typeof useTableWords>;

// A group's entries as a table, the same whoever exports it: a column per person with what each entry does to their
// balance, to print, save as a PDF or download as CSV (ADR-0043)
const GroupExport = (props: GroupExportProps) => {
    const { groupId } = props;

    return <GroupGate groupId={groupId}>{(ledger) => <ExportView ledger={ledger} />}</GroupGate>;
};

// The names and words of the table: each person as the group names them, never "You", so that it reads the same
// whoever made it
const useTableWords = (group: SharedGroup) => {
    const t = useTranslations('groups');
    const { labelOf } = useCategoryOptions();

    return useMemo(() => {
        const names = memberNames(group.members, {
            deleted: t('names.deleted'),
            numbered: (name, number) => t('names.numbered', { name, number }),
        });
        const nameOf = (memberId: string) => names.get(canonicalMember(group.members, memberId)) ?? t('names.unknown');
        const entryText = (entry: SharedEntry) => {
            if (entry.kind === 'expense') return entry.text || labelOf(entry.categoryId);
            return t('ledger.paid', { from: nameOf(entry.paidBy), to: nameOf(entry.shares[0]!.memberId) });
        };

        return { title: groupTitle(group, names), nameOf, entryText, categoryName: labelOf };
    }, [group, labelOf, t]);
};

const ExportView = (props: ExportViewProps) => {
    const { ledger } = props;
    const { group, entries, hasData, isError, isWaitingForNetwork } = ledger;
    const t = useTranslations('groups.export');
    const tGroup = useTranslations('groups.group');
    const tKinds = useTranslations('groups.ledger.filters.kinds');
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const words = useTableWords(group);
    const [filters, setFilters] = useState<Filters>(NO_LEDGER_FILTERS);
    const query = useDeferredValue(filters.query);
    const toggle = useRef<HTMLButtonElement>(null);
    const applied = useMemo(() => ({ ...filters, query }), [filters, query]);

    // What a search reads in an entry, as the table shows it to anybody: its text, its category and who paid, and the
    // whole amount with what it does to each person
    const context = useMemo<LedgerContext>(() => {
        return {
            members: group.members,
            me: group.me,
            locale,
            textOf: (entry) => {
                const category = entry.kind === 'expense' ? words.categoryName(entry.categoryId) : '';
                return normalizeText(`${words.entryText(entry)} ${category} ${words.nameOf(entry.paidBy)}`);
            },
            amountsOf: (entry) => {
                const payer = canonicalMember(group.members, entry.paidBy);
                const effects = group.members
                    .filter((member) => member.mergedInto === null)
                    .map(
                        (member) =>
                            (member.id === payer ? entry.amountCents : 0) - yourPart(entry, member.id, group.members)
                    )
                    .filter((cents) => cents !== 0);
                return [entry.amountCents, ...effects.map(Math.abs)];
            },
        };
    }, [group, locale, words]);

    const table = useMemo(() => {
        // Narrowed by more than the days, the table totals what it shows instead of giving a balance
        const others = { ...applied, from: '', to: '' };
        const keep = ledgerFilterCount(others) > 0 ? ledgerMatcher(others, context) : undefined;
        return groupTable(entries, group.members, { from: applied.from, to: applied.to }, keep);
    }, [entries, group.members, applied, context]);
    const all = useMemo(() => entries.filter((entry) => entry.deletedAt === null).length, [entries]);
    const filterCount = ledgerFilterCount(filters);
    const filtering = ledgerFilterCount(applied) > 0;
    const filled = hasData && table.columns.length > 0;

    // What the table holds, in words, which paper keeps too: the days, then each filter in use
    const caption = (() => {
        const from = applied.from && shortDate(applied.from);
        const to = applied.to && shortDate(applied.to);
        const days =
            from && to
                ? t('range.between', { from, to })
                : from
                  ? t('range.from', { from })
                  : to
                    ? t('range.to', { to })
                    : t('range.all');
        const kind = applied.kind === 'all' ? '' : tKinds(applied.kind);
        const category = applied.categoryId && words.categoryName(applied.categoryId);
        const paidBy = applied.paidBy && t('caption.paidBy', { name: words.nameOf(applied.paidBy) });
        const withWhom = applied.with && t('caption.with', { name: words.nameOf(applied.with) });
        const search = applied.query.trim() && t('caption.search', { query: applied.query.trim() });
        return [days, kind, category, paidBy, withWhom, search].filter(Boolean).join(' · ');
    })();
    const opening = applied.from === '' ? '' : t('opening', { day: shortDate(applied.from) });
    const closing = table.narrowed ? t('total') : t('closing');

    const changeFilters = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

    // The focus goes to the button of the filters, never to the search, whose keyboard would open
    const clearFilters = () => {
        setFilters(NO_LEDGER_FILTERS);
        toggle.current?.focus();
    };

    const downloadCsv = () => {
        const labels: GroupCsvLabels = {
            columns: COLUMNS.map((column) => t(`columns.${column}`)),
            memberName: words.nameOf,
            entryText: words.entryText,
            categoryName: words.categoryName,
            opening,
            closing,
        };
        downloadFile(
            groupFileName(words.title, new Date()),
            groupCsv(table, group.currency, locale, labels),
            'text/csv;charset=utf-8'
        );
    };

    return (
        <section className="group-export">
            <ScreenTitle>{words.title}</ScreenTitle>
            <p className="hint screen-only">{t('hint')}</p>
            <div className="group-export__controls screen-only">
                <Actions>
                    <Button disabled={!filled} onClick={() => window.print()}>
                        {t('print')}
                    </Button>
                    <Button disabled={!filled} onClick={downloadCsv}>
                        {t('csv')}
                    </Button>
                </Actions>
                {hasData && all > 0 && (
                    <LedgerFilters
                        group={group}
                        filters={filters}
                        count={filterCount}
                        filtering={filtering}
                        shown={table.rows.length}
                        total={all}
                        toggleRef={toggle}
                        onChange={changeFilters}
                        onClosed={() => toggle.current?.focus()}
                    />
                )}
            </div>
            <div className="screen-only">
                <FilterStatus filtering={filtering} shown={table.rows.length} total={all} onClear={clearFilters} />
            </div>
            <LiveNotice>{!hasData && (isError || isWaitingForNetwork) && tGroup('entriesFailed')}</LiveNotice>
            {hasData && table.columns.length === 0 && <Notice>{t('empty')}</Notice>}
            {filled && (
                <ExportTable
                    group={group}
                    table={table}
                    caption={caption}
                    opening={opening}
                    closing={closing}
                    words={words}
                />
            )}
        </section>
    );
};

const ExportTable = (props: ExportTableProps) => {
    const { group, table, caption, opening, closing, words } = props;
    const t = useTranslations('groups.export');
    const shortDate = useShortDate();
    const amount = useAmount();

    const cell = (cents: number | null) => {
        if (cents === null) return null;
        return <Amount {...amount(cents, group.currency, { cues: true })} sign spokenSign />;
    };

    return (
        <PrintTable caption={caption}>
            <thead>
                <tr>
                    <th scope="col">{t('columns.date')}</th>
                    <th scope="col">{t('columns.text')}</th>
                    <th scope="col">{t('columns.category')}</th>
                    <th scope="col">{t('columns.paidBy')}</th>
                    <th className="print-table__number" scope="col">
                        {t('columns.amount')}
                    </th>
                    {table.columns.map((memberId) => (
                        <th key={memberId} className="print-table__end" scope="col">
                            {words.nameOf(memberId)}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {table.opening && (
                    <BalanceRow
                        label={opening}
                        columns={table.columns}
                        cells={table.opening}
                        currency={group.currency}
                    />
                )}
                {table.rows.map(({ entry, cells }) => (
                    <tr key={entry.id}>
                        <td className="print-table__date">{shortDate(entry.date)}</td>
                        <th scope="row">{words.entryText(entry)}</th>
                        <td>{entry.kind === 'expense' ? words.categoryName(entry.categoryId) : ''}</td>
                        <td>{words.nameOf(entry.paidBy)}</td>
                        <td className="print-table__number">
                            <Amount {...amount(entry.amountCents, entry.currency)} />
                        </td>
                        {cells.map((cents, index) => (
                            <td key={table.columns[index]} className="print-table__number">
                                {cell(cents)}
                            </td>
                        ))}
                    </tr>
                ))}
                <BalanceRow
                    closing
                    label={closing}
                    columns={table.columns}
                    cells={table.closing}
                    currency={group.currency}
                />
            </tbody>
        </PrintTable>
    );
};

// The opening or the closing balance of each person, under the columns of the people. The closing one is a row of the
// body, not a foot, which paper would repeat at the end of every sheet.
const BalanceRow = (props: BalanceRowProps) => {
    const { closing, label, columns, cells, currency } = props;
    const amount = useAmount();
    const rowClsx = clsx('print-table__sum', { 'print-table__sum--last': closing });

    return (
        <tr className={rowClsx}>
            <th scope="row" colSpan={5}>
                {label}
            </th>
            {cells.map((cents, index) => (
                <td key={columns[index]} className="print-table__number">
                    <Amount {...amount(cents, currency, { cues: true })} sign spokenSign />
                </td>
            ))}
        </tr>
    );
};

export { GroupExport, type GroupExportProps };
