# Keer op Keer 2 — Implementation Plan

Reference: `docs/SPEC.md`, `boards/kok2-standard.json`, `boards/board.types.ts`

The plan is ordered so each phase builds on the last and produces something runnable. Phases 1–3 are pure setup with no visible UI changes. Phase 4 unlocks the full room lifecycle. Phases 5–7 build the game itself. Phase 8 closes the loop. Phase 9 is polish.

---

## Phase 1 — Database Schema ✓

> **Supabase dashboard prerequisite:** ✓ **Authentication → Sign In / Up → Anonymous sign-ins** is enabled.

**Goal:** Get the Supabase schema in place so everything downstream can write to it.

### 1.1 Create `supabase/` directory and migration file

Create `supabase/migrations/001_initial_schema.sql` with the following tables:

```sql
rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid,                           -- set after first player joins
  status text NOT NULL DEFAULT 'lobby',  -- 'lobby' | 'in_progress' | 'finished'
  current_player_index int NOT NULL DEFAULT 0,
  round_number int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
)

room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id),
  user_id uuid REFERENCES auth.users(id),
  display_name text NOT NULL,
  seat_index int NOT NULL,
  crossed_cells text[] NOT NULL DEFAULT '{}',
  hearts int NOT NULL DEFAULT 0,
  boxes_unlocked int NOT NULL DEFAULT 1,   -- total boxes circled/earned (starts at 1, max 9)
  boxes_spent int NOT NULL DEFAULT 0,      -- available = boxes_unlocked - boxes_spent
  wildcards int NOT NULL DEFAULT 6,
  column_heart_bonuses jsonb NOT NULL DEFAULT '{}',  -- per-column heart count at time of completion
  score int,
  score_breakdown jsonb,
  joined_at timestamptz NOT NULL DEFAULT now()
)

room_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid UNIQUE NOT NULL REFERENCES rooms(id),
  template_id text,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

room_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id),
  player_id uuid REFERENCES room_players(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)

room_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id),
  round_number int NOT NULL,
  active_player_id uuid NOT NULL REFERENCES room_players(id),
  dice_colors text[] NOT NULL,    -- length 3
  dice_numbers text[] NOT NULL,   -- length 3; "?" = wildcard
  dice_special text NOT NULL,     -- "heart"|"fill"|"three_in_a_row"|"bomb"|"two_stars"
  active_pick jsonb NOT NULL,
  player_picks jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
)
```

Also add RLS policies: players can only read/write rows for rooms they belong to.

RLS write policies applied via `fix_rls_policies` migration:
- `room_players` REPLICA IDENTITY set to FULL (Realtime DELETE events carry the old row)
- `room_players_insert`: `WITH CHECK (user_id = auth.uid())`
- `room_players_update`: `USING (user_id = auth.uid())`
- `rooms_update`: host-only with `host_id IS NULL` bootstrap branch
- `host_can_kick_players` DELETE policy added
- Lobby-readable SELECT policies on `rooms` and `room_players` (join flow)

Enable Realtime on `rooms`, `room_players`, `room_chats`, `room_history`. ✓ Confirmed in `supabase_realtime` publication.

---

## Phase 2 — TypeScript Types ✓

**Goal:** Define all shared types in one place so game logic, API routes, and UI are in sync.

### 2.1 Create `app/src/types/game.ts`

```ts
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
  boxes_unlocked: number   // total earned; available = boxes_unlocked - boxes_spent
  boxes_spent: number
  wildcards: number
  column_heart_bonuses: Record<string, number> | null  // heart count recorded per column at completion
  score: number | null
  score_breakdown: ScoreBreakdown | null
  joined_at: string
}

export interface RoomBoardRow {
  id: string
  room_id: string
  template_id: string | null
  config: BoardConfig
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
export type DiceSpecialFace = 'heart' | 'fill' | 'three_in_a_row' | 'bomb' | 'two_stars'

export interface DiceRoll {
  colors: [DiceColorFace, DiceColorFace, DiceColorFace]
  numbers: [DiceNumberFace, DiceNumberFace, DiceNumberFace]
  special: DiceSpecialFace
}

// Picks
export interface ColorNumberPick {
  type: 'color_number'
  color_die: 0 | 1 | 2         // index into dice_colors
  number_die: 0 | 1 | 2        // index into dice_numbers
  declared_color: Color         // actual color (resolved if wildcard)
  declared_number: number       // 1–5
  cells: CellKey[]
  bomb_cells?: CellKey[]        // only if a bomb row was earned this turn
}

export interface SpecialPick {
  type: 'special'
  cells: CellKey[]
  bomb_cells?: CellKey[]
}

export interface PassPick {
  type: 'pass'
}

export type Pick = ColorNumberPick | SpecialPick | PassPick

// Scoring
export interface ScoreBreakdown {
  columns: Record<string, number>   // column → pts earned
  rows: Record<string, number>      // row → pts earned
  colors: Record<Color, number>     // color → pts earned
  stars: number                     // negative (−2 per uncrossed star)
  total: number
}
```

