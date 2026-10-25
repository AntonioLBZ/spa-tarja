-- What a person earns each month (ARCHITECTURE.md §5): one row per user and month, replaced by each write.
CREATE TABLE income (
    user_id TEXT NOT NULL,
    month TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, month)
);
