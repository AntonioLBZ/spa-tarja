CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX categories_user_name_key ON categories (user_id, name_key);
