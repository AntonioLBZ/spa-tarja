import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { UpdatePrompt } from '@/components/update-prompt/update-prompt';
import { AddFormProvider, useAddForm } from '@/features/expenses/add-form-state';

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
            <div className="root">
                <RootHeader />
                <main className="root__main">
                    <Outlet />
                </main>
                <UpdatePrompt />
            </div>
        </AddFormProvider>
    );
}

// Expenses on the left, the logo in the middle, the other screens on the right. Both Expenses and the logo lead home:
// Expenses with the add form collapsed, the logo with it open.
function RootHeader() {
    const t = useTranslations('nav');
    const { setOpen } = useAddForm();

    return (
        <header className="root__header">
            <nav className="root__nav">
                <Link
                    className="root__link"
                    to="/"
                    activeOptions={{ exact: true }}
                    onClick={(event) => {
                        if (!opensElsewhere(event)) setOpen(false);
                    }}
                >
                    {t('expenses')}
                </Link>
                <Link
                    className="root__brand"
                    to="/"
                    activeOptions={{ exact: true }}
                    onClick={(event) => {
                        if (!opensElsewhere(event)) setOpen(true);
                    }}
                >
                    <Brand />
                </Link>
                <div className="root__group">
                    <Link className="root__link" to="/summary">
                        {t('summary')}
                    </Link>
                    <Link className="root__link" to="/settings">
                        {t('settings')}
                    </Link>
                </div>
            </nav>
        </header>
    );
}
