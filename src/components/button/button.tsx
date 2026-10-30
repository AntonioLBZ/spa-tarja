import clsx from 'clsx';

import type { ComponentPropsWithRef } from 'react';

import './button.css';

type ButtonVariant = 'default' | 'primary' | 'danger';

// A glyph says nothing by itself, so it must be named
type GlyphName = { glyph: true; 'aria-label': string } | { glyph?: false };

type ButtonProps = ComponentPropsWithRef<'button'> & {
    variant?: ButtonVariant;
    // Text only, for an action inside another edge or on paper
    ghost?: boolean;
    // As wide as its row, which gives its bottom edge the tail of the L
    block?: boolean;
    pressed?: boolean;
} & GlyphName;

const Button = (props: ButtonProps) => {
    const {
        variant = 'default',
        glyph,
        ghost,
        block,
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
            'button--ghost': ghost,
            'button--block': block,
            'button--pressed': pressed,
        },
        className
    );

    return <button {...rest} aria-pressed={ariaPressed} className={buttonClsx} type={type} />;
};

export { Button, type ButtonProps, type ButtonVariant, type GlyphName };