---

## Phase 3 — Pure Game Logic ✓

**Goal:** Write the stateless logic that both the server and client will use. No React, no Supabase — pure TypeScript functions. These are the most important functions to get right; everything else depends on them.

### 3.1 `app/src/lib/game/dice.ts`

- `COLOR_FACES: DiceColorFace[]` — all 6 faces of a color die
- `NUMBER_FACES: DiceNumberFace[]` — all 6 faces of a number die  
- `SPECIAL_FACES: DiceSpecialFace[]` with correct weights: heart×2, fill×1, three_in_a_row×1, bomb×1, two_stars×1
- `rollDice(): DiceRoll` — pick random face from each die using proper weights for the special die
- `isColorWildcard(face: DiceColorFace): boolean`
- `isNumberWildcard(face: DiceNumberFace): boolean`

### 3.2 `app/src/lib/game/sheet.ts`

Helpers that work on the board config + a player's `crossed_cells` array:

- `getCell(config, key): BoardCell | undefined`
- `getCellsOfColor(config, color): CellKey[]`
- `isColumnComplete(config, col, crossed): boolean`
- `isRowComplete(config, row, crossed): boolean`
- `isColorComplete(config, color, crossed): boolean`
- `getAdjacentCells(config, key): CellKey[]` — orthogonal neighbors
- `isAdjacentToRegion(config, key, crossed): boolean`
- `getConnectedRegion(config, color, startKey, crossed): CellKey[]` — flood-fill for Fill
- `colorsCompleted(config, crossed): Color[]` — for game-end detection
- `uncrossedStars(config, crossed): CellKey[]`

### 3.3 `app/src/lib/game/rules.ts`

Server-authoritative validation. All functions return `{ valid: boolean; error?: string }`.

- `validateColorNumberPick(config, pick, roll, player, crossedByOthers, round): ValidationResult`
  - Checks: correct dice indices, wildcard slots available, cells are correct color, correct count, all adjacent to existing region (or column H if first placement)
  - In rounds 1–2: all dice available. In rounds 3+: active player's dice excluded from non-active picks
- `validateSpecialPick(config, pick, roll, player): ValidationResult`
  - Checks: player has ≥1 box, cells match the special die face rule
  - Fill: cells form a connected same-color region adjacent to existing region
  - Three-in-a-row: exactly 3 cells in same row, each individually adjacent to region
  - Bomb: exactly 4 cells forming a 2×2 block
  - Two-stars: exactly 2 cells that are star cells
  - Heart: no cells (track advance only)
- `validateBombCells(config, cells): ValidationResult` — validates a bomb-row triggered bomb
- `canPass(config, roll, player, round): boolean`

### 3.4 `app/src/lib/game/effects.ts`

Applied server-side after a pick is validated. Computes all side effects of crossing off cells:
- Column completions → award box (column H) or column bonus; record `column_heart_bonuses` entry at current heart count
- Row completions → award row item (box, bomb, heart) to the first completer; check if other players have already completed it
- Color completions → used by pick route for game-end detection
- Heart advances → increment `hearts`

Returns a structured update for `room_players` so the pick route can apply everything atomically.

### 3.5 `app/src/lib/game/scoring.ts`

Called once when the game finishes:

- `computeScore(config, player, allPlayers): ScoreBreakdown`
  - Column bonuses: for each completed column, determine if `player` was first (compare crossed_cells across all players) → `first` or `subsequent` value + hearts at time of completion (note: hearts at game-end is a simplification; exact heart-at-completion tracking requires history — see note below)
  - Row bonuses: +5 + item for first completer per row
  - Color bonuses: +5 first, +3 subsequent per color
  - Star penalty: −2 × uncrossed star count

