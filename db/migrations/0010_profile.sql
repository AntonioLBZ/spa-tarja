-- The nickname a person's friends see: a row only while one is set, and nothing in it is unique.
CREATE TABLE profile (
    user_id TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
