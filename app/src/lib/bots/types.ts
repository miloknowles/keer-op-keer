import type { BoardConfig } from "@/boards/board.types";
import type { GamePick, DiceRoll, RoomPlayerRow } from "@/types/game";

export interface BotContext {
  config: BoardConfig;
  player: RoomPlayerRow;
  roll: DiceRoll;
  isActivePlayer: boolean;
  activePick: GamePick | null;
  round: number;
  allPlayers: RoomPlayerRow[];
}

export interface BotStrategy {
  readonly type: string;
  choosePick(ctx: BotContext): GamePick;
}
