-- The part of an installment plan an expense is: the plan it belongs to, which part it is and
-- how many parts the plan has. All three are null for an expense that is in no plan.
ALTER TABLE expenses ADD COLUMN plan_id TEXT;
ALTER TABLE expenses ADD COLUMN plan_part INTEGER;
ALTER TABLE expenses ADD COLUMN plan_parts INTEGER;
