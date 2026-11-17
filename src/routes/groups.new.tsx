import { createFileRoute } from '@tanstack/react-router';

import { NewGroup } from '@/features/groups/new-group';

export const Route = createFileRoute('/groups/new')({ component: NewGroup });
