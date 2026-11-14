import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { pushEndpointSchema, pushSubscriptionSchema } from '@core/push';
import { deletePushSubscription, savePushSubscription } from '@server/db/push';
import { readVapidKey } from '@server/vapid';

import type { AppEnv } from '@server/env';

// The subscriptions of the devices where a person turned notifications on (ADR-0025). The address goes in the body,
// never in the URL, as the logs of the Worker keep URLs.
const pushRoutes = new Hono<AppEnv>()
    .get('/key', (c) => {
        const key = readVapidKey(c.env.VAPID_PRIVATE_KEY);
        if (!key) return c.json({ error: 'push-unavailable' }, 503);
        return c.json({ key: key.publicKey }, 200);
    })
    .put('/', sValidator('json', pushSubscriptionSchema), async (c) => {
        await savePushSubscription(c.env.DB, c.var.userId, c.req.valid('json'), Date.now());
        return c.body(null, 204);
    })
    .delete('/', sValidator('json', pushEndpointSchema), async (c) => {
        await deletePushSubscription(c.env.DB, c.req.valid('json').endpoint, c.var.userId);
        return c.body(null, 204);
    });

export { pushRoutes };
