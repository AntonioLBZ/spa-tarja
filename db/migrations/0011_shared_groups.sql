-- A group, or a friend (`direct`: two members, no name), shared by its members. A row is never deleted:
-- `deleted_at` closes it. The user columns lose the user when that account is deleted, through an index each.
CREATE TABLE shared_groups (
    id TEXT NOT NULL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('group', 'direct')),
    name TEXT,
    currency TEXT NOT NULL,
    simplify_debts INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE INDEX shared_groups_created_by ON shared_groups (created_by);

-- A person in a group: a user, or a placeholder nobody has claimed (`user_id` null). A row is never deleted: leaving
-- sets `left_at` and `left_seq`, the cursor of the group then, which is how far that person reads afterwards. A
-- placeholder merged into a member keeps its row with `merged_into`, and its id means that member from then on.
-- `archived_at` and `show_in_expenses` are that person's own switches for the group. A member who is a user was
-- claimed, and a group has one owner.
CREATE TABLE shared_members (
    id TEXT NOT NULL PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES shared_groups (id),
    user_id TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    claimed_at INTEGER,
    left_at INTEGER,
    left_seq INTEGER,
    archived_at INTEGER,
    merged_into TEXT REFERENCES shared_members (id),
    show_in_expenses INTEGER NOT NULL DEFAULT 1,
    CHECK (user_id IS NULL OR claimed_at IS NOT NULL)
);

CREATE INDEX shared_members_group ON shared_members (group_id);

CREATE INDEX shared_members_user ON shared_members (user_id);

CREATE UNIQUE INDEX shared_members_group_user ON shared_members (group_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX shared_members_owner ON shared_members (group_id) WHERE role = 'owner';

CREATE INDEX shared_members_created_by ON shared_members (created_by);

-- An expense or a settlement of a group, split in `shares` (JSON, `[{ "memberId", "cents" }]`), which add up to the
-- amount. `seq` is the group's own sync cursor: every applied write takes the next one of its group.
CREATE TABLE shared_entries (
    id TEXT NOT NULL PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES shared_groups (id),
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    category_id TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    paid_by TEXT NOT NULL,
    split TEXT NOT NULL,
    shares TEXT NOT NULL,
    payment TEXT NOT NULL DEFAULT 'direct',
    charge_date TEXT,
    created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    updated_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    seq INTEGER NOT NULL
);

CREATE UNIQUE INDEX shared_entries_group_seq ON shared_entries (group_id, seq);

CREATE INDEX shared_entries_created_by ON shared_entries (created_by);

CREATE INDEX shared_entries_updated_by ON shared_entries (updated_by);
