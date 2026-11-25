import { Select } from '@/components/select/select';
import { FALLBACK_CATEGORY_ID } from '@core/categories/categories';

import { CategoryBadge } from './category-badge';

import type { CategoryStyle } from '@core/categories/category-style';
import type { ReactNode } from 'react';

interface CategorySelectOption {
    id: string;
    label: string;
    // An option with no style, like "All categories", has no badge: the icon given, if any
    style?: CategoryStyle;
    icon?: ReactNode;
}

interface CategorySelectProps {
    id: string;
    options: readonly CategorySelectOption[];
    value: string;
    onChange: (id: string) => void;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

// "All categories" stays on top and the fallback follows it: a new expense starts on the fallback, and a native list
// opens scrolled to the option chosen
const rank = (option: CategorySelectOption) => {
    if (!option.style) return 0;
    return option.id === FALLBACK_CATEGORY_ID ? 1 : 2;
};

// A `Select` of categories, each with its icon in its color
const CategorySelect = (props: CategorySelectProps) => {
    const { options, ...rest } = props;
    const ordered = options.toSorted((a, b) => rank(a) - rank(b));
    const selectOptions = ordered.map((option) => ({
        value: option.id,
        label: option.label,
        icon: option.style ? <CategoryBadge style={option.style} /> : option.icon,
    }));

    return <Select {...rest} options={selectOptions} />;
};

export { CategorySelect, type CategorySelectOption, type CategorySelectProps };