> **Heart timing note:** The SPEC says heart bonus is the player's heart count *at the time of column completion*, which compounds over the game. To compute this exactly we'd need to replay history. As a v1 simplification, use the player's *final* heart count for all column bonuses — this overestimates slightly for early completions but is simple and correct directionally. Revisit if needed.

---

## Phase 4 — Anonymous Auth + Room Creation/Join APIs ✓

**Goal:** The landing page actually creates rooms and adds players to them. At the end of this phase, you can open two browser tabs, create a room in one and join it in the other.

### 4.1 Anonymous auth on page load

In `app/src/app/layout.tsx` (or a client component that mounts once), call `supabase.auth.signInAnonymously()` if no session exists. Store the display name the user typed in local state / a cookie — pass it when joining.

### 4.2 `POST /api/rooms` — create room

`app/src/app/api/rooms/route.ts`

1. Verify Supabase session (anon is fine)
2. Generate a unique 4-letter code (retry if collision)
3. Insert `rooms` row (status: 'lobby')
4. Insert `room_boards` row with `kok2-standard.json` config
5. Call `/api/rooms/[code]/join` logic to add the creator as the host (seat_index: 0)
6. Set `rooms.host_id` to the new player's id
7. Return `{ code }`

### 4.3 `POST /api/rooms/[code]/join`

`app/src/app/api/rooms/[code]/join/route.ts`

Request body: `{ display_name: string }`

1. Verify session
2. Fetch room by code, assert status === 'lobby'
3. Check player count ≤ 5 (max 6 total)
4. Check user_id not already in room (idempotent re-join)
5. Insert `room_players` row with next available `seat_index`
6. Return `{ player_id }`

### 4.4 Wire landing page to APIs

Update `app/src/app/page.tsx`:
- "New game" button: POST /api/rooms → navigate to `/room/[code]/lobby`
- Join form: POST /api/rooms/[code]/join → navigate to `/room/[code]/lobby`
- Collect display name before/during these actions (modal or inline input)

---

## Phase 5 — Room Layout, Context, and Lobby ✓

**Goal:** `/room/[code]/lobby` shows the player list with a Start button for the host. At the end of this phase, a host can start the game and all clients navigate to `/room/[code]/game`.

### 5.1 `RoomContext` — `app/src/lib/context/room.tsx`

A React context that lives in the shared room layout. Provides:

```ts
interface RoomContext {
  room: RoomRow
  players: RoomPlayerRow[]
  board: RoomBoardRow
  me: RoomPlayerRow        // current user's player row
  isHost: boolean
  history: RoomHistoryRow[]  // all rounds so far
}
```

Populated on mount by fetching `rooms`, `room_players`, `room_boards`, and `room_history` for the code. Kept live by Supabase Realtime subscriptions (INSERT/UPDATE on all four tables).

### 5.2 Room layout — `app/src/app/room/[code]/layout.tsx`

Server component that:
1. Fetches `rooms.status` server-side
2. Renders `<RoomProvider>` (client component wrapping `RoomContext`)
3. Renders `{children}`

### 5.3 Room index page — `app/src/app/room/[code]/page.tsx`

Server component: reads `rooms.status` and redirects:
- `lobby` → `/room/[code]/lobby`
- `in_progress` → `/room/[code]/game`
- `finished` → `/room/[code]/finished`

The `RoomContext` also handles client-side navigation when `rooms.status` changes via Realtime — so all clients jump routes simultaneously.

### 5.4 Lobby page — `app/src/app/room/[code]/lobby/page.tsx`

Client component. Uses `RoomContext`. Shows:
- Room code (big, copyable)
- Player list with names and seat order
- "Start game" button (host only, disabled if < 1 player)
- Share link

### 5.5 `POST /api/rooms/[code]/start`

`app/src/app/api/rooms/[code]/start/route.ts`

1. Verify caller is host
2. Assert status === 'lobby', ≥ 1 player
3. Roll initial dice → insert first `room_history` row (round 1)
4. Update `rooms.status = 'in_progress'`, `started_at = now()`
5. Realtime broadcasts; all clients navigate to `/game`

---

