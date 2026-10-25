import clsx from 'clsx';
import { useTranslations } from 'use-intl';

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
function StylePicker(props: StylePickerProps) {
    const { name, value, onChange } = props;
    const t = useTranslations('categoryManager.look');
    const tColor = useTranslations('categoryColors');
    const tIcon = useTranslations('categoryIcons');

    return (
        <div className="style-picker">
            <fieldset className="style-picker__group">
                <legend className="style-picker__legend">{t('color')}</legend>
                <div className="style-picker__options">
                    {CATEGORY_COLORS.map((color) => (
                        <label className="style-picker__option" key={color} title={tColor(color)}>
                            <input
                                className={clsx('visually-hidden', 'style-picker__input')}
                                aria-label={tColor(color)}
                                checked={value.color === color}
                                name={`${name}-color`}
                                type="radio"
                                value={color}
                                onChange={() => onChange({ ...value, color })}
                            />
                            <span className="style-picker__swatch">
                                <CategoryBadge style={{ color, icon: value.icon }} />
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <fieldset className="style-picker__group">
                <legend className="style-picker__legend">{t('icon')}</legend>
                <div className="style-picker__options">
                    {CATEGORY_ICONS.map((icon) => (
                        <label className="style-picker__option" key={icon} title={tIcon(icon)}>
                            <input
                                className={clsx('visually-hidden', 'style-picker__input')}
                                aria-label={tIcon(icon)}
                                checked={value.icon === icon}
                                name={`${name}-icon`}
                                type="radio"
                                value={icon}
                                onChange={() => onChange({ ...value, icon })}
                            />
                            <span className="style-picker__swatch">
                                <CategoryBadge style={{ color: value.color, icon }} />
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
        </div>
    );
}

export { StylePicker };
