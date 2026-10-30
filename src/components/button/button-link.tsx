import { createLink } from '@tanstack/react-router';
import clsx from 'clsx';

import type { ButtonVariant, GlyphName } from './button';
import type { AnyRouter, LinkComponentProps, RegisteredRouter } from '@tanstack/react-router';
import type { ComponentPropsWithRef, ReactElement } from 'react';

interface ButtonAnchorProps extends ComponentPropsWithRef<'a'> {
    variant?: ButtonVariant;
    glyph?: boolean;
    block?: boolean;
}

const ButtonAnchor = (props: ButtonAnchorProps) => {
    const { variant = 'default', glyph, block, className, ...rest } = props;
    const buttonClsx = clsx(
        'button',
        {
            [`button--${variant}`]: variant !== 'default',
            'button--glyph': glyph,
            'button--block': block,
        },
        className
    );

    return <a {...rest} className={buttonClsx} />;
};

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

export { ButtonLink };
