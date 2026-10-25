import { hc } from 'hono/client';

import type { AppType } from '@server/app';

const api = hc<AppType>('/');

export { api };
