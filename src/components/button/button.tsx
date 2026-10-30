import clsx from 'clsx';

import type { ComponentPropsWithRef } from 'react';

import './button.css';

type ButtonVariant = 'default' | 'primary' | 'danger';

// A glyph says nothing by itself, so it must be named
type GlyphName = { glyph: true; 'aria-label': string } | { glyph?: false };

type ButtonProps = ComponentPropsWithRef<'button'> & {
    variant?: ButtonVariant;
    pressed?: boolean;
} & GlyphName;

const Button = (props: ButtonProps) => {
    const {
        variant = 'default',
        glyph,
        pressed,
        className,
        type = 'button',
        'aria-pressed': ariaPressed = pressed,
        ...rest
    } = props;

    const buttonClsx = clsx(
        'button',
        {
            [`button--${variant}`]: variant !== 'default',
            'button--glyph': glyph,
            'button--pressed': pressed,
        },
        className
    );

    return <button {...rest} aria-pressed={ariaPressed} className={buttonClsx} type={type} />;
};

export { Button, type ButtonProps, type ButtonVariant, type GlyphName };
