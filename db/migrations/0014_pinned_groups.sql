-- When a user pinned a group to their Expenses screen, null when they didn't (ADR-0021)
ALTER TABLE shared_members ADD COLUMN pinned_at INTEGER;
