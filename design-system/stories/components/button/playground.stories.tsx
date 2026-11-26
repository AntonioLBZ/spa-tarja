import { Button, type ButtonVariant } from '@/components/button/button';
import { ICON_CONTROL, iconOf, type IconChoice } from '@stories/shared/icons';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

interface ButtonStoryProps {
    /** The words; with `glyph` they name the icon instead of showing */
    children: string;
    variant: ButtonVariant;
    ghost: boolean;
    block: boolean;
    small: boolean;
    pressed: boolean;
    disabled: boolean;
    /** An icon before the words, or the whole button with `glyph` */
    icon: IconChoice;
    glyph: boolean;
    /** A short mark in the corner of a glyph; empty for none */
    badge: string;
    onClick: () => void;
}

const Story: Meta<ButtonStoryProps> = {
    title: 'Components/Button',
    args: {
        children: 'Save',
        variant: 'default',
        ghost: false,
        block: false,
        small: false,
        pressed: false,
        disabled: false,
        icon: 'none',
        glyph: false,
        badge: '',
        onClick: fn(),
    },
    argTypes: {
        children: { control: 'text' },
        variant: { control: 'inline-radio', options: ['default', 'primary', 'danger'] },
        icon: ICON_CONTROL,
        badge: { control: 'text', if: { arg: 'glyph' } },
        onClick: { table: { disable: true } },
    },
};

export const Playground = (args: ButtonStoryProps) => {
    const { children, icon, glyph, badge, ...props } = args;

    if (glyph) {
        return (
            <Button {...props} glyph aria-label={children} badge={badge || undefined}>
                {iconOf(icon === 'none' ? 'add' : icon)}
            </Button>
        );
    }

    return (
        <Button {...props}>
            {iconOf(icon)}
            {children}
        </Button>
    );
};

export default Story;
