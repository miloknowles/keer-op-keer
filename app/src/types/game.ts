// Re-export board types for convenience
export type { Color, CellKey, BoardCell, BoardConfig } from '../../../boards/board.types'

// DB row shapes (snake_case matches Supabase)
export type RoomStatus = 'lobby' | 'in_progress' | 'finished'

export interface RoomRow {
  id: string
  code: string
  host_id: string | null
  status: RoomStatus
  current_player_index: number
  round_number: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface RoomPlayerRow {
  id: string
  room_id: string
  user_id: string | null
  display_name: string
  seat_index: number
  crossed_cells: string[]
  hearts: number
  boxes_unlocked: number
  boxes_spent: number
  wildcards: number
  score: number | null
  score_breakdown: ScoreBreakdown | null
  joined_at: string
}

export interface RoomBoardRow {
  id: string
  room_id: string
  template_id: string | null
  config: import('../../../boards/board.types').BoardConfig
  created_at: string
}

export interface RoomHistoryRow {
  id: string
  room_id: string
  round_number: number
  active_player_id: string
  dice_colors: [string, string, string]
  dice_numbers: [string, string, string]
  dice_special: DiceSpecialFace
  active_pick: Pick
  player_picks: Record<string, Pick>
  created_at: string
}

// Dice
export type DiceColorFace = 'p' | 'o' | 'y' | 'g' | 'b' | '✕'
export type DiceNumberFace = '1' | '2' | '3' | '4' | '5' | '?'
export type DiceSpecialFace = 'heart' | 'sweep' | 'three_in_a_row' | 'bomb' | 'two_stars'

export interface DiceRoll {
  colors: [DiceColorFace, DiceColorFace, DiceColorFace]
  numbers: [DiceNumberFace, DiceNumberFace, DiceNumberFace]
  special: DiceSpecialFace
}

// Picks
export interface ColorNumberPick {
  type: 'color_number'
  color_die: 0 | 1 | 2
  number_die: 0 | 1 | 2
  declared_color: import('../../../boards/board.types').Color
  declared_number: number
  cells: string[]
  bomb_cells?: string[]
}

export interface SpecialPick {
  type: 'special'
  cells: string[]
  bomb_cells?: string[]
}

export interface PassPick {
  type: 'pass'
}

export type Pick = ColorNumberPick | SpecialPick | PassPick

// Scoring
export interface ScoreBreakdown {
  columns: Record<string, number>
  rows: Record<string, number>
  colors: Record<import('../../../boards/board.types').Color, number>
  stars: number
  total: number
}
