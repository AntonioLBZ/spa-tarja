CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    text TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    seq INTEGER NOT NULL
);

CREATE INDEX expenses_user_date ON expenses (user_id, date);

CREATE UNIQUE INDEX expenses_user_seq ON expenses (user_id, seq);
