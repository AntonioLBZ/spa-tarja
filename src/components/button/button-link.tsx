import { createLink } from '@tanstack/react-router';

import { buttonClass } from './button';

import type { ButtonStyle, GlyphName } from './button';
import type { AnyRouter, LinkComponentProps, RegisteredRouter } from '@tanstack/react-router';
import type { ComponentPropsWithRef, ReactElement } from 'react';

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

export { ButtonLink };
