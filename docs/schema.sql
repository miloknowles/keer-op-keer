-- ============================================================
-- 001 — Initial Schema
-- ============================================================

-- rooms
CREATE TABLE rooms (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text UNIQUE NOT NULL,
  host_id              uuid,
  status               text NOT NULL DEFAULT 'lobby'
                         CHECK (status IN ('lobby', 'in_progress', 'finished')),
  current_player_index int NOT NULL DEFAULT 0,
  round_number         int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  started_at           timestamptz,
  finished_at          timestamptz
);

-- room_players
CREATE TABLE room_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  display_name    text NOT NULL,
  seat_index      int NOT NULL,
  crossed_cells   text[] NOT NULL DEFAULT '{}',
  hearts          int NOT NULL DEFAULT 0,
  boxes_unlocked  int NOT NULL DEFAULT 1,
  boxes_spent     int NOT NULL DEFAULT 0,
  wildcards       int NOT NULL DEFAULT 6,
  score           int,
  score_breakdown jsonb,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat_index)
);

-- room_boards
CREATE TABLE room_boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid UNIQUE NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  template_id text,
  config      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- room_chats
CREATE TABLE room_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id  uuid REFERENCES room_players(id) ON DELETE SET NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- room_history
CREATE TABLE room_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number     int NOT NULL,
  active_player_id uuid NOT NULL REFERENCES room_players(id),
  dice_colors      text[] NOT NULL,
  dice_numbers     text[] NOT NULL,
  dice_special     text NOT NULL
                     CHECK (dice_special IN ('heart', 'sweep', 'three_in_a_row', 'bomb', 'two_stars')),
  active_pick      jsonb NOT NULL,
  player_picks     jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX ON rooms (code);
CREATE INDEX ON room_players (room_id);
CREATE INDEX ON room_players (user_id);
CREATE INDEX ON room_chats (room_id);
CREATE INDEX ON room_history (room_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_boards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_history  ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user a member of this room?
CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

-- rooms: any authenticated user can read; members can update
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (is_room_member(id));

-- room_players: readable by anyone; insert/update restricted to members of that room
CREATE POLICY "room_players_select" ON room_players FOR SELECT USING (true);
CREATE POLICY "room_players_insert" ON room_players FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_players_update" ON room_players FOR UPDATE USING (is_room_member(room_id));

-- room_boards: readable by anyone; only members can insert
CREATE POLICY "room_boards_select" ON room_boards FOR SELECT USING (true);
CREATE POLICY "room_boards_insert" ON room_boards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- room_chats: members only
CREATE POLICY "room_chats_select" ON room_chats FOR SELECT USING (is_room_member(room_id));
CREATE POLICY "room_chats_insert" ON room_chats FOR INSERT WITH CHECK (is_room_member(room_id));

-- room_history: members only
CREATE POLICY "room_history_select" ON room_history FOR SELECT USING (is_room_member(room_id));
CREATE POLICY "room_history_insert" ON room_history FOR INSERT WITH CHECK (is_room_member(room_id));
CREATE POLICY "room_history_update" ON room_history FOR UPDATE USING (is_room_member(room_id));

-- ============================================================
-- Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE room_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE room_history;
