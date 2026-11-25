import { useMemo, useState, type Ref } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/button/button';
import { DateRangeFields } from '@/components/date-range-fields/date-range-fields';
import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';
import { Select } from '@/components/select/select';
import { CategorySelect } from '@/features/categories/category-select';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { FiltersSheet } from '@/features/expenses/filters/filters-sheet';
import { ListSearchField } from '@/features/expenses/filters/list-search-field';
import { isUser } from '@/features/groups/people/is-user';
import { useGroupWords } from '@/features/groups/words/use-group-words';
import { isDefaultCategoryId } from '@core/categories';
import { ENTRY_KINDS, NO_LEDGER_FILTERS } from '@core/ledger-list';

import type { IconName } from '@/components/icon/icon-paths';
import type { EntryKind, LedgerFilters as Filters } from '@core/ledger-list';
import type { SharedGroup } from '@core/shared-group';

const KIND_ICONS: Record<EntryKind, IconName> = {
    all: 'apps',
    expense: 'receipt_long',
    settlement: 'payments',
};

interface LedgerFiltersProps {
    group: SharedGroup;
    filters: Filters;
    // How many of the search and the filters are in use
    count: number;
    // Whether they narrow the ledger, and how much of it they leave
    filtering: boolean;
    shown: number;
    total: number;
    toggleRef: Ref<HTMLButtonElement>;
    onChange: (patch: Partial<Filters>) => void;
    // The sheet closed; the focus goes back to the button
    onClosed: () => void;
}

// A button at the end of the row of the title of the ledger that opens its search and its filters in a sheet, so the
// screen grows no taller for them
const LedgerFilters = (props: LedgerFiltersProps) => {
    const { group, filters, count, filtering, shown, total, toggleRef, onChange, onClosed } = props;
    const t = useTranslations('groups.ledger.filters');
    const tFilters = useTranslations('expenses.filters');
    const words = useGroupWords(group);
    const { options } = useCategoryOptions();
    const [open, setOpen] = useState(false);

    // A shared expense takes a default category only
    const categories = useMemo(() => options.filter((option) => isDefaultCategoryId(option.id)), [options]);
    // Everybody an entry can name, a merged placeholder read as the member it became: the person first
    const members = useMemo(() => {
        const listed = group.members.filter((member) => member.mergedInto === null);
        return [
            ...listed.filter((member) => member.id === group.me),
            ...listed.filter((member) => member.id !== group.me),
        ].map((member) => ({
            value: member.id,
            label: words.nameInList(member.id),
            icon: <Icon name={isUser(member) ? 'person_filled' : 'person'} />,
        }));
    }, [group, words]);
    const anyone = { value: '', label: t('anyone'), icon: <Icon name="groups" /> };

    const close = () => {
        setOpen(false);
        onClosed();
    };

    return (
        <>
            <Button
                ref={toggleRef}
                ghost
                glyph
                aria-haspopup="dialog"
                aria-label={t('toggle', { count })}
                badge={count > 0 ? count : undefined}
                onClick={() => setOpen(true)}
            >
                <Icon name="search" />
            </Button>
            <FiltersSheet
                open={open}
                inUse={count > 0}
                filtering={filtering}
                shown={shown}
                total={total}
                onClearFilters={() => onChange(NO_LEDGER_FILTERS)}
                onClose={close}
            >
                <ListSearchField value={filters.query} onChange={(query) => onChange({ query })} />
                <Field label={t('kind')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={ENTRY_KINDS.map((value) => ({
                                value,
                                label: t(`kinds.${value}`),
                                icon: <Icon name={KIND_ICONS[value]} />,
                            }))}
                            value={filters.kind}
                            onChange={(kind) => onChange({ kind })}
                        />
                    )}
                </Field>
                <Field label={tFilters('category')}>
                    {(control) => (
                        <CategorySelect
                            {...control}
                            options={[
                                { id: '', label: tFilters('allCategories'), icon: <Icon name="apps" /> },
                                ...categories,
                            ]}
                            value={filters.categoryId}
                            onChange={(categoryId) => onChange({ categoryId })}
                        />
                    )}
                </Field>
                <DateRangeFields
                    allowEmpty
                    from={filters.from}
                    to={filters.to}
                    labels={{ from: tFilters('from'), to: tFilters('to') }}
                    onChange={(edge, day) => onChange({ [edge]: day })}
                />
                <Field label={t('paidBy')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={[anyone, ...members]}
                            value={filters.paidBy}
                            onChange={(paidBy) => onChange({ paidBy })}
                        />
                    )}
                </Field>
                <Field label={t('with')}>
                    {(control) => (
                        <Select
                            {...control}
                            options={[anyone, ...members]}
                            value={filters.with}
                            onChange={(member) => onChange({ with: member })}
                        />
                    )}
                </Field>
            </FiltersSheet>
        </>
    );
};

export { LedgerFilters, type LedgerFiltersProps };
