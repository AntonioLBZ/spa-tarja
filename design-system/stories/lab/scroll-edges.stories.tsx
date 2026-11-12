import { BottomNav } from '@/components/bottom-nav/bottom-nav';
import { Brand } from '@/components/brand/brand';
import { Button } from '@/components/button/button';
import { Card, CardList } from '@/components/card/card';
import {
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from '@tanstack/react-router';
import clsx from 'clsx';
import { useState } from 'react';

import type { Meta } from '@storybook/react-vite';

import './scroll-edges.css';

type Edge = 'none' | 'shadow' | 'rule' | 'fade';

interface Option {
    edge: Edge;
    title: string;
    note: string;
}

const OPTIONS: readonly Option[] = [
    {
        edge: 'none',
        title: 'A. Nothing (today)',
        note: 'The ink hairline of the header and of the bar is the only edge, always there. Nothing says there is more under it.',
    },
    {
        edge: 'shadow',
        title: 'B. Soft shadow',
        note: 'A blurred shadow falls on the content while something is under the edge. Breaks "no shadows, no blur" (DESIGN.md, §2), needs a black the palette has no token for and hardly shows in the dark theme, where the page is black.',
    },
    {
        edge: 'rule',
        title: 'C. Ink rule',
        note: 'The hairline thickens to the 4 px ink edge of the notch while something is under it. Flat and in the identity; the strongest of the quiet ones.',
    },
    {
        edge: 'fade',
        title: 'D. Fade',
        note: 'The content fades into the page before the edge. Breaks "Solid fills only" (§2); over a sheet the fade has to be the sheet color.',
    },
];

const PLACES = [
    'The bottom bar of a phone: content is under it whenever the page is not at its end.',
    'The header, now that it is sticky: content is under it whenever the page is not at its top (and it slides out on a scroll down, so the edge only shows while it is in).',
    'The footer of a long sheet (the add form with the keyboard open): a sticky row of actions that the form scrolls under. Not built today: the sheet scrolls as one piece.',
    'The list of a Select, the privacy notice in its dialog, and the chart, which scrolls sideways: the edges of a box that scrolls inside the page.',
];

const ROWS = Array.from({ length: 16 }, (_, index) => `Expense number ${index + 1}`);
const FIELDS = ['What', 'How much', 'Day', 'Category', 'Payment', 'Installments', 'Notes'];

// The smallest router that has a route for each tab to point at
const NavBar = () => {
    const [router] = useState(() => {
        const root = createRootRoute({
            component: () => (
                <BottomNav
                    label="Main"
                    items={[
                        { to: '/', label: 'Expenses', icon: 'receipt_long', current: true },
                        { to: '/groups', label: 'Groups', icon: 'groups', current: false },
                        { to: '/summary', label: 'Summary', icon: 'bar_chart', current: false },
                        { to: '/settings', label: 'Settings', icon: 'settings', current: false },
                    ]}
                    action={{ label: 'Add expense', word: 'Add', icon: 'add', onPress: () => undefined }}
                />
            ),
        });
        const pages = ['/groups', '/summary', '/settings'].map((path) => {
            return createRoute({ getParentRoute: () => root, path });
        });

        return createRouter({
            routeTree: root.addChildren(pages),
            history: createMemoryHistory({ initialEntries: ['/'] }),
        });
    });

    return <RouterProvider router={router} />;
};

interface FrameProps {
    edge: Edge;
}

const ScreenFrame = (props: FrameProps) => {
    const { edge } = props;
    const frameClsx = clsx('scroll-edges__frame', `scroll-edges__frame--${edge}`);

    return (
        <div className={frameClsx}>
            <div className="scroll-edges__scroller">
                <div className="scroll-edges__header">
                    <Brand />
                </div>
                <div className="scroll-edges__content">
                    <CardList label="Rows">
                        {ROWS.map((row) => (
                            <Card as="li" key={row}>
                                {row}
                            </Card>
                        ))}
                    </CardList>
                </div>
                <NavBar />
            </div>
        </div>
    );
};

const SheetFrame = (props: FrameProps) => {
    const { edge } = props;
    const frameClsx = clsx('scroll-edges__frame', 'scroll-edges__frame--sheet', `scroll-edges__frame--${edge}`);

    return (
        <div className={frameClsx}>
            <div className="scroll-edges__scroller">
                <div className="scroll-edges__sheet">
                    <h3 className="scroll-edges__sheet-title">Add expense</h3>
                    {FIELDS.map((field) => (
                        <div className="scroll-edges__field" key={field}>
                            <span>{field}</span>
                            <div className="scroll-edges__box" />
                        </div>
                    ))}
                    <div className="scroll-edges__footer">
                        <Button ghost>Cancel</Button>
                        <Button variant="primary">Save</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Story: Meta = {
    title: 'Lab/Scroll edges',
    parameters: { layout: 'padded' },
};

export const ScrollEdges = () => {
    return (
        <div className="scroll-edges">
            <p className="scroll-edges__intro">
                What should show where content slides under the header, the bottom bar or the footer of a sheet? Scroll
                inside each frame. The edge effects follow the scroll position (scroll-driven animations, no script):
                the top one appears after a few pixels, the bottom one goes away at the end. Switch the theme in the
                toolbar to see both. Nothing here is in the app: the owner picks, and DESIGN.md changes first if the
                pick breaks a rule.
            </p>
            <div className="scroll-edges__options">
                {OPTIONS.map((option) => (
                    <section className="scroll-edges__option" key={option.edge}>
                        <h2 className="scroll-edges__title">{option.title}</h2>
                        <ScreenFrame edge={option.edge} />
                        <SheetFrame edge={option.edge} />
                        <p className="scroll-edges__note">{option.note}</p>
                    </section>
                ))}
            </div>
            <section>
                <h2 className="scroll-edges__title">Where it could go</h2>
                <ul className="scroll-edges__places">
                    {PLACES.map((place) => (
                        <li key={place}>{place}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
};

export default Story;
