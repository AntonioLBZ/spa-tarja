-- An invitation may be direct: made with nobody behind it, it makes a new friend once accepted, so it has no dummy, and
-- no friend until then, when it holds the friend it made. SQLite can't let a column be null in place, so the table is
-- made again, which is safe only because it had never reached production. The rows keep their rowid, by which the
-- invitation of a friend made last is read.
CREATE TABLE friend_invitations_next (
    id TEXT NOT NULL PRIMARY KEY,
    group_id TEXT REFERENCES shared_groups (id),
    member_id TEXT REFERENCES shared_members (id),
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
    CHECK (
        (member_id IS NOT NULL AND group_id IS NOT NULL)
        OR (member_id IS NULL AND (group_id IS NULL) = (accepted_at IS NULL))
    )
);

INSERT INTO friend_invitations_next (
    rowid, id, group_id, member_id, created_by, created_at, expires_at, accepted_by, accepted_at, declined_at, revoked_at
)
SELECT
    rowid, id, group_id, member_id, created_by, created_at, expires_at, accepted_by, accepted_at, declined_at, revoked_at
FROM friend_invitations;

DROP TABLE friend_invitations;

ALTER TABLE friend_invitations_next RENAME TO friend_invitations;

CREATE INDEX friend_invitations_group ON friend_invitations (group_id);

-- A friend has at most one invitation that nobody has answered or revoked; a direct one has no friend until accepted
CREATE UNIQUE INDEX friend_invitations_open ON friend_invitations (group_id)
WHERE accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL;

CREATE INDEX friend_invitations_created_by ON friend_invitations (created_by);

CREATE INDEX friend_invitations_accepted_by ON friend_invitations (accepted_by);
