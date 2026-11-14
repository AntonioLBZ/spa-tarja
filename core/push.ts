import * as v from 'valibot';

// The push subscriptions a person keeps, one per device; a new one past it replaces the one sent longest ago (ADR-0025)
const MAX_PUSH_SUBSCRIPTIONS = 5;

const PUSH_LOCALES = ['en', 'es'] as const;

// The hosts of the push services of the browsers, the only ones a subscription may name, so that no stored address can
// make the server call another host
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com'];
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com'];

const ENDPOINT_MAX_LENGTH = 1024;

const isPushEndpoint = (value: string): boolean => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return false;
    return PUSH_HOSTS.includes(url.hostname) || PUSH_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
};

const endpointSchema = v.pipe(
    v.string(),
    v.maxLength(ENDPOINT_MAX_LENGTH),
    v.check(isPushEndpoint, 'Not the address of a push service')
);

// The keys of the browser, base64url without padding: a P-256 point of 65 bytes and a secret of 16
const pushSubscriptionSchema = v.object({
    endpoint: endpointSchema,
    keys: v.object({
        p256dh: v.pipe(v.string(), v.regex(/^[\w-]{87}$/)),
        auth: v.pipe(v.string(), v.regex(/^[\w-]{22}$/)),
    }),
    locale: v.picklist(PUSH_LOCALES),
});

const pushEndpointSchema = v.object({ endpoint: endpointSchema });

type PushSubscriptionInput = v.InferOutput<typeof pushSubscriptionSchema>;

type PushLocale = (typeof PUSH_LOCALES)[number];

export {
    MAX_PUSH_SUBSCRIPTIONS,
    PUSH_LOCALES,
    isPushEndpoint,
    pushEndpointSchema,
    pushSubscriptionSchema,
    type PushLocale,
    type PushSubscriptionInput,
};
