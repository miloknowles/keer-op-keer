ALTER TABLE public.room_players
  ADD COLUMN is_bot   boolean NOT NULL DEFAULT false,
  ADD COLUMN bot_type text;
