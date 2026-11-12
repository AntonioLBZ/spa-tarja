import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { BottomNav, type BottomNavItem } from '@/components/bottom-nav/bottom-nav';
import { ToastProvider } from '@/components/toast/toast';
import { AddExpenseButton } from '@/features/expenses/add-expense-button';
import { ExpenseSheet } from '@/features/expenses/expense-sheet';
import { ExpenseSheetProvider } from '@/features/expenses/expense-sheet-state';
import { useOpenAdd } from '@/features/expenses/use-open-add';
import { AppUpdate } from '@/features/pwa/app-update';
import { BrandLink } from '@/features/shell/brand-link';
import { NotFound } from '@/features/shell/not-found';
import { useSection } from '@/features/shell/shown-path';
import { type NavSection } from '@/lib/route-transition';
import { useWide } from '@/lib/use-wide';

import type { MouseEvent } from 'react';

import './root.css';

// A click that opens the link in another tab or window, which leaves the page as it is
const opensElsewhere = (event: MouseEvent) => {
    return event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
};

const RootLayout = () => {
    const t = useTranslations('toast');
    const wide = useWide();

    return (
        <ExpenseSheetProvider>
            <ToastProvider dismissLabel={t('dismiss')}>
                <div className="root">
                    {wide && <RootHeader />}
                    <main className="root__main">
                        <Outlet />
                    </main>
                    {!wide && <RootTabs />}
                    <ExpenseSheet />
                    <AppUpdate />
                </div>
            </ToastProvider>
        </ExpenseSheetProvider>
    );
};

// From 40 rem: the logo, the four destinations and, at the far end, the action that adds. On a phone each screen has its
// own bar and the destinations are the tabs at the bottom.
const RootHeader = () => {
    const t = useTranslations('nav');
    const section = useSection();

    // The router marks only the link of its own path; a deeper screen marks the section it is reached from
    const current = (target: NavSection) => {
        return section === target ? 'true' : undefined;
    };

    const mark = (target: NavSection) => {
        return section === target && <span aria-hidden className="root__mark" />;
    };

    return (
        <header className="root__header">
            <nav aria-label={t('label')} className="root__nav">
                <BrandLink />
                <div className="root__links">
                    <Link className="root__link" to="/" activeOptions={{ exact: true }} aria-current={current('/')}>
                        {mark('/')}
                        <span className="root__link-text">{t('expenses')}</span>
                    </Link>
                    <Link className="root__link" to="/groups" aria-current={current('/groups')}>
                        {mark('/groups')}
                        <span className="root__link-text">{t('groups')}</span>
                    </Link>
                    <Link className="root__link" to="/summary" aria-current={current('/summary')}>
                        {mark('/summary')}
                        <span className="root__link-text">{t('summary')}</span>
                    </Link>
                    <Link className="root__link" to="/settings" aria-current={current('/settings')}>
                        {mark('/settings')}
                        <span className="root__link-text">{t('settings')}</span>
                    </Link>
                </div>
                <AddExpenseButton />
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
                if (section === tab.to) window.scrollTo({ top: 0, behavior: 'smooth' });
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

export const Route = createRootRoute({ component: RootLayout, notFoundComponent: NotFound });
