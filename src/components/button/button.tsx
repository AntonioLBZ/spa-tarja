import clsx from 'clsx';

import type { ComponentPropsWithRef, ReactNode } from 'react';

import './button.css';

type ButtonVariant = 'default' | 'primary' | 'danger';

// A glyph says nothing by itself, so it must be named
type GlyphName = { glyph: true; 'aria-label': string } | { glyph?: false };

type ButtonProps = ComponentPropsWithRef<'button'> & {
    /** `primary` for the main action of a form, `danger` for what deletes */
    variant?: ButtonVariant;
    /** Text only, for an action inside another edge or on paper */
    ghost?: boolean;
    /** As wide as its row, which gives its bottom edge the tail of the L */
    block?: boolean;
    /** In the size of the words of the header */
    small?: boolean;
    /** A toggle that is on: the accent fill and `aria-pressed` */
    pressed?: boolean;
    /** A short mark in the corner of a glyph box, hidden from assistive technology: the name has to say it */
    badge?: ReactNode;
} & GlyphName;

const Button = (props: ButtonProps) => {
    const {
        variant = 'default',
        glyph,
        ghost,
        block,
        small,
        pressed,
        badge,
        className,
        children,
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
            'button--small': small,
            'button--pressed': pressed,
            'button--badged': badge != null,
        },
        className
    );

    return (
        <button {...rest} aria-pressed={ariaPressed} className={buttonClsx} type={type}>
            {children}
            {badge != null && (
                <span aria-hidden="true" className="button__badge">
                    {badge}
                </span>
            )}
        </button>
    );
};

export { Button, type ButtonProps, type ButtonVariant, type GlyphName };
