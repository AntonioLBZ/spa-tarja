import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';

import { BottomNav, type BottomNavItem } from '@/components/bottom-nav/bottom-nav';
import { Brand } from '@/components/brand/brand';
import { ButtonLink } from '@/components/button/button-link';
import { Icon } from '@/components/icon/icon';
import { ToastProvider } from '@/components/toast/toast';
import { AddFormProvider, useAddForm } from '@/features/expenses/add-form-state';
import { AppUpdate } from '@/features/pwa/app-update';
import { backTarget, navSection, type BackTarget, type NavSection } from '@/lib/route-transition';
import { useWide } from '@/lib/use-wide';

import type { MouseEvent } from 'react';

import './root.css';

// A click that opens the link in another tab or window, which leaves the add form as it is
const opensElsewhere = (event: MouseEvent) => {
    return event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
};

// The path of the screen already shown, not of the one being opened: the header has to be in its old state when the
// view transition takes its first picture (the underline would not slide otherwise), and changes inside it
const useShownPathname = () => {
    return useRouterState({ select: (state) => (state.resolvedLocation ?? state.location).pathname });
};

const useSection = () => {
    return navSection(useShownPathname());
};

const RootLayout = () => {
    const wide = useWide();
    const rootClsx = clsx('root', { 'root--tabs': !wide });

    return (
        <AddFormProvider>
            <ToastProvider>
                <div className={rootClsx}>
                    {wide ? <RootHeader /> : <RootPhoneHeader />}
                    <main className="root__main">
                        <Outlet />
                    </main>
                    {!wide && <RootTabs />}
                    <AppUpdate />
                </div>
            </ToastProvider>
        </AddFormProvider>
    );
};

// The logo leads home to the form adding, with it open. It is never underlined.
const RootBrand = () => {
    const { reveal } = useAddForm();

    return (
        <Link
            className="root__brand"
            to="/"
            activeOptions={{ exact: true }}
            onClick={(event) => {
                if (!opensElsewhere(event)) reveal();
            }}
        >
            <Brand />
        </Link>
    );
};

const BACK_WORDS = {
    '/': 'expenses',
    '/groups': 'groups',
    '/groups/$groupId': 'group',
    '/summary': 'summary',
    '/settings': 'settings',
} as const satisfies Record<BackTarget['to'], string>;

// The link back to the parent of a screen deeper than a tab, named for the place it leads to
const RootBack = () => {
    const t = useTranslations('nav');
    const target = backTarget(useShownPathname());

    if (!target) return null;
    const place = t(BACK_WORDS[target.to]);
    const content = (
        <>
            <Icon name="chevron_left" />
            {place}
        </>
    );

    return 'params' in target ? (
        <ButtonLink
            ghost
            className="root__back"
            to={target.to}
            params={target.params}
            aria-label={t('back', { place })}
        >
            {content}
        </ButtonLink>
    ) : (
        <ButtonLink ghost className="root__back" to={target.to} aria-label={t('back', { place })}>
            {content}
        </ButtonLink>
    );
};

// On a phone the header holds the logo in the middle and, below a tab, the link back at its left; the destinations are
// the bar at the bottom
const RootPhoneHeader = () => {
    return (
        <header className="root__header">
            <RootBack />
            <RootBrand />
        </header>
    );
};

// Expenses on the left, the logo in the middle, the other screens on the right. Both Expenses and the logo lead home,
// to the form adding: Expenses with it collapsed, the logo with it open.
const RootHeader = () => {
    const t = useTranslations('nav');
    const { collapse } = useAddForm();
    const section = useSection();

    // The router marks only the link of its own path; a deeper screen marks the section it is reached from
    const current = (target: NavSection) => {
        return section === target ? 'true' : undefined;
    };

    const underline = (target: NavSection) => {
        return section === target && <span aria-hidden className="root__underline" />;
    };

    return (
        <header className="root__header">
            <nav aria-label={t('label')} className="root__nav">
                <Link
                    className="root__link"
                    to="/"
                    activeOptions={{ exact: true }}
                    aria-current={current('/')}
                    onClick={(event) => {
                        if (!opensElsewhere(event)) collapse();
                    }}
                >
                    {t('expenses')}
                    {underline('/')}
                </Link>
                <RootBrand />
                <div className="root__group">
                    <Link className="root__link" to="/groups" aria-current={current('/groups')}>
                        {t('groups')}
                        {underline('/groups')}
                    </Link>
                    <Link className="root__link" to="/summary" aria-current={current('/summary')}>
                        {t('summary')}
                        {underline('/summary')}
                    </Link>
                    <Link className="root__link" to="/settings" aria-current={current('/settings')}>
                        {t('settings')}
                        {underline('/settings')}
                    </Link>
                </div>
            </nav>
        </header>
    );
};

const TABS = [
    { to: '/', word: 'expenses', icon: 'receipt_long' },
    { to: '/groups', word: 'groups', icon: 'groups' },
    { to: '/summary', word: 'summary', icon: 'bar_chart' },
    { to: '/settings', word: 'settings', icon: 'settings' },
] as const satisfies readonly { to: NavSection; word: string; icon: BottomNavItem['icon'] }[];

// Expenses does what the header word does; pressing the tab of the screen already shown scrolls it to the top
const RootTabs = () => {
    const t = useTranslations('nav');
    const { collapse } = useAddForm();
    const section = useSection();

    const items = TABS.map((tab): BottomNavItem => {
        return {
            to: tab.to,
            label: t(tab.word),
            icon: tab.icon,
            current: section === tab.to,
            onClick: (event) => {
                if (opensElsewhere(event)) return;
                if (tab.to === '/') collapse();
                if (section === tab.to) window.scrollTo({ top: 0 });
            },
        };
    });

    return <BottomNav label={t('label')} items={items} />;
};

export const Route = createRootRoute({ component: RootLayout });
