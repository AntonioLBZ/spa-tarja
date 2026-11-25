import { createFileRoute } from '@tanstack/react-router';

import { Groups } from '@/features/groups/list/groups';

export const Route = createFileRoute('/groups/')({ component: Groups });