## Phase 6 — Score Sheet Component ✓

**Goal:** Render a player's score sheet as an interactive grid before hooking up live game state. This is the visually hardest piece and benefits from being built in isolation.

### 6.1 `ScoreSheet` component — `app/src/components/game/ScoreSheet.tsx`

Props:
```ts
interface ScoreSheetProps {
  config: BoardConfig
  crossedCells: Set<string>
  pendingCells?: Set<string>         // cells highlighted for the current pick
  selectableCells?: Set<string>      // cells the player can click
  onCellClick?: (key: CellKey) => void
  hearts: number
  boxes: number
  wildcards: number
  completedColumns?: string[]
  completedRows?: string[]
}
```

Renders:
- 7×15 grid of `<Cell>` components
- Column labels (A–O) and row labels (P–V)
- Special cell icons: star (☆) and box (!)
- Color-coded backgrounds per `config.cells`
- Crossed cells get an X overlay
- Pending cells get a highlight
- Selectable cells show a pointer cursor + hover highlight
- Below grid: hearts track (5 slots), box track (9 slots), wildcard count

### 6.2 `Cell` component — `app/src/components/game/Cell.tsx`

Small, focused: renders one cell with the right background color, special icon, and state overlays.

### 6.3 Tracks components

- `HeartsTrack` — 5 heart icons, filled up to `hearts`
- `BoxTrack` — 9 box slots, circled up to `boxes`
- `WildcardTrack` — shows remaining count

---

## Phase 7 — Active Game: Dice, Picking, and Turn Flow

**Goal:** Players can actually play the game — roll dice, pick their combination, see their sheet update in real time. This is the core game loop.

### 7.1 Dice display — `app/src/components/game/DiceDisplay.tsx`

Shows the 7 dice for the current round (from `room_history`). Highlights which dice are available for the current player to pick (based on round number and active player's pick).

### 7.2 Dice picker — `app/src/components/game/DicePicker.tsx`

UI for non-active players (and active player choosing color+number) to select 1 color die + 1 number die. Handles:
- Wildcard dice: shows a declaration modal before confirming (`DeclareWildcardModal`)
- Wildcard availability: disables wildcard dice if `wildcards === 0`
- Disabled dice: in rounds 3+, grays out the active player's chosen dice

### 7.3 Special die picker — `app/src/components/game/SpecialDicePicker.tsx`

For the active player spending a box. Shows the special die face and renders the appropriate cell-selection UI based on the face:
- **Heart** — no UI, just confirm
- **Fill** — click a same-color connected region adjacent to your territory
- **Three-in-a-row** — click exactly 3 cells in a single row, each adjacent to territory
- **Bomb** — click any 2×2 block
- **Two-stars** — click exactly 2 star cells anywhere

### 7.4 Pick submission — `POST /api/rooms/[code]/pick` ✓

`app/src/app/api/rooms/[code]/pick/route.ts`

1. Verify caller is in the room, room is `in_progress`
2. Fetch current `room_history` row for `round_number`
3. Validate the pick via `rules.ts` (server-authoritative)
4. Write pick to `room_history`: active player updates `active_pick`; non-active players use the `merge_player_pick` Postgres RPC to atomically merge their entry into `player_picks` (eliminates read-modify-write race)
5. Update `room_players` row: append `cells` to `crossed_cells`, apply resource changes (hearts, boxes, wildcards), apply bomb cells if present
6. Check row/column/color completions from this turn's cells → award items/bonuses, update other players if they earned a row item
7. Check game-end condition: any player has 2 completed colors → set `status = 'finished'`

### 7.5a Round advancement — `POST /api/rooms/[code]/advance` ✓

`app/src/app/api/rooms/[code]/advance/route.ts`

Any player can call this once all picks are in. The game page shows a "Next round →" button in the header when `currentHistory.active_pick` is set and `player_picks` has entries for all non-active players.

1. Verify caller is in the room, room is `in_progress`
2. Re-fetch `room_history` and confirm all picks present (returns 409 otherwise)
3. `UPDATE rooms SET round_number = $n+1, current_player_index = ($i+1) % $total WHERE id = $id AND round_number = $n` — conditional update makes simultaneous clicks idempotent

### 7.5 Game page — `app/src/app/room/[code]/game/page.tsx`

Client component using `RoomContext`. Layout:
- Top: active player indicator, round number, dice display
- Center: current player's score sheet (full-size) with picking UI
- Side panel or drawer: other players' sheets (read-only, condensed)
- Bottom: pick submission controls, resource tracks

When it's not your turn (you're a non-active player), the dice picker is enabled.  
When it's your turn (you're the active player), you pick first and choose color+number or special.

