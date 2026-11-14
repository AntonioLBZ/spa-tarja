-- The push subscription of each device where a person turned notifications on (ADR-0025): the address of the push
-- service, unique, the keys of the browser and the language the notifications are worded in
CREATE TABLE push_subscriptions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);
