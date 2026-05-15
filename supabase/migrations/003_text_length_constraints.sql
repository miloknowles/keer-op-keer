-- Prevent oversized strings in user-controlled and identifier columns.

ALTER TABLE room_chats
  ADD CONSTRAINT room_chats_message_length
    CHECK (char_length(message) <= 500);

ALTER TABLE room_players
  ADD CONSTRAINT room_players_display_name_length
    CHECK (char_length(display_name) <= 50);

ALTER TABLE rooms
  ADD CONSTRAINT rooms_code_length
    CHECK (char_length(code) <= 16);

ALTER TABLE room_boards
  ADD CONSTRAINT room_boards_template_id_length
    CHECK (char_length(template_id) <= 64);

ALTER TABLE room_history
  ADD CONSTRAINT room_history_dice_colors_length
    CHECK (cardinality(dice_colors) = 3);

ALTER TABLE room_history
  ADD CONSTRAINT room_history_dice_numbers_length
    CHECK (cardinality(dice_numbers) = 3);
