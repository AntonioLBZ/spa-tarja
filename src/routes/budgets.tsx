import { createFileRoute } from '@tanstack/react-router';

import { Budgets } from '@/features/budgets/budgets';

export const Route = createFileRoute('/budgets')({ component: Budgets });
