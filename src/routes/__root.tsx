import { Outlet, createRootRoute } from '@tanstack/react-router';

import { UpdatePrompt } from '@/components/update-prompt/update-prompt';

import './root.css';

export const Route = createRootRoute({ component: RootLayout });

function RootLayout() {
    return (
        <div className="root">
            <header className="root__header">
                <span className="root__brand">Tarja</span>
            </header>
            <main className="root__main">
                <Outlet />
            </main>
            <UpdatePrompt />
        </div>
    );
}
