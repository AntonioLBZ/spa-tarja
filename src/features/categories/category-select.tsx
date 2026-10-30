import { Select } from '@/components/select/select';

import { CategoryBadge } from './category-badge';

import type { CategoryStyle } from '@core/category-style';

interface CategorySelectOption {
    id: string;
    label: string;
    // An option with no style, like "All categories", has no icon
    style?: CategoryStyle;
}

interface CategorySelectProps {
    id: string;
    label: string;
    options: readonly CategorySelectOption[];
    value: string;
    onChange: (id: string) => void;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

// A `Select` of categories, each with its icon in its color
const CategorySelect = (props: CategorySelectProps) => {
    const { options, ...rest } = props;
    const selectOptions = options.map((option) => ({
        value: option.id,
        label: option.label,
        icon: option.style && <CategoryBadge style={option.style} />,
    }));

    return <Select {...rest} options={selectOptions} />;
};

export { CategorySelect, type CategorySelectOption, type CategorySelectProps };
