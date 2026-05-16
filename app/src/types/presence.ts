import { Color } from "@/boards/board.types";

export interface CursorPresence {
  cellKey: string | null;
  boardOwnerId: string;
}

export interface PlayerPresence {
  userId: string;
  displayName: string;
  color: Color;
  cursor?: CursorPresence;
}
