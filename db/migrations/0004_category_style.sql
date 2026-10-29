-- Every category has a color and an icon, both keys of fixed lists. Existing rows get the plain look.
ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT 'gray';
ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'category';
