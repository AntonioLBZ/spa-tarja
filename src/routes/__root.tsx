import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { ToastProvider } from '@/components/toast/toast';
import { UpdatePrompt } from '@/components/update-prompt/update-prompt';
import { AddFormProvider, useAddForm } from '@/features/expenses/add-form-state';
import { navSection, type NavSection } from '@/lib/route-transition';

import type { MouseEvent } from 'react';

import './root.css';

export const Route = createRootRoute({ component: RootLayout });

// A click that opens the link in another tab or window, which leaves the add form as it is
function opensElsewhere(event: MouseEvent) {
    return event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function RootLayout() {
    return (
        <AddFormProvider>
            <ToastProvider>
                <div className="root">
                    <RootHeader />
                    <main className="root__main">
                        <Outlet />
                    </main>
                    <UpdatePrompt />
                </div>
            </ToastProvider>
        </AddFormProvider>
    );
}

// Expenses on the left, the logo in the middle, the other screens on the right. Both Expenses and the logo lead home,
// to the form adding: Expenses with it collapsed, the logo with it open. The logo is never underlined.
function RootHeader() {
    const t = useTranslations('nav');
    const { collapse, reveal } = useAddForm();
    // The screen already shown, not the one being opened: the underline has to be in its old place when the view
    // transition takes its first picture, or it doesn't slide
    const section = useRouterState({
        select: (state) => navSection((state.resolvedLocation ?? state.location).pathname),
    });

    // The router marks only the link of its own path; a deeper screen marks the section it is reached from
    function current(target: NavSection) {
        return section === target ? 'true' : undefined;
    }

    function underline(target: NavSection) {
        return section === target && <span aria-hidden className="root__underline" />;
    }

    return (
        <header className="root__header">
            <nav className="root__nav">
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
                <div className="root__group">
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
}
