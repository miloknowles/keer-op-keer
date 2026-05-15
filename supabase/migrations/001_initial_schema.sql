-- Core room metadata. Board config lives in room_boards to keep this table lean.
CREATE TABLE rooms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,
  host_id               uuid,
  status                text NOT NULL DEFAULT 'lobby'
                          CHECK (status IN ('lobby', 'in_progress', 'finished')),
  current_player_index  int NOT NULL DEFAULT 0,
  round_number          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  finished_at           timestamptz
);

-- One row per player per room.
CREATE TABLE room_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  display_name    text NOT NULL,
  seat_index      int NOT NULL,

  -- Live game state
  crossed_cells   text[] NOT NULL DEFAULT '{}',
  hearts          int NOT NULL DEFAULT 0 CHECK (hearts BETWEEN 0 AND 5),
  boxes_unlocked  int NOT NULL DEFAULT 1 CHECK (boxes_unlocked BETWEEN 0 AND 9),
  boxes_spent     int NOT NULL DEFAULT 0 CHECK (boxes_spent >= 0),
  wildcards       int NOT NULL DEFAULT 6 CHECK (wildcards BETWEEN 0 AND 6),

  -- End-game (populated when status → 'finished')
  score           int,
  score_breakdown jsonb,

  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat_index),
  UNIQUE (room_id, user_id)
);

-- Board config for a room. Split out to keep rooms lightweight.
CREATE TABLE room_boards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid UNIQUE NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  template_id  text,
  config       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Chat messages. Append-only log.
CREATE TABLE room_chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id  uuid REFERENCES room_players(id) ON DELETE SET NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per round. Source of truth for game replay and reconnect catch-up.
CREATE TABLE room_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number      int NOT NULL,
  active_player_id  uuid NOT NULL REFERENCES room_players(id),

  -- The roll (always 7 dice). Wildcards preserved as-is ("?" / "✕").
  dice_colors   text[] NOT NULL,   -- length 3, e.g. {"p","✕","o"}
  dice_numbers  text[] NOT NULL,   -- length 3, e.g. {"3","?","5"}
  dice_special  text NOT NULL
                  CHECK (dice_special IN ('heart', 'fill', 'three_in_a_row', 'bomb', 'two_stars')),

  -- Active player's submitted pick.
  -- { type: "color_number", color_die, number_die, declared_color, declared_number, cells, bomb_cells? }
  -- { type: "special", cells, bomb_cells? }
  -- { type: "pass" }
  active_pick   jsonb,

  -- Non-active players' picks, keyed by room_players.id.
  player_picks  jsonb NOT NULL DEFAULT '{}',

  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
);

-- Indexes for common query patterns
CREATE INDEX ON room_players (room_id);
CREATE INDEX ON room_history (room_id, round_number DESC);
CREATE INDEX ON room_chats (room_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_boards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_chats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_history ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user a member of this room?
CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

-- rooms: readable by members; no direct client writes (API routes use service role)
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (is_room_member(id));

-- room_players: readable by all members of the same room
CREATE POLICY "room_players_select" ON room_players
  FOR SELECT USING (is_room_member(room_id));

-- room_boards: readable by all members
CREATE POLICY "room_boards_select" ON room_boards
  FOR SELECT USING (is_room_member(room_id));

-- room_chats: members can read and insert their own messages
CREATE POLICY "room_chats_select" ON room_chats
  FOR SELECT USING (is_room_member(room_id));

CREATE POLICY "room_chats_insert" ON room_chats
  FOR INSERT WITH CHECK (
    is_room_member(room_id)
    AND player_id IN (
      SELECT id FROM room_players
      WHERE room_id = room_chats.room_id AND user_id = auth.uid()
    )
  );

-- room_history: readable by members
CREATE POLICY "room_history_select" ON room_history
  FOR SELECT USING (is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE room_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE room_history;
