-- An invitation to be a friend: a link with which one person takes the place of the dummy of a friend (a `direct`
-- group). The link carries the id and a signature of it that is never stored, so the table alone opens no link. A row
-- is never deleted: accepting, declining or revoking ends it, at most one of them, and only who accepted is kept. The
-- user columns lose the user when that account is deleted, through an index each.
CREATE TABLE friend_invitations (
    id TEXT NOT NULL PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES shared_groups (id),
    member_id TEXT NOT NULL REFERENCES shared_members (id),
    created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    accepted_at INTEGER,
    declined_at INTEGER,
    revoked_at INTEGER,
    CHECK (expires_at > created_at),
    CHECK (accepted_by IS NULL OR accepted_at IS NOT NULL),
    CHECK ((accepted_at IS NOT NULL) + (declined_at IS NOT NULL) + (revoked_at IS NOT NULL) <= 1)
);

CREATE INDEX friend_invitations_group ON friend_invitations (group_id);

-- A friend has at most one invitation that nobody has answered or revoked
CREATE UNIQUE INDEX friend_invitations_open ON friend_invitations (group_id)
WHERE accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL;

CREATE INDEX friend_invitations_created_by ON friend_invitations (created_by);

CREATE INDEX friend_invitations_accepted_by ON friend_invitations (accepted_by);
