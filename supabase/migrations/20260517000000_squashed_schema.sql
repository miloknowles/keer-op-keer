-- ============================================================
-- Squashed migration: complete schema as of 2026-05-17
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE public.rooms (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text        NOT NULL UNIQUE CHECK (char_length(code) <= 16),
  host_id              uuid,
  status               text        NOT NULL DEFAULT 'lobby'
                                   CHECK (status = ANY (ARRAY['lobby', 'in_progress', 'finished'])),
  current_player_index integer     NOT NULL DEFAULT 0,
  round_number         integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  started_at           timestamptz,
  finished_at          timestamptz
);

CREATE TABLE public.room_players (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              uuid        NOT NULL REFERENCES public.rooms (id),
  user_id              uuid        REFERENCES auth.users (id),
  display_name         text        NOT NULL CHECK (char_length(display_name) <= 50),
  seat_index           integer     NOT NULL,
  crossed_cells        text[]      NOT NULL DEFAULT '{}',
  hearts               integer     NOT NULL DEFAULT 0,
  boxes_unlocked       integer     NOT NULL DEFAULT 1,
  boxes_spent          integer     NOT NULL DEFAULT 0,
  wildcards            integer     NOT NULL DEFAULT 6,
  score                integer,
  score_breakdown      jsonb,
  joined_at            timestamptz NOT NULL DEFAULT now(),
  column_heart_bonuses jsonb       NOT NULL DEFAULT '{}',
  UNIQUE (room_id, seat_index)
);

