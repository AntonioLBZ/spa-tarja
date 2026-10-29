import clsx from 'clsx';

import type { ComponentPropsWithRef } from 'react';

import './button.css';

type ButtonVariant = 'default' | 'primary' | 'danger';

interface ButtonStyle {
    variant?: ButtonVariant;
    // A box that holds only a glyph: even padding
    glyph?: boolean;
    pressed?: boolean;
}

// The class string of a button, for anything that has to look like one
function buttonClass(options: ButtonStyle & { className?: string } = {}) {
    const { variant = 'default', glyph, pressed, className } = options;

    return clsx(
        'button',
        variant !== 'default' && `button--${variant}`,
        glyph && 'button--glyph',
        pressed && 'button--pressed',
        className
    );
}

// A glyph says nothing by itself, so it must be named
type GlyphName = { glyph: true; 'aria-label': string } | { glyph?: false };

type ButtonProps = ComponentPropsWithRef<'button'> & Omit<ButtonStyle, 'glyph'> & GlyphName;

function Button(props: ButtonProps) {
    const {
        variant,
        glyph,
        pressed,
        className,
        type = 'button',
        'aria-pressed': ariaPressed = pressed,
        ...rest
    } = props;

    return (
        <button
            {...rest}
            aria-pressed={ariaPressed}
            className={buttonClass({ variant, glyph, pressed, className })}
            type={type}
        />
    );
}

export { Button, buttonClass };
export type { ButtonStyle, GlyphName };
