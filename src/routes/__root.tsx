import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

import { Brand } from '@/components/brand/brand';
import { UpdatePrompt } from '@/components/update-prompt/update-prompt';

import './root.css';

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
    const t = useTranslations('nav');

    return (
        <div className="root">
            <header className="root__header">
                <Link className="root__brand" to="/" activeOptions={{ exact: true }}>
                    <Brand />
                </Link>
                <Link className="root__link" to="/settings">
                    {t('settings')}
                </Link>
            </header>
            <main className="root__main">
                <Outlet />
            </main>
            <UpdatePrompt />
        </div>
    );
}