CREATE TABLE public.room_boards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL UNIQUE REFERENCES public.rooms (id),
  template_id text        CHECK (char_length(template_id) <= 64),
  config      jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.room_chats (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES public.rooms (id),
  player_id  uuid        REFERENCES public.room_players (id),
  message    text        NOT NULL CHECK (char_length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.room_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid        NOT NULL REFERENCES public.rooms (id),
  round_number     integer     NOT NULL,
  active_player_id uuid        NOT NULL REFERENCES public.room_players (id),
  dice_colors      text[]      NOT NULL CHECK (cardinality(dice_colors) = 3),
  dice_numbers     text[]      NOT NULL CHECK (cardinality(dice_numbers) = 3),
  dice_special     text        NOT NULL CHECK (dice_special = ANY (ARRAY['heart', 'fill', 'three_in_a_row', 'bomb', 'two_stars'])),
  active_pick      jsonb,
  player_picks     jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_rooms_created_at ON public.rooms USING btree (created_at);
CREATE INDEX rooms_code_idx ON public.rooms USING btree (code);

CREATE INDEX room_players_room_id_idx ON public.room_players USING btree (room_id);
CREATE INDEX room_players_user_id_idx ON public.room_players USING btree (user_id);

CREATE INDEX room_chats_room_id_idx ON public.room_chats USING btree (room_id);

CREATE INDEX room_history_room_id_idx ON public.room_history USING btree (room_id);

-- ── Functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_rooms()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM rooms WHERE created_at < now() - interval '7 days';
$$;

CREATE OR REPLACE FUNCTION public.maybe_advance_round(p_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
    v_room         rooms%ROWTYPE;
    v_history      room_history%ROWTYPE;
    v_board_config jsonb;
    v_total        int;
    v_threshold    int;
    v_game_ends    boolean;
  BEGIN
    -- Lock the room row so concurrent calls queue up rather than racing.
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

    IF NOT FOUND THEN RETURN 'not_complete'; END IF;
    IF v_room.status != 'in_progress' THEN RETURN 'already_finished'; END IF;

    SELECT * INTO v_history
    FROM   room_history
    WHERE  room_id = p_room_id
      AND  round_number = v_room.round_number;

    IF NOT FOUND OR v_history.active_pick IS NULL THEN
      RETURN 'not_complete';
    END IF;

    SELECT count(*) INTO v_total FROM room_players WHERE room_id = p_room_id;

    IF (
      SELECT count(*)
      FROM   jsonb_object_keys(COALESCE(v_history.player_picks, '{}'::jsonb))
    ) < v_total - 1 THEN
      RETURN 'not_complete';
    END IF;

    SELECT config INTO v_board_config FROM room_boards WHERE room_id = p_room_id;

    v_threshold :=
      (v_board_config -> 'scoring' -> 'gameEnd' ->> 'colorsCompleted')::int;

    -- Game ends if any player has completed >= threshold color groups.
    SELECT EXISTS (
      SELECT 1
      FROM   room_players rp
      WHERE  rp.room_id = p_room_id
        AND  (
          SELECT count(*)
          FROM (
            SELECT cv ->> 'color' AS color
            FROM   jsonb_each(v_board_config -> 'cells') AS t(ck, cv)
            GROUP  BY cv ->> 'color'
            HAVING count(*) = count(*) FILTER (WHERE ck = ANY(rp.crossed_cells))
          ) completed
        ) >= v_threshold
    ) INTO v_game_ends;

    IF v_game_ends THEN
      UPDATE rooms
      SET    status = 'finished', finished_at = now()
      WHERE  id = p_room_id;
      RETURN 'game_ends';
    ELSE
      UPDATE rooms
      SET    round_number          = round_number + 1,
             current_player_index = (current_player_index + 1) % v_total
      WHERE  id = p_room_id;
      RETURN 'advanced';
    END IF;
  END;
$$;

CREATE OR REPLACE FUNCTION public.merge_player_pick(p_history_id uuid, p_player_id text, p_pick jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
  BEGIN
    UPDATE room_history
    SET player_picks = COALESCE(player_picks, '{}'::jsonb) || jsonb_build_object(p_player_id, p_pick)
    WHERE id = p_history_id;
  END;
$$;

-- ── Row-level security ───────────────────────────────────────

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_history ENABLE ROW LEVEL SECURITY;

-- rooms
CREATE POLICY rooms_select ON public.rooms FOR SELECT USING (true);
CREATE POLICY rooms_insert ON public.rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY rooms_update ON public.rooms FOR UPDATE
  USING (
    (host_id IS NULL AND auth.uid() IS NOT NULL)
    OR host_id IN (SELECT id FROM room_players WHERE user_id = auth.uid())
  );

-- room_players
CREATE POLICY room_players_select ON public.room_players FOR SELECT USING (true);
CREATE POLICY room_players_insert ON public.room_players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY room_players_update ON public.room_players FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY host_can_kick_players ON public.room_players FOR DELETE
  USING (
    user_id <> auth.uid()
    AND room_id IN (
      SELECT r.id FROM rooms r
      JOIN room_players hp ON hp.id = r.host_id
      WHERE hp.user_id = auth.uid()
    )
  );

-- room_boards
CREATE POLICY room_boards_select ON public.room_boards FOR SELECT USING (true);
CREATE POLICY room_boards_insert ON public.room_boards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY room_boards_host_update ON public.room_boards FOR UPDATE
  USING (
    room_id IN (
      SELECT r.id FROM rooms r
      JOIN room_players hp ON hp.id = r.host_id
      WHERE hp.user_id = auth.uid()
    )
  );

-- room_chats
CREATE POLICY room_chats_select ON public.room_chats FOR SELECT USING (is_room_member(room_id));
CREATE POLICY room_chats_insert ON public.room_chats FOR INSERT WITH CHECK (is_room_member(room_id));

-- room_history
CREATE POLICY room_history_select ON public.room_history FOR SELECT USING (is_room_member(room_id));
CREATE POLICY room_history_insert ON public.room_history FOR INSERT WITH CHECK (is_room_member(room_id));
CREATE POLICY room_history_update ON public.room_history FOR UPDATE USING (is_room_member(room_id));

-- ── Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_history;
