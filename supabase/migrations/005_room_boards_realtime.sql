-- Enable realtime for room_boards so clients see board config changes (e.g.
-- when the host toggles random board in the lobby).
-- REPLICA IDENTITY FULL is required for filtered subscriptions on non-PK columns
-- (room_id is not the primary key), matching the same pattern used for room_players.
ALTER TABLE room_boards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE room_boards;
