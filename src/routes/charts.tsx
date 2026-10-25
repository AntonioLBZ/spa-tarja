import { createFileRoute } from '@tanstack/react-router';

import { Charts } from '@/features/charts/charts';

export const Route = createFileRoute('/charts')({ component: Charts });
