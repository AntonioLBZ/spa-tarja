import { useEffect, useState } from 'react';
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events';

import type { Channel } from 'storybook/internal/channels';

type Globals = Record<string, unknown>;

interface GlobalsEvent {
    globals?: Globals;
}

// The channel of the Storybook frame, which holds the toolbar. A preview's own channel can't be trusted for it: a story
// a docs page shows in an iframe of its own starts from the initial globals and tells its parent about them.
const frameChannel = (): Channel | undefined => {
    if (window.top === window) return undefined;
    try {
        return (window.top as (Window & { __STORYBOOK_ADDONS_CHANNEL__?: Channel }) | null)
            ?.__STORYBOOK_ADDONS_CHANNEL__;
    } catch {
        return undefined;
    }
};

const lastGlobals = (channel: Channel): Globals | undefined => {
    const [event] = (channel.last(GLOBALS_UPDATED) ?? channel.last(SET_GLOBALS) ?? []) as GlobalsEvent[];
    return event?.globals;
};

// The toolbar as the frame has it, or `own` where there is no frame (a story opened alone)
const useFrameGlobals = (own: Globals): Globals => {
    const [channel] = useState(frameChannel);
    const [framed, setFramed] = useState(() => (channel ? lastGlobals(channel) : undefined));

    useEffect(() => {
        if (!channel) return;
        const onGlobals = (event: GlobalsEvent) => setFramed(event.globals);
        channel.on(GLOBALS_UPDATED, onGlobals);
        channel.on(SET_GLOBALS, onGlobals);
        return () => {
            channel.off(GLOBALS_UPDATED, onGlobals);
            channel.off(SET_GLOBALS, onGlobals);
        };
    }, [channel]);

    return framed ?? own;
};

export { useFrameGlobals };
