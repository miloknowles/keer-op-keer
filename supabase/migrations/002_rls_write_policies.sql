-- ---------------------------------------------------------------------------
-- Write policies for rooms, room_players, room_boards
-- ---------------------------------------------------------------------------
-- Migration 001 only added SELECT policies. These add INSERT, UPDATE, and
-- DELETE so API routes can operate without a service-role key.

-- room_players needs REPLICA IDENTITY FULL so Realtime DELETE events include
-- the full old row (needed to detect when the current user has been kicked).
ALTER TABLE room_players REPLICA IDENTITY FULL;

-- Any authenticated user can create a room.
CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Host can update the room (status, started_at, host_id assignment).
-- The host_id IS NULL branch handles the bootstrap: the room is created first
-- with host_id = null, then the player row is inserted, then host_id is set.
-- NULL IN (...) is false in SQL, so without this branch the update would be blocked.
CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE
  USING (
    (host_id IS NULL AND auth.uid() IS NOT NULL)
    OR host_id IN (SELECT id FROM room_players WHERE user_id = auth.uid())
  );

-- A user can insert their own player row.
CREATE POLICY "room_players_insert" ON room_players
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- A user can update their own row (display_name edits and in-game state updates).
CREATE POLICY "room_players_update" ON room_players
  FOR UPDATE USING (user_id = auth.uid());

-- Host can remove (kick) any other player from the room.
CREATE POLICY "host_can_kick_players" ON room_players
  FOR DELETE
  USING (
    user_id != auth.uid()
    AND room_id IN (
      SELECT r.id FROM rooms r
      JOIN room_players hp ON hp.id = r.host_id
      WHERE hp.user_id = auth.uid()
    )
  );

-- Board row is created by the room creator; permissive for v1 since the API
-- validates ownership before inserting.
CREATE POLICY "room_boards_insert" ON room_boards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow any authenticated user to read a lobby room.
-- Needed for the join flow: a prospective joiner is not yet a member, so
-- is_room_member() would block them. Scoped to status = 'lobby' only.
CREATE POLICY "rooms_select_lobby" ON rooms
  FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'lobby');

-- Allow any authenticated user to read players in a lobby room (for join validation).
CREATE POLICY "room_players_select_lobby" ON room_players
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND room_id IN (SELECT id FROM rooms WHERE status = 'lobby')
  );
