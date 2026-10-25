import { createFileRoute } from '@tanstack/react-router';

import { Summary } from '@/features/summary/summary';

export const Route = createFileRoute('/summary')({ component: Summary });
