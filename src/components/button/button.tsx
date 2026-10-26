import { createLink } from '@tanstack/react-router';
import clsx from 'clsx';

import type { AnyRouter, LinkComponentProps, RegisteredRouter } from '@tanstack/react-router';
import type { ComponentPropsWithRef, ReactElement } from 'react';

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

function ButtonAnchor(props: ComponentPropsWithRef<'a'> & ButtonStyle) {
    const { variant, glyph, pressed, className, ...rest } = props;

    return <a {...rest} className={buttonClass({ variant, glyph, pressed, className })} />;
}

// `Link`'s own signature with the glyph rule added: `createLink` omits keys from the props of the anchor, which would
// merge the two sides of `GlyphName`
type ButtonLinkComponent = <
    TRouter extends AnyRouter = RegisteredRouter,
    const TFrom extends string = string,
    const TTo extends string | undefined = undefined,
    const TMaskFrom extends string = TFrom,
    const TMaskTo extends string = '',
>(
    props: LinkComponentProps<typeof ButtonAnchor, TRouter, TFrom, TTo, TMaskFrom, TMaskTo> & GlyphName
) => ReactElement;

// A link that does what a button does. Typed like `Link`: `to` is checked against the routes.
const ButtonLink: ButtonLinkComponent = createLink(ButtonAnchor);

export { Button, ButtonLink, buttonClass };
