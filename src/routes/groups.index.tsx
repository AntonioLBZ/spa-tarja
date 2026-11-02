import { createFileRoute } from '@tanstack/react-router';

import { Groups } from '@/features/groups/groups';

export const Route = createFileRoute('/groups/')({ component: Groups });
