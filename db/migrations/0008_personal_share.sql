-- Your part of a restaurant card expense, when others pay you back the rest of what the card paid (ARCHITECTURE.md §5).
-- Null means the whole amount: rows written before this, and by clients that don't send it, keep their full amount.
ALTER TABLE expenses ADD COLUMN personal_cents INTEGER;
