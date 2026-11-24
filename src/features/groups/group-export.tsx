import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Actions } from '@/components/actions/actions';
import { Amount } from '@/components/amount/amount';
import { Button } from '@/components/button/button';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { LiveNotice } from '@/components/notice/live-notice';
import { Notice } from '@/components/notice/notice';
import { ScreenTitle } from '@/components/screen-title/screen-title';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useShortDate } from '@/features/expenses/use-short-date';
import { useAmount } from '@/lib/amounts';
import { downloadFile } from '@/lib/download';
import { useLocale } from '@/lib/i18n';
import { groupCsv, groupFileName, type GroupCsvLabels } from '@core/export';
import { groupTable, type DayRange, type GroupTable } from '@core/group-table';
import { canonicalMember } from '@core/shared-member';

import { GroupGate } from './group-gate';
import { groupTitle, memberNames } from './member-names';

import type { Ledger } from './use-ledgers';
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
    words: TableWords;
}

interface BalanceRowProps {
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
    const { locale } = useLocale();
    const shortDate = useShortDate();
    const words = useTableWords(group);
    const [range, setRange] = useState<DayRange>({ from: '', to: '' });
    const rangeErrorId = useId();
    const backwards = range.from !== '' && range.to !== '' && range.from > range.to;
    const table = useMemo(() => groupTable(entries, group.members, range), [entries, group.members, range]);
    const ready = hasData && !backwards;
    const filled = ready && table.columns.length > 0;

    const caption = (() => {
        const from = range.from && shortDate(range.from);
        const to = range.to && shortDate(range.to);
        if (from && to) return t('range.between', { from, to });
        if (from) return t('range.from', { from });
        if (to) return t('range.to', { to });
        return t('range.all');
    })();
    const opening = range.from === '' ? '' : t('opening', { day: shortDate(range.from) });

    const downloadCsv = () => {
        const labels: GroupCsvLabels = {
            columns: COLUMNS.map((column) => t(`columns.${column}`)),
            memberName: words.nameOf,
            entryText: words.entryText,
            categoryName: words.categoryName,
            opening,
            closing: t('closing'),
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
            <p className="hint group-export__screen-only">{t('hint')}</p>
            <div className="group-export__controls group-export__screen-only">
                <DateRangeFields
                    allowEmpty
                    from={range.from}
                    to={range.to}
                    labels={{ from: t('from'), to: t('to') }}
                    invalid={backwards}
                    describedBy={backwards ? rangeErrorId : undefined}
                    onChange={(edge, day) => setRange((current) => ({ ...current, [edge]: day }))}
                />
                {backwards && (
                    <p className="hint group-export__error" id={rangeErrorId}>
                        {t('backwards')}
                    </p>
                )}
                <Actions>
                    <Button disabled={!filled} onClick={() => window.print()}>
                        {t('print')}
                    </Button>
                    <Button disabled={!filled} onClick={downloadCsv}>
                        {t('csv')}
                    </Button>
                </Actions>
            </div>
            <LiveNotice>{!hasData && (isError || isWaitingForNetwork) && tGroup('entriesFailed')}</LiveNotice>
            {ready && table.columns.length === 0 && <Notice>{t('empty')}</Notice>}
            {filled && <ExportTable group={group} table={table} caption={caption} opening={opening} words={words} />}
        </section>
    );
};

const ExportTable = (props: ExportTableProps) => {
    const { group, table, caption, opening, words } = props;
    const t = useTranslations('groups.export');
    const shortDate = useShortDate();
    const amount = useAmount();
    const captionId = useId();

    const cell = (cents: number | null) => {
        if (cents === null) return null;
        const props = amount(cents, group.currency, { cues: true });
        return <Amount {...props} sign spokenSign />;
    };

    return (
        <div className="group-export__scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
            <table className="group-export__table">
                <caption className="group-export__caption" id={captionId}>
                    {caption}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">{t('columns.date')}</th>
                        <th scope="col">{t('columns.text')}</th>
                        <th scope="col">{t('columns.category')}</th>
                        <th scope="col">{t('columns.paidBy')}</th>
                        <th className="group-export__number" scope="col">
                            {t('columns.amount')}
                        </th>
                        {table.columns.map((memberId) => (
                            <th key={memberId} className="group-export__number" scope="col">
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
                            <td className="group-export__date">{shortDate(entry.date)}</td>
                            <th scope="row">{words.entryText(entry)}</th>
                            <td>{entry.kind === 'expense' ? words.categoryName(entry.categoryId) : ''}</td>
                            <td>{words.nameOf(entry.paidBy)}</td>
                            <td className="group-export__number">
                                <Amount {...amount(entry.amountCents, entry.currency)} />
                            </td>
                            {cells.map((cents, index) => (
                                <td key={table.columns[index]} className="group-export__number">
                                    {cell(cents)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <BalanceRow
                        label={t('closing')}
                        columns={table.columns}
                        cells={table.closing}
                        currency={group.currency}
                    />
                </tfoot>
            </table>
        </div>
    );
};

// The opening or the closing balance of each person, under the columns of the people
const BalanceRow = (props: BalanceRowProps) => {
    const { label, columns, cells, currency } = props;
    const amount = useAmount();

    return (
        <tr className="group-export__balance">
            <th scope="row" colSpan={5}>
                {label}
            </th>
            {cells.map((cents, index) => (
                <td key={columns[index]} className="group-export__number">
                    <Amount {...amount(cents, currency, { cues: true })} sign spokenSign />
                </td>
            ))}
        </tr>
    );
};

export { GroupExport, type GroupExportProps };
