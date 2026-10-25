-- How an expense was paid and the day it counts on when that isn't the day it was made (ARCHITECTURE.md §5).
-- Rows written before this keep counting on their date, paid at once.
ALTER TABLE expenses ADD COLUMN payment TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE expenses ADD COLUMN charge_date TEXT;
