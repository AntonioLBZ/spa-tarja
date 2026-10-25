import { createLink } from '@tanstack/react-router';
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
type ButtonProps = ComponentPropsWithRef<'button'> &
    Omit<ButtonStyle, 'glyph'> &
    ({ glyph: true; 'aria-label': string } | { glyph?: false });

function Button(props: ButtonProps) {
    const { variant, glyph, pressed, className, type = 'button', ...rest } = props;

    return (
        <button
            {...rest}
            aria-pressed={pressed}
            className={buttonClass({ variant, glyph, pressed, className })}
            type={type}
        />
    );
}

function ButtonAnchor(props: ComponentPropsWithRef<'a'> & ButtonStyle) {
    const { variant, glyph, pressed, className, ...rest } = props;

    return <a {...rest} className={buttonClass({ variant, glyph, pressed, className })} />;
}

// A link that does what a button does. Typed like `Link`: `to` is checked against the routes.
const ButtonLink = createLink(ButtonAnchor);

export { Button, ButtonLink, buttonClass };
export type { ButtonProps, ButtonVariant };
