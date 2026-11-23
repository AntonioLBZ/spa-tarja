import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { Field } from '@/components/field/field';
import { Icon } from '@/components/icon/icon';

import './list-search-field.css';

// What the placeholder of the search shows, one of them each time the field appears, so a person learns over time that
// it finds amounts too
const SEARCH_EXAMPLES = ['text', 'category', 'whole', 'exact', 'above', 'below', 'between'] as const;

interface ListSearchFieldProps {
    className?: string;
    value: string;
    onChange: (query: string) => void;
}

// The search of a list of expenses: text, a category or an amount, with an example of what it finds
const ListSearchField = (props: ListSearchFieldProps) => {
    const { className, value, onChange } = props;
    const t = useTranslations('expenses.filters');
    const [example] = useState(() => SEARCH_EXAMPLES[Math.floor(Math.random() * SEARCH_EXAMPLES.length)]!);

    return (
        <Field
            className={className}
            label={t('search')}
            placeholder={t(`searchExamples.${example}`)}
            icon={<Icon name="search" />}
        >
            {(control) => (
                <input
                    {...control}
                    className="list-search-field"
                    type="search"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </Field>
    );
};

export { ListSearchField, type ListSearchFieldProps };
