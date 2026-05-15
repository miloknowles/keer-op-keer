-- active_pick is null until the active player submits their move after rolling.
-- The initial schema defined it as nullable (no NOT NULL), but the live DB
-- has a constraint; this corrects the drift.
ALTER TABLE room_history ALTER COLUMN active_pick DROP NOT NULL;