### 7.6 Turn status indicator — `app/src/components/game/TurnStatus.tsx`

Shows who the active player is, which players have submitted picks for this round (checkmarks), and who is still deciding.

---

## Phase 8 — Game End and Scoring Screen

**Goal:** The game detects when it should end, computes scores, and shows a results screen.

### 8.1 Game-end detection (inline in pick route) ✓

There is no separate `/finish` endpoint. Game-end is detected and resolved inline in `POST /api/rooms/[code]/pick`:

1. After applying the pick effects, check if any player now has 2 completed colors
2. Compute `ScoreBreakdown` for each player via `scoring.ts`
3. Update each `room_players` row with `score` and `score_breakdown`
4. Update `rooms.status = 'finished'`, `finished_at = now()`
5. Realtime broadcasts the `rooms` update; all clients navigate to `/finished`

### 8.2 Finished page — `app/src/app/room/[code]/finished/page.tsx`

Client component using `RoomContext`. Shows:
- Final rankings with scores
- Per-player score breakdown (columns, rows, colors, stars)
- Option to return to landing and create a new game

---

## Phase 9 — Polish

Things that make the game feel real but aren't on the critical path.

### 9.1 Chat

- `room_chats` table is already in the schema
- `ChatPanel` component with message list and input
- POST to an `/api/rooms/[code]/chat` route
- Realtime subscription already set up in `RoomContext`

### 9.2 Error handling and reconnection

- If a pick is rejected (400), re-sync from DB and show an error toast
- On Realtime disconnect, poll and re-subscribe
- Handle "room not found" and "room full" gracefully on join

### 9.3 Animations

- Dice roll animation when a new `room_history` row appears
- Cell cross-off animation
- Track advance animations (hearts, boxes)

### 9.4 Mobile layout

- Score sheet needs to be scrollable/zoomable on small screens
- Consider a tab-based layout: Sheet | Dice | Players

### 9.5 Accessibility

- Keyboard navigation for cell selection
- ARIA labels on all interactive elements
- Color names as text tooltips (for colorblind users)

---

## Dependency Order Summary

```
Phase 1: DB Schema
    ↓
Phase 2: TS Types
    ↓
Phase 3: Game Logic (dice, sheet, rules, scoring)
    ↓
Phase 4: Auth + Room APIs + Landing Page wired up
    ↓
Phase 5: Room Layout + Context + Lobby + Start API
    ↓
Phase 6: ScoreSheet component (can be built in parallel with Phase 5)
    ↓
Phase 7: Active Game (dice display, pickers, pick API, game page)
    ↓
Phase 8: Game End (finish API, scoring screen)
    ↓
Phase 9: Polish (chat, animations, error handling, mobile)
```

Phase 6 (ScoreSheet) can begin in parallel with Phase 5 since it only needs the board config, not the live room state.

---

## Key Implementation Risks

| Risk | Mitigation |
|---|---|
| **Adjacency validation complexity** | Write comprehensive unit tests for `rules.ts` before using it in the API. Test edge cases: first placement (column H), Fill across non-contiguous same-color regions, bomb at board edges |
| **Turn-advance race condition** | ✓ Resolved: `player_picks` merge uses the `merge_player_pick` RPC (atomic JSONB `\|\|`). Round advancement is manual via `/advance` endpoint with a conditional `WHERE round_number = $expected` update — simultaneous clicks are idempotent |
| **Wildcard die tracking across round types** | Open dice (rounds 1–2) vs restricted pool (round 3+): the server must enforce which dice indices are available to non-active players |
| **Bomb mid-turn** | Bomb cells must be validated together with the triggering pick — treat `bomb_cells` as part of the same atomic write |
| **Heart timing simplification** | v1 uses final heart count for all column bonuses. This is documented; revisit if players notice the discrepancy |
| **Supabase RLS** | ✓ Write policies applied and tightened (host-only update, self-only insert/update for players, kick policy added) |
