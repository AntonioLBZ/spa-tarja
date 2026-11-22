import { app } from './app';
import { dailyCleanup } from './cleanup';

// The requests go to the API; the Cron Trigger of each environment runs the clean-up once a day
const worker = {
    fetch: app.fetch,
    scheduled: async (_controller, env, ctx) => {
        ctx.waitUntil(
            dailyCleanup(env.DB, Date.now()).then((counts) => {
                console.log('daily clean-up', counts);
            })
        );
    },
} satisfies ExportedHandler<Env>;

export default worker;
