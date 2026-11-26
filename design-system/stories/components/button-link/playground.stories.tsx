import { type ButtonVariant } from '@/components/button/button';
import { ButtonLink } from '@/components/button/button-link';
import { ICON_CONTROL, iconOf, type IconChoice } from '@stories/shared/icons';
import { RouterFrame } from '@stories/shared/router-frame';

import type { Meta } from '@storybook/react-vite';

interface ButtonLinkStoryProps {
    /** The words; with `glyph` they name the icon instead of showing */
    children: string;
    variant: ButtonVariant;
    ghost: boolean;
    block: boolean;
    small: boolean;
    /** An icon before the words, or the whole link with `glyph` */
    icon: IconChoice;
    glyph: boolean;
}

const Story: Meta<ButtonLinkStoryProps> = {
    title: 'Components/ButtonLink',
    args: {
        children: 'Categories',
        variant: 'default',
        ghost: false,
        block: false,
        small: false,
        icon: 'none',
        glyph: false,
    },
    argTypes: {
        children: { control: 'text' },
        variant: { control: 'inline-radio', options: ['default', 'primary', 'danger'] },
        icon: ICON_CONTROL,
    },
};

export const Playground = (args: ButtonLinkStoryProps) => {
    const { children, icon, glyph, ...props } = args;

    return (
        <RouterFrame paths={['/categories']}>
            {glyph ? (
                <ButtonLink to="/categories" {...props} glyph aria-label={children}>
                    {iconOf(icon === 'none' ? 'settings' : icon)}
                </ButtonLink>
            ) : (
                <ButtonLink to="/categories" {...props}>
                    {iconOf(icon)}
                    {children}
                </ButtonLink>
            )}
        </RouterFrame>
    );
};

export default Story;
