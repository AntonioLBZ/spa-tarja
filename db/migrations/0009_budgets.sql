-- The limit a month sets for its total or for a category: one row per user, month and scope, replaced
-- by each write. `scope` is 'total' or a category id, and an amount of 0 means no limit from that month on.
CREATE TABLE budget (
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    scope TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, month, scope)
);
