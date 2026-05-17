-- Allow the room host to update the board config (e.g. toggle random board in lobby).
CREATE POLICY "room_boards_host_update" ON room_boards
  FOR UPDATE
  USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN room_players hp ON hp.id = r.host_id
      WHERE hp.user_id = auth.uid()
    )
  );
