import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';
import { useRef } from 'react';
import { useTranslations } from 'use-intl';

import { BottomNav, type BottomNavItem } from '@/components/bottom-nav/bottom-nav';
import { Brand } from '@/components/brand/brand';
import { ButtonLink } from '@/components/button/button-link';
import { Icon } from '@/components/icon/icon';
import { ToastProvider } from '@/components/toast/toast';
import { AddExpenseButton } from '@/features/expenses/add-expense-button';
import { ExpenseSheet } from '@/features/expenses/expense-sheet';
import { ExpenseSheetProvider } from '@/features/expenses/expense-sheet-state';
import { useOpenAdd } from '@/features/expenses/use-open-add';
import { NicknamePrompt } from '@/features/profile/nickname-prompt';
import { AppUpdate } from '@/features/pwa/app-update';
import { isPrerelease } from '@/lib/prerelease';
import { backTarget, navSection, type BackTarget, type NavSection } from '@/lib/route-transition';
import { useHideOnScroll } from '@/lib/use-hide-on-scroll';
import { useWide } from '@/lib/use-wide';

import type { MouseEvent, ReactNode } from 'react';

import './root.css';

// A click that opens the link in another tab or window, which leaves the page as it is
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
    const t = useTranslations('toast');
    const wide = useWide();
    const rootClsx = clsx('root', { 'root--tabs': !wide });

    return (
        <ExpenseSheetProvider>
            <ToastProvider dismissLabel={t('dismiss')}>
                <div className={rootClsx}>
                    {wide ? <RootHeader /> : <RootPhoneHeader />}
                    <main className="root__main">
                        <Outlet />
                    </main>
                    {!wide && <RootTabs />}
                    <ExpenseSheet />
                    <AppUpdate />
                    <NicknamePrompt />
                </div>
            </ToastProvider>
        </ExpenseSheetProvider>
    );
};

interface RootBannerProps {
    children: ReactNode;
}

// The header on both screens: it slides out of sight when the page goes down and comes back when it goes up. It stays
// in the page and in the tab order while it is out (the styles move it, nothing takes it away).
const RootBanner = (props: RootBannerProps) => {
    const { children } = props;
    const header = useRef<HTMLElement>(null);
    const hidden = useHideOnScroll(header);
    const headerClsx = clsx('root__header', { 'root__header--hidden': hidden });

    return (
        <header className={headerClsx} ref={header}>
            {children}
        </header>
    );
};

// The logo leads home. It is never underlined.
const RootBrand = () => {
    return (
        <Link className="root__brand" to="/" activeOptions={{ exact: true }}>
            <Brand prerelease={isPrerelease()} />
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
        <RootBanner>
            <RootBack />
            <RootBrand />
        </RootBanner>
    );
};

// Expenses and the action that adds on the left, the logo in the middle, the other screens on the right. Both Expenses
// and the logo lead home.
const RootHeader = () => {
    const t = useTranslations('nav');
    const section = useSection();

    // The router marks only the link of its own path; a deeper screen marks the section it is reached from
    const current = (target: NavSection) => {
        return section === target ? 'true' : undefined;
    };

    const underline = (target: NavSection) => {
        return section === target && <span aria-hidden className="root__underline" />;
    };

    return (
        <RootBanner>
            <nav aria-label={t('label')} className="root__nav">
                <div className="root__start">
                    <Link className="root__link" to="/" activeOptions={{ exact: true }} aria-current={current('/')}>
                        {t('expenses')}
                        {underline('/')}
                    </Link>
                    <AddExpenseButton />
                </div>
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
        </RootBanner>
    );
};

const TABS = [
    { to: '/', word: 'expenses', icon: 'receipt_long' },
    { to: '/groups', word: 'groups', icon: 'groups' },
    { to: '/summary', word: 'summary', icon: 'bar_chart' },
    { to: '/settings', word: 'settings', icon: 'settings' },
] as const satisfies readonly { to: NavSection; word: string; icon: BottomNavItem['icon'] }[];

// Pressing the tab of the screen already shown scrolls it to the top; the "+" opens the sheet of a new expense
const RootTabs = () => {
    const t = useTranslations('nav');
    const openAdd = useOpenAdd();
    const section = useSection();

    const items = TABS.map((tab): BottomNavItem => {
        return {
            to: tab.to,
            label: t(tab.word),
            icon: tab.icon,
            current: section === tab.to,
            onClick: (event) => {
                if (opensElsewhere(event)) return;
                if (section === tab.to) window.scrollTo({ top: 0 });
            },
        };
    });

    return (
        <BottomNav
            label={t('label')}
            items={items}
            action={{ label: t('add'), word: t('addWord'), icon: 'add', onPress: openAdd }}
        />
    );
};

export const Route = createRootRoute({ component: RootLayout });
