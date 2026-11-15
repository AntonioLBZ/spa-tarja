import { createFileRoute, redirect } from '@tanstack/react-router';

// Where the categories were before the settings had pages, kept for old links and installed apps (ADR-0032)
export const Route = createFileRoute('/categories')({
    beforeLoad: () => {
        throw redirect({ to: '/settings/categories', replace: true });
    },
});
