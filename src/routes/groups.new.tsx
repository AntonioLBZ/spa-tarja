import { createFileRoute } from '@tanstack/react-router';

import { NewGroup } from '@/features/groups/list/new-group';

export const Route = createFileRoute('/groups/new')({ component: NewGroup });
