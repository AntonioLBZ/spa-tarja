-- An invitation to be a friend: a link made with nobody behind it. Accepting it makes a new friend (a `direct` group) of
-- who made the link and who accepted it, which the invitation then holds, so `group_id` is null until it is accepted.
-- The link carries the id and a signature of it that is never stored, so the table alone opens no link. Accepting,
-- declining or revoking ends an invitation, at most one of them, and only who accepted is kept. The user columns lose
-- the user when that account is deleted, through an index each. The rows are read in the order they were made by their
-- rowid.
CREATE TABLE friend_invitations (
    id TEXT NOT NULL PRIMARY KEY,
    group_id TEXT REFERENCES shared_groups (id),
    created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
    accepted_at INTEGER,
    declined_at INTEGER,
    revoked_at INTEGER,
    CHECK (expires_at > created_at),
    CHECK (accepted_by IS NULL OR accepted_at IS NOT NULL),
    CHECK ((accepted_at IS NOT NULL) + (declined_at IS NOT NULL) + (revoked_at IS NOT NULL) <= 1),
    CHECK ((group_id IS NULL) = (accepted_at IS NULL))
);

CREATE INDEX friend_invitations_group ON friend_invitations (group_id);

CREATE INDEX friend_invitations_created_by ON friend_invitations (created_by);

CREATE INDEX friend_invitations_accepted_by ON friend_invitations (accepted_by);
