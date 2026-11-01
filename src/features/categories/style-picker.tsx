import { useTranslations } from 'use-intl';

import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryStyle } from '@core/category-style';

import { CategoryBadge } from './category-badge';

import './style-picker.css';

interface StylePickerProps {
    name: string;
    value: CategoryStyle;
    onChange: (style: CategoryStyle) => void;
}

// Picks the color and the icon of a category. Each color is shown on the current icon and each icon in the current
// color, so every option reads as the result of choosing it.
const StylePicker = (props: StylePickerProps) => {
    const { name, value, onChange } = props;
    const t = useTranslations('categoryManager.look');
    const tColor = useTranslations('categoryColors');
    const tIcon = useTranslations('categoryIcons');

    const colors = CATEGORY_COLORS.map((color) => ({
        value: color,
        label: tColor(color),
        content: <CategoryBadge style={{ color, icon: value.icon }} />,
    }));
    const icons = CATEGORY_ICONS.map((icon) => ({
        value: icon,
        label: tIcon(icon),
        content: <CategoryBadge style={{ color: value.color, icon }} />,
    }));

    return (
        <div className="style-picker">
            <ChoiceGroup
                swatch
                legend={t('color')}
                name={`${name}-color`}
                options={colors}
                value={value.color}
                onChange={(color) => onChange({ ...value, color })}
            />
            <ChoiceGroup
                swatch
                legend={t('icon')}
                name={`${name}-icon`}
                options={icons}
                value={value.icon}
                onChange={(icon) => onChange({ ...value, icon })}
            />
        </div>
    );
};

export { StylePicker, type StylePickerProps };
