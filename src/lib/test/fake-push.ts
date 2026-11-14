import { vi } from 'vitest';

type Permission = 'default' | 'denied' | 'granted';

interface FakePushOptions {
    // What the browser has when the test starts
    permission?: Permission;
    // What the browser's prompt answers
    answer?: Permission;
    // Whether this browser has a subscription already
    subscribed?: boolean;
}

// A browser with push, as far as the app uses it: the permission, a service worker registration with its push manager,
// and the messages the service worker posts to the page
const installFakePush = ({ permission = 'default', answer = 'granted', subscribed = false }: FakePushOptions = {}) => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const makeSubscription = () => {
        const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;
        const subscription = {
            endpoint,
            toJSON: () => ({ endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }),
            unsubscribe: vi.fn(async () => {
                if (state.subscription === subscription) state.subscription = null;
                return true;
            }),
        };
        return subscription;
    };
    const state = {
        permission,
        subscription: null as ReturnType<typeof makeSubscription> | null,
    };
    if (subscribed) state.subscription = makeSubscription();

    const pushManager = {
        getSubscription: vi.fn(async () => state.subscription),
        subscribe: vi.fn(async () => {
            state.subscription = makeSubscription();
            return state.subscription;
        }),
    };
    const requestPermission = vi.fn(async () => {
        if (state.permission === 'default') state.permission = answer;
        return state.permission;
    });

    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', {
        get permission() {
            return state.permission;
        },
        requestPermission,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistration: async () => ({ pushManager }),
            addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
            removeEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.delete(listener),
        },
    });

    return {
        state,
        pushManager,
        requestPermission,
        // A message from the service worker to the page
        post: (data: unknown) => {
            for (const listener of listeners) listener(new MessageEvent('message', { data }));
        },
        uninstall: () => {
            Reflect.deleteProperty(navigator, 'serviceWorker');
            vi.unstubAllGlobals();
        },
    };
};

export { installFakePush };
